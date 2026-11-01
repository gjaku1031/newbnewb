import { test, expect } from "./fixtures";
import { addVirtualAuthenticator } from "./passkey";

// 로그인하지 않은 브라우저로 시작 (다른 테스트는 global-setup의 세션을 쓴다)
test.use({ storageState: { cookies: [], origins: [] } });

test("로그인하지 않으면 로그인 화면만 보이고 데이터는 나가지 않는다", async ({ page }) => {
  await page.goto("/tasks");
  await expect(page.getByRole("button", { name: "Passkey로 로그인" })).toBeVisible();
  await expect(page.getByRole("link", { name: "설정" })).toHaveCount(0);
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
});

test("잘못된 초대 링크로는 Passkey를 만들 수 없다", async ({ page }) => {
  await addVirtualAuthenticator(page);
  await page.goto("/?invite=not-a-real-invite-token-0000");
  await page.getByRole("button", { name: "이 기기에 Passkey 만들기" }).click();
  await expect(page.getByText("초대 링크가 없거나")).toBeVisible();
  expect((await page.request.get("/api/workspace")).status()).toBe(401);
});

test("초대 링크로 Passkey를 만들고, 로그아웃 뒤 그 Passkey로 다시 로그인한다", async ({ page, browser, baseURL }) => {
  const invite = process.env.E2E_INVITE!;
  expect(invite, "global-setup이 초대를 만들어야 해요").toBeTruthy();
  await addVirtualAuthenticator(page);

  // 1) 초대 링크로 등록 → 바로 로그인, 주소에서 초대 토큰이 사라진다
  await page.goto(`/?invite=${invite}`);
  await page.getByRole("button", { name: "이 기기에 Passkey 만들기" }).click();
  await expect(page.getByRole("link", { name: "설정" }).first()).toBeVisible();
  expect(new URL(page.url()).searchParams.has("invite")).toBe(false);
  expect((await page.request.get("/api/workspace")).status()).toBe(200);

  // 2) 같은 초대는 다시 쓸 수 없다 (다른 브라우저에서)
  const other = await browser.newContext({ storageState: { cookies: [], origins: [] } });
  const otherPage = await other.newPage();
  await otherPage.goto(`${baseURL}/?invite=${invite}`);
  await otherPage.getByRole("button", { name: "이 기기에 Passkey 만들기" }).click();
  await expect(otherPage.getByText("이미 쓰였거나")).toBeVisible();
  await other.close();

  // 3) 설정: 이 로그인에 쓴 Passkey는 지울 수 없게 표시
  await page.goto("/settings");
  const current = page.getByRole("listitem").filter({ hasText: "지금 이 로그인" });
  await expect(current).toHaveCount(1);
  await expect(current.getByRole("button", { name: /Passkey 삭제/ })).toBeDisabled();

  // 4) 로그아웃 → 로그인 화면 → Passkey로 다시 로그인
  await page.getByRole("button", { name: "로그아웃" }).click();
  await expect(page.getByRole("button", { name: "Passkey로 로그인" })).toBeVisible();
  expect((await page.request.get("/api/workspace")).status()).toBe(401);

  await page.getByRole("button", { name: "Passkey로 로그인" }).click();
  await expect(page.getByRole("link", { name: "설정" }).first()).toBeVisible();
  expect((await page.request.get("/api/workspace")).status()).toBe(200);
});
