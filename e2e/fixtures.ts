import { test as base, expect, type Page } from "@playwright/test";
import type { WorkspaceSnapshot } from "../src/lib/workspace";

/**
 * 공통 fixture: 페이지 오류·콘솔 오류를 모아 두었다가 테스트 끝에 없는지 확인한다.
 * 개발 서버 특유의 소음(HMR 연결 등)과, 테스트가 일부러 낸 오류(allowErrors)는 거른다.
 */
const IGNORED = [/\[HMR\]/, /webpack-hmr/, /Download the React DevTools/, /\/api\/agentation/];

export const test = base.extend<{ errors: string[]; allowErrors: RegExp | null; trackSaves: void }>({
  /** 테스트가 일부러 낸 오류 (test.use({ allowErrors: /…/ })) */
  allowErrors: [null, { option: true }],
  errors: [
    async ({ page, allowErrors }, use) => {
      const errors: string[] = [];
      const ignored = allowErrors ? [...IGNORED, allowErrors] : IGNORED;
      page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
      page.on("console", (msg) => {
        if (msg.type() !== "error") return;
        const text = msg.text();
        if (ignored.some((re) => re.test(text) || re.test(msg.location().url))) return;
        errors.push(`console: ${text}`);
      });
      await use(errors);
      expect(errors, "브라우저 오류가 없어야 해요").toEqual([]);
    },
    { auto: true },
  ],
  /** 모든 페이지에 서버 액션 요청 수를 세는 스크립트를 심는다 (waitForSaves용) */
  trackSaves: [
    async ({ page }, use) => {
      await page.addInitScript(trackActions);
      await use();
    },
    { auto: true },
  ],
});

export { expect };

/**
 * 화면은 먼저 바뀌고 서버 저장(서버 액션 POST)은 뒤따른다.
 * 새로고침으로 DB에 남았는지 보기 전에, 진행 중인 서버 액션이 모두 끝날 때까지 기다린다.
 */
export async function waitForSaves(page: Page) {
  await page.waitForFunction(() => (window as unknown as { __pendingActions?: number }).__pendingActions === 0, null, {
    timeout: 15_000,
  });
}

/** 지금 DB에 저장된 작업공간 (화면이 아니라 서버 값) */
export async function workspace(page: Page): Promise<WorkspaceSnapshot> {
  const res = await page.request.get("/api/workspace");
  expect(res.ok()).toBe(true);
  return res.json();
}

/** 서버 액션 요청 수를 세는 스크립트 — 모든 페이지에 미리 심는다 */
const trackActions = `
  (() => {
    const w = window;
    w.__pendingActions = 0;
    const orig = w.fetch.bind(w);
    w.fetch = async (input, init) => {
      const headers = new Headers(init?.headers ?? (input instanceof Request ? input.headers : undefined));
      const isAction = headers.has("next-action");
      if (isAction) w.__pendingActions++;
      try {
        return await orig(input, init);
      } finally {
        if (isAction) w.__pendingActions--;
      }
    };
  })();
`;
