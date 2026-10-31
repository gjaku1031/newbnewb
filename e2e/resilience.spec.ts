import { test, expect, waitForSaves, workspace } from "./fixtures";

/** 저장 실패·느린 응답에서도 화면과 DB가 어긋나지 않는다 */

test.describe("저장 실패", () => {
  test.use({ allowErrors: /저장 실패|Failed to fetch|net::ERR_FAILED|Failed to load resource/ });

  test("서버 저장이 실패하면 오류를 보여주고 화면을 서버 값으로 되돌린다", async ({ page }) => {
    const title = `e2e 실패 ${Date.now()}`;
    await page.goto("/tasks");
    // 서버 액션(POST + next-action 헤더)만 실패시킨다
    await page.route("**/*", (route) => {
      const req = route.request();
      if (req.method() === "POST" && req.headers()["next-action"]) return route.abort("failed");
      return route.continue();
    });

    await page.getByRole("button", { name: "새 항목", exact: true }).click();
    await page.getByRole("dialog", { name: "새 항목" }).getByLabel("제목").fill(title);
    await page.getByRole("dialog", { name: "새 항목" }).getByRole("button", { name: "만들기" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "저장하지 못했어요" })).toBeVisible();
    // 되돌린 뒤엔 화면에도 DB에도 없다
    await expect(page.getByText(title)).toHaveCount(0, { timeout: 10_000 });
    expect((await workspace(page)).items.some((i) => i.title === title)).toBe(false);
  });
});

test("다시 불러오는 사이에 만든 항목이 늦게 온 옛 스냅샷에 덮어써지지 않는다", async ({ page }) => {
  const title = `e2e 경쟁 ${Date.now()}`;
  await page.goto("/tasks");
  await expect(page.getByRole("button", { name: "새 항목", exact: true })).toBeVisible();

  // /api/workspace 응답을 3초 늦춘다 (그 사이에 항목을 만든다)
  await page.route("**/api/workspace", async (route) => {
    const res = await route.fetch();
    await new Promise((r) => setTimeout(r, 3_000));
    await route.fulfill({ response: res });
  });
  // 창으로 돌아온 것처럼 포커스 이벤트를 보낸다 (포커스 새로고침은 5초에 한 번이라 요청이 나갈 때까지 반복)
  const refreshing = page.waitForRequest("**/api/workspace", { timeout: 20_000 });
  const poke = setInterval(() => void page.evaluate(() => window.dispatchEvent(new Event("focus"))).catch(() => {}), 1_000);
  try {
    await refreshing;
  } finally {
    clearInterval(poke);
  }

  await page.getByRole("button", { name: "새 항목", exact: true }).click();
  await page.getByRole("dialog", { name: "새 항목" }).getByLabel("제목").fill(title);
  await page.getByRole("dialog", { name: "새 항목" }).getByRole("button", { name: "만들기" }).click();
  const panel = page.getByRole("dialog", { name: title });
  await expect(panel).toBeVisible();
  await waitForSaves(page);

  // 늦은 응답(항목이 없던 시점)이 도착한 뒤에도 그대로 있어야 한다
  await page.waitForTimeout(4_000);
  await expect(panel).toBeVisible();
  expect((await workspace(page)).items.some((i) => i.title === title)).toBe(true);
});
