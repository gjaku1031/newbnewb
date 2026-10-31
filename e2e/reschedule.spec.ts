import { test, expect, waitForSaves, workspace } from "./fixtures";

/** 재배치: 수락한 변경을 캘린더에 반영 → 한 번만 */

test("재배치 제안을 반영하면 항목 날짜가 바뀌고 다시 누를 수 없다", async ({ page }) => {
  await page.goto("/reschedule");
  const before = await workspace(page);
  const proposal = before.reschedule!;
  test.skip(!proposal || !!proposal.appliedAt, "반영할 제안이 없음");

  await page.getByRole("button", { name: "선택한 변경 캘린더에 반영" }).click();
  await expect(page.getByRole("button", { name: "반영 완료" })).toBeDisabled();
  await waitForSaves(page);

  const after = await workspace(page);
  expect(after.reschedule!.appliedAt).toBeTruthy();
  const accepted = after.reschedule!.items.filter((c) => c.accepted);
  expect(accepted.length).toBeGreaterThan(0);
  for (const c of accepted) {
    const item = after.items.find((i) => i.id === c.itemId)!;
    expect(item.start?.slice(0, 10)).toBe(c.toDate);
  }
});
