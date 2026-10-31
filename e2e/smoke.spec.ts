import { test, expect } from "./fixtures";

/** 모든 화면이 DB 데이터로 오류 없이 열린다 */
const PAGES: { path: string; heading: RegExp | string }[] = [
  { path: "/", heading: /\d+월 \d+일/ },
  { path: "/tasks", heading: /작업/ },
  { path: "/wiki", heading: /위키/ },
  { path: "/wiki/cautions", heading: /주의할 점/ },
  { path: "/memos", heading: /메모/ },
  { path: "/questions", heading: /질문 기록/ },
  { path: "/reschedule", heading: /재배치/ },
  { path: "/settings", heading: /설정/ },
];

for (const { path, heading } of PAGES) {
  test(`${path} 화면이 열린다 @mobile`, async ({ page }) => {
    const res = await page.goto(path);
    expect(res?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 }).first()).toContainText(heading);
  });
}

test("헬스 체크가 DB·저장소 모두 정상", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toEqual({ status: "ok", checks: { db: "ok", storage: "ok" } });
});

test("작업공간 스냅샷에 서버 전용 정보(사람 이름·내부 메모)가 없다", async ({ request }) => {
  const res = await request.get("/api/workspace");
  expect(res.status()).toBe(200);
  const body = await res.text();
  // 시드의 사람 이름(src/mocks/wikiInternal.ts)은 DB에만 있고 화면으로 나가면 안 된다
  for (const name of ["박지훈", "김서연", "이민호"]) {
    expect(body, `${name}이(가) 스냅샷에 있으면 안 돼요`).not.toContain(name);
  }
});
