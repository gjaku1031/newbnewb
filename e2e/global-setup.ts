import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdirSync, openSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { CreateBucketCommand, S3Client } from "@aws-sdk/client-s3";
import { chromium } from "@playwright/test";
import { MySqlContainer } from "@testcontainers/mysql";
import { GenericContainer, Wait } from "testcontainers";
import { E2E_PORT } from "./port";

/**
 * e2e 준비: 격리된 MySQL·S3(RustFS)를 띄우고 → 마이그레이션·시드 → 그 DB를 보는 개발 서버를 띄운다.
 * 평소 개발 서버·DB는 건드리지 않는다 (빌드 폴더 .next-e2e, 포트 E2E_PORT).
 * 빌드 폴더는 .next 안에 두면 안 된다 — Turbopack이 무시하지 않아 캐시를 쓸 때마다 다시 컴파일·새로고침한다.
 */
export default async function globalSetup() {
  const root = path.resolve(__dirname, "..");
  // 서버 로그는 프로젝트 밖에 쓴다 — 프로젝트 안에 쓰면 개발 서버가 그 변화를 보고 다시 컴파일하며 페이지를 새로고침한다
  const logDir = path.join(os.tmpdir(), "newb-e2e");
  mkdirSync(logDir, { recursive: true });
  console.log(`e2e 개발 서버 로그: ${path.join(logDir, "next-dev.log")}`);

  const [mysql, s3] = await Promise.all([
    new MySqlContainer("mysql:26.10.0").withDatabase("newb_e2e").start(),
    new GenericContainer("rustfs/rustfs:1.0.3")
      .withEnvironment({ RUSTFS_ACCESS_KEY: "e2e", RUSTFS_SECRET_KEY: "e2e_secret_key" })
      .withExposedPorts(9000)
      .withWaitStrategy(Wait.forListeningPorts())
      .start(),
  ]);

  const env: NodeJS.ProcessEnv = {
    ...process.env,
    NODE_ENV: "development",
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
    // 실제 Claude API를 부르지 않고 규칙 처리기로 (결과가 매번 같아야 함)
    ANTHROPIC_API_KEY: "",
  };

  await createBucket(env);
  execFileSync("npm", ["run", "--silent", "db:migrate"], { cwd: root, env, stdio: "inherit" });
  execFileSync("npm", ["run", "--silent", "test:seed", "--", "--force"], { cwd: root, env, stdio: "inherit" });

  const log = openSync(path.join(logDir, "next-dev.log"), "w");
  const server = spawn("npx", ["next", "dev", "-H", "127.0.0.1", "-p", String(E2E_PORT)], {
    cwd: root,
    env,
    stdio: ["ignore", log, log],
    detached: true, // 종료할 때 자식 프로세스까지 한 번에
  });
  await waitForHealth(server);
  await warmUp();

  return async () => {
    if (server.pid) {
      try {
        process.kill(-server.pid, "SIGTERM");
      } catch {
        // 이미 종료됨
      }
    }
    await Promise.all([mysql.stop(), s3.stop()]);
  };
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
    if (server.exitCode !== null) throw new Error(`e2e 개발 서버가 종료됐어요 (로그: ${os.tmpdir()}/newb-e2e/next-dev.log)`);
    try {
      const res = await fetch(`http://localhost:${E2E_PORT}/api/health`);
      if (res.ok) return;
    } catch {
      // 아직 안 뜸
    }
    await new Promise((r) => setTimeout(r, 1_000));
  }
  throw new Error("e2e 개발 서버가 3분 안에 준비되지 않았어요");
}

/**
 * 화면을 브라우저로 한 번씩 미리 열어 컴파일해 둔다.
 * 개발 서버가 화면을 처음 컴파일하는 동안에는 업데이트 신호마다 페이지가 다시 로드돼 테스트가 흔들린다.
 */
const WARM_UP_PATHS = ["/", "/tasks", "/wiki", "/wiki/cautions", "/wiki/weekly-report", "/memos", "/questions", "/questions/a1", "/reschedule", "/settings"];

async function warmUp() {
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    for (const p of WARM_UP_PATHS) {
      await page.goto(`http://localhost:${E2E_PORT}${p}`, { waitUntil: "load", timeout: 120_000 });
    }
    // 마지막 컴파일·다시 로드가 가라앉을 때까지
    await page.waitForTimeout(3_000);
  } finally {
    await browser.close();
  }
}
