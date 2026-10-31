import { test, expect, waitForSaves, workspace } from "./fixtures";

/** 항목: 만들기 → DB에 남음 → 완료 → 삭제 */

test("새 할 일을 만들고, 완료하고, 지운다", async ({ page }) => {
  const title = `e2e 할 일 ${Date.now()}`;
  await page.goto("/tasks");

  await page.getByRole("button", { name: "새 항목", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "새 항목" });
  await dialog.getByLabel("제목").fill(title);
  await dialog.getByRole("button", { name: "만들기" }).click();

  // 만들면 바로 상세 패널이 열린다
  const panel = page.getByRole("dialog", { name: title });
  await expect(panel).toBeVisible();
  await waitForSaves(page);

  // DB에 저장됐다
  const saved = (await workspace(page)).items.find((i) => i.title === title);
  expect(saved, "DB에 새 항목이 있어야 해요").toBeDefined();

  // 진행 상태를 완료로 → 새로고침해도 완료 (완료 항목은 목록에서 숨겨지므로 주소로 패널을 연다)
  const doneChip = panel.locator("dl").getByRole("button", { name: "완료" });
  await doneChip.click();
  await expect(doneChip).toHaveAttribute("aria-pressed", "true");
  await waitForSaves(page);
  await page.goto(`/tasks?item=${saved!.id}`);
  await expect(doneChip).toHaveAttribute("aria-pressed", "true");

  // 삭제 (두 번 눌러 확인) → DB에서도 없음
  await panel.getByRole("button", { name: "삭제" }).click();
  await panel.getByRole("button", { name: "정말 삭제" }).click();
  await expect(panel).toBeHidden();
  await waitForSaves(page);
  expect((await workspace(page)).items.some((i) => i.title === title)).toBe(false);
});

test("어느 화면에서든 ?item= 으로 항목 패널이 열리고, 옛 /items 주소는 패널로 넘어간다 @mobile", async ({ page }) => {
  await page.goto("/items/i1");
  await expect(page).toHaveURL(/\/tasks\?item=i1/);
  const close = page.getByRole("dialog").getByRole("button", { name: "닫기" });
  await expect(close.first()).toBeVisible();
  await close.first().click();
  await expect(page).not.toHaveURL(/item=/);
});
