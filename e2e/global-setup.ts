import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { chromium } from "@playwright/test";
import { MySqlContainer } from "@testcontainers/mysql";
import { GenericContainer, Wait } from "testcontainers";
import { AUTH_STATE, E2E_PORT } from "./port";
import { addVirtualAuthenticator } from "./passkey";
import { startFakeClaude } from "../test/fakeClaude";

/**
 * e2e 준비: 격리된 MySQL·S3(RustFS)를 띄우고 → 마이그레이션·시드 → 그 DB로 운영과 같은 빌드(next build → next start)를 띄운다.
 * 평소 개발 서버·DB는 건드리지 않는다 (빌드 폴더 .next-e2e, 포트 E2E_PORT).
 * 빌드 폴더는 .next 안에 두면 안 된다 — Turbopack이 무시하지 않아 캐시를 쓸 때마다 다시 컴파일·새로고침한다.
 */
export default async function globalSetup() {
  const root = path.resolve(__dirname, "..");
  // 서버 로그는 프로젝트 밖에 쓴다 — 프로젝트 안에 쓰면 개발 서버가 그 변화를 보고 다시 컴파일하며 페이지를 새로고침한다
  const logDir = path.join(os.tmpdir(), "newb-e2e");
  mkdirSync(logDir, { recursive: true });
  console.log(`e2e 서버 로그: ${path.join(logDir, "next-dev.log")}`);

  const [mysql, s3] = await Promise.all([
    new MySqlContainer("mysql:26.10.0").withDatabase("newb_e2e").start(),
    new GenericContainer("rustfs/rustfs:1.0.3")
      .withEnvironment({ RUSTFS_ACCESS_KEY: "e2e", RUSTFS_SECRET_KEY: "e2e_secret_key" })
      .withExposedPorts(9000)
      .withWaitStrategy(Wait.forListeningPorts())
      .start(),
  ]);

  // 실제 Claude 대신 응답하는 가짜 API — 앱은 키가 있는 것처럼 실제 Claude 호출 경로를 탄다
  const fakeClaude = await startFakeClaude();

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    // 운영과 같은 빌드로 띄운다 (개발 서버는 파일 변화·HMR로 페이지가 다시 불려 Passkey 등록 같은 긴 동작이 깨지곤 했다)
    NODE_ENV: "production",
    // 예약 작업(아침 브리핑)은 테스트 중에 돌지 않게
    NEWB_SCHEDULER: "off",
    DATABASE_URL: mysql.getConnectionUri(),
    DATABASE_SSL: "off",
    OCI_AUTH: "",
    S3_ENDPOINT: `http://${s3.getHost()}:${s3.getMappedPort(9000)}`,
    S3_REGION: "ap-tokyo-1",
    S3_BUCKET: "newb-e2e",
    S3_ACCESS_KEY_ID: "e2e",
    S3_SECRET_ACCESS_KEY: "e2e_secret_key",
    NEXT_DIST_DIR: ".next-e2e",
    // 주석 툴바가 진짜 주석 서버로 보내지 않게
    AGENTATION_URL: "http://127.0.0.1:9",
    // 실제 Claude API 대신 가짜 Claude 서버로 (결과가 매번 같아야 함)
    ANTHROPIC_API_KEY: "e2e-fake-key",
    ANTHROPIC_BASE_URL: fakeClaude.url,
    // 개발용 자동 로그인을 끄고 실제 Passkey 로그인으로 (가상 인증기 사용)
    NEWB_DEV_LOGIN: "off",
    APP_ORIGIN: `http://localhost:${E2E_PORT}`,
    // MCP 연결 테스트용 콜백 (실제로는 Claude 주소만 허용)
    MCP_EXTRA_REDIRECT_URIS: `http://localhost:${E2E_PORT}/oauth-test-callback`,
  };

  await createBucket(env);
  execFileSync("npm", ["run", "--silent", "db:migrate"], { cwd: root, env, stdio: "inherit" });
  execFileSync("npm", ["run", "--silent", "test:seed", "--", "--force"], { cwd: root, env, stdio: "inherit" });
  // Passkey 초대: 하나는 아래에서 모든 테스트용 로그인에, 하나는 auth.spec의 첫 등록 흐름에
  const invite = () =>
    execFileSync("npm", ["run", "--silent", "auth:invite", "--", "--token-only"], { cwd: root, env, encoding: "utf8" }).trim();
  const ownerInvite = invite();
  process.env.E2E_INVITE = invite();

  const log = openSync(path.join(logDir, "next-dev.log"), "w");
  console.log("e2e 빌드 중 (next build)…");
  execFileSync("npx", ["next", "build"], { cwd: root, env, stdio: ["ignore", log, log] });
  const server = spawn("npx", ["next", "start", "-H", "127.0.0.1", "-p", String(E2E_PORT)], {
    cwd: root,
    env,
    stdio: ["ignore", log, log],
    detached: true, // 종료할 때 자식 프로세스까지 한 번에
  });
  const teardown = async () => {
    if (server.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        // 이미 종료됨
      }
    }
    await Promise.all([mysql.stop(), s3.stop(), fakeClaude.close()]);
  };
  try {
    await waitForHealth(server);
    await warmUp(ownerInvite);
  } catch (error) {
    // 준비가 실패하면 Playwright가 teardown을 부르지 않는다 → 서버가 포트를 쥔 채 남지 않게 직접 정리
    await teardown();
    throw error;
  }
  return teardown;
}

