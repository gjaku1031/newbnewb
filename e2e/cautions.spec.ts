import { test, expect, waitForSaves, workspace } from "./fixtures";

/** 주의할 점: 추가 → 익혔어요(보관) / 다시 봤어요는 연달아 눌러도 한 번만 */

test("주의할 점을 추가하고 익혔어요로 보관한다", async ({ page }) => {
  const point = `e2e 주의 ${Date.now()}`;
  await page.goto("/wiki/cautions");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await page.getByLabel("주의할 점", { exact: true }).fill(point);
  await page.getByLabel("무엇이 문제였는지").fill("e2e에서 만든 실수");
  await page.getByRole("button", { name: "저장", exact: true }).click();
  await waitForSaves(page);

  const saved = (await workspace(page)).cautions.find((c) => c.point === point)!;
  expect(saved, "DB에 저장돼야 해요").toBeDefined();
  expect(saved.review.intervalDays).toBe(1);
  expect(saved.source.kind).toBe("manual");

  await page.reload();
  const card = page.locator(`[id="${saved.id}"]`);
  await expect(card).toContainText(point);
  await card.getByRole("button", { name: "익혔어요" }).click();
  await waitForSaves(page);
  expect((await workspace(page)).cautions.find((c) => c.id === saved.id)!.archived).toBe(true);
});

test("다시 봤어요를 빠르게 두 번 눌러도 간격은 한 번만 늘어난다", async ({ page }) => {
  await page.goto("/wiki/cautions");
  const ws = await workspace(page);
  const today = ws.now.slice(0, 10);
  const due = ws.cautions.find((c) => !c.archived && c.review.nextReview <= today);
  test.skip(!due, "오늘 다시 볼 주의할 점이 없음");

  const card = page.locator(`[id="${due!.id}"]`);
  await card.getByRole("button", { name: "다시 봤어요" }).dblclick();
  await waitForSaves(page);
  const after = (await workspace(page)).cautions.find((c) => c.id === due!.id)!;
  expect(after.review.intervalDays).toBe(Math.min(60, Math.max(1, due!.review.intervalDays * 2)));
});
