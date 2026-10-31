import { test, expect, waitForSaves, workspace } from "./fixtures";

/** 메모: 저장 → 서버가 처리(after) → 화면이 폴링으로 결과를 받음 → 만든 항목은 한 번만 */

test("메모를 남기면 Claude 정리 결과와 만든 일정이 나타나고, 끝나면 폴링이 멈춘다", async ({ page }) => {
  const text = `모레 2시 e2e 거래처 미팅 ${Date.now() % 10000}`;
  await page.goto("/memos");
  await page.getByPlaceholder("대충 적어두기").fill(text);
  await page.getByRole("button", { name: "메모", exact: true }).click();

  const card = page.locator("article").filter({ hasText: text });
  await expect(card).toBeVisible();
  // 처리 결과(일정 추가)가 폴링으로 들어온다
  await expect(card.getByText(/일정 추가/)).toBeVisible({ timeout: 20_000 });
  await waitForSaves(page);

  const ws = await workspace(page);
  const memo = ws.memos.find((m) => m.text === text)!;
  expect(memo.status).toBe("done");
  const ids = memo.result!.actions.filter((a) => a.kind === "create_event").map((a) => a.href!.split("/").pop());
  expect(ids).toHaveLength(1);
  expect(ws.items.filter((i) => i.id === ids[0])).toHaveLength(1);

  // 처리할 게 없으면 /api/workspace 폴링이 멈춘다
  let polls = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/workspace")) polls++;
  });
  await page.waitForTimeout(4_000);
  expect(polls).toBe(0);
});

test("빠른 메모 버튼으로 어느 화면에서든 메모한다 @mobile", async ({ page }) => {
  const text = `e2e 빠른 메모 ${Date.now()}`;
  await page.goto("/");
  await page.getByRole("button", { name: "빠른 메모" }).click();
  await page.getByPlaceholder("대충 적어두기").fill(text);
  await page.getByRole("button", { name: "메모", exact: true }).click();
  await waitForSaves(page);
  await expect.poll(async () => (await workspace(page)).memos.some((m) => m.text === text)).toBe(true);
});