async function createBucket(env: NodeJS.ProcessEnv) {
  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: { accessKeyId: env.S3_ACCESS_KEY_ID!, secretAccessKey: env.S3_SECRET_ACCESS_KEY! },
    forcePathStyle: true,
  });
  // RustFS가 포트를 연 직후엔 잠깐 요청을 못 받을 수 있다
  for (let i = 0; ; i++) {
    try {
      await client.send(new CreateBucketCommand({ Bucket: env.S3_BUCKET }));
      return;
    } catch (error) {
      if (i >= 20) throw error;
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

/** 개발 서버가 뜨고 DB·저장소가 모두 연결될 때까지 기다린다 (첫 컴파일 포함) */
async function waitForHealth(server: ChildProcess) {
  const deadline = Date.now() + 180_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`e2e 서버가 종료됐어요 (로그: ${os.tmpdir()}/newb-e2e/next-dev.log)`);
    try {
      const res = await fetch(`http://localhost:${E2E_PORT}/api/health`);
      if (res.ok) return;
    } catch {
      // 아직 안 뜸
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error("e2e 서버가 3분 안에 준비되지 않았어요");
}

/**
 * 화면을 브라우저로 한 번씩 미리 열어 컴파일해 둔다.
 * 개발 서버가 화면을 처음 컴파일하는 동안에는 업데이트 신호마다 페이지가 다시 로드돼 테스트가 흔들린다.
 */
const WARM_UP_PATHS = ["/", "/tasks", "/wiki", "/wiki/cautions", "/wiki/weekly-report", "/memos", "/questions", "/questions/a1", "/reschedule", "/settings"];

async function warmUp(invite: string) {
  const browser = await chromium.launch();
  try {
    const context = await browser.newContext();
    const page = await context.newPage();
    // 초대 링크로 Passkey를 만들어 로그인하고, 그 세션을 모든 테스트가 쓰도록 저장
    await addVirtualAuthenticator(page);
    // 첫 컴파일 중엔 페이지가 여러 번 다시 불려 이동·클릭이 끊길 수 있다 → 될 때까지 몇 번 다시 (초대는 성공해야 쓰인 것으로 됨)
    const settingsLink = page.getByRole("link", { name: "설정" }).first();
    for (let attempt = 1; ; attempt++) {
      try {
        await page.goto(`http://localhost:${E2E_PORT}/?invite=${invite}`, { waitUntil: "load", timeout: 120_000 });
        const button = page.getByRole("button", { name: "이 기기에 Passkey 만들기" });
        await button.waitFor({ timeout: 30_000 });
        await page.waitForTimeout(2_000);
        await button.click();
        await settingsLink.waitFor({ timeout: 30_000 });
        break;
      } catch (error) {
        if (await settingsLink.isVisible().catch(() => false)) break;
        if (attempt >= 5) throw error;
        console.log(`Passkey 등록 다시 시도 (${attempt}): ${error instanceof Error ? error.message.split("\n")[0] : error}`);
        await new Promise((r) => setTimeout(r, 3_000));
      }
    }
    await context.storageState({ path: AUTH_STATE });

    for (const p of WARM_UP_PATHS) {
      await page.goto(`http://localhost:${E2E_PORT}${p}`, { waitUntil: "load", timeout: 120_000 });
    }
    // 마지막 컴파일·다시 로드가 가라앉을 때까지
    await page.waitForTimeout(3_000);
  } finally {
    await browser.close();
  }
}
