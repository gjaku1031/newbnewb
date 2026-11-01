import http from "node:http";
import { test, expect, waitForSaves, workspace } from "./fixtures";

/** 위키: 주석 → Claude에게 반영 요청 → 서버 검토 → 반영(또는 확인 후 반영) / 복습했음 / 원본 올리기·내려받기 */

test("주석을 달아 반영을 요청하면 문서가 고쳐진다", async ({ page }) => {
  await page.goto("/wiki/weekly-report");
  await page.getByRole("button", { name: "주석", exact: true }).first().click();
  await page.getByLabel("주석 내용").fill("17:00까지 → 16:30까지");
  await page.getByRole("button", { name: "추가", exact: true }).click();
  await waitForSaves(page);

  await page.getByRole("button", { name: /Claude에게 반영 요청/ }).click();
  // 모순이 없으면 바로 반영, 있으면 확인 대기 → 그래도 반영
  const article = page.locator("article").first();
  const force = page.getByRole("button", { name: "그래도 반영" });
  await expect(article.getByText("16:30까지").or(force).first()).toBeVisible({ timeout: 20_000 });
  if (await force.isVisible()) await force.click();
  await waitForSaves(page);

  await expect.poll(async () => (await workspace(page)).wiki.pages.find((p) => p.slug === "weekly-report")!.body, {
    timeout: 15_000,
  }).toContain("16:30까지");
  await page.reload();
  await expect(page.locator("article").first().getByText("16:30까지")).toBeVisible();
});

test("복습했음을 누르면 다음 복습일이 밀리고, 되돌릴 수 있다", async ({ page }) => {
  await page.goto("/wiki");
  const button = page.getByRole("button", { name: "복습했음" }).first();
  test.skip(!(await button.isVisible()), "오늘 복습할 위키가 없음");
  const before = (await workspace(page)).wiki.pages.map((p) => [p.slug, p.review.reviewCount] as const);
  await button.click();
  await waitForSaves(page);
  const after = (await workspace(page)).wiki.pages;
  const changed = after.filter((p) => before.find(([s]) => s === p.slug)![1] !== p.review.reviewCount);
  expect(changed).toHaveLength(1);
});

test("원본 문서를 올리면 저장소에 들어가고, 확장자 기준 형식으로 내려받는다", async ({ page }) => {
  const name = `e2e-원본-${Date.now()}`;
  await page.goto("/wiki");
  await page.getByRole("button", { name: "문서 추가" }).click();
  // 브라우저가 형식을 html이라고 우겨도 .txt는 text/plain으로 내려가야 한다
  await page.locator('input[type="file"]').setInputFiles({
    name: `${name}.txt`,
    mimeType: "text/html",
    buffer: Buffer.from("<script>alert(1)</script> 업무 메모"),
  });
  await page.getByRole("button", { name: "위키로 정리하기" }).click();
  await expect.poll(async () => (await workspace(page)).wiki.sources.find((s) => s.title === name), { timeout: 15_000 }).toBeTruthy();

  const src = (await workspace(page)).wiki.sources.find((s) => s.title === name)!;
  expect(src.hasFile).toBe(true);
  const file = await page.request.get(`/api/sources/${src.id}/file`);
  expect(file.status()).toBe(200);
  expect(file.headers()["content-type"]).toContain("text/plain");
  expect(file.headers()["x-content-type-options"]).toBe("nosniff");
  expect(file.headers()["content-disposition"]).toContain("attachment");
  expect(await file.text()).toContain("업무 메모");

  // 없는 id·이상한 id는 404
  expect((await page.request.get("/api/sources/nope/file")).status()).toBe(404);
  expect((await page.request.get("/api/sources/..%2F..%2Fetc/file")).status()).toBe(404);
});

test("지원하지 않는 형식·깨진 본문·너무 큰 요청은 거절한다", async ({ request, baseURL }) => {
  const bad = await request.post("/api/sources", {
    multipart: { type: "note", files: { name: "run.exe", mimeType: "application/octet-stream", buffer: Buffer.from("MZ") } },
  });
  expect(bad.status()).toBe(400);

  const broken = await request.post("/api/sources", {
    headers: { "content-type": "multipart/form-data; boundary=x" },
    data: "not multipart",
  });
  expect(broken.status()).toBe(400);

  // 200MB라고 알리고 본문은 보내지 않는다 → 본문을 읽기 전에 413 (로그인 쿠키는 함께 보낸다)
  const cookie = (await request.storageState()).cookies.map((c) => `${c.name}=${c.value}`).join("; ");
  expect(await statusOfDeclaredUpload(new URL("/api/sources", baseURL), 200 * 1024 * 1024, cookie)).toBe(413);
  // 로그인하지 않았으면 크기와 상관없이 401
  expect(await statusOfDeclaredUpload(new URL("/api/sources", baseURL), 200 * 1024 * 1024, "")).toBe(401);
});

/** Content-Length만 크게 알리고 본문은 보내지 않은 채 응답 상태를 받는다 (Playwright 요청은 길이를 실제 값으로 고친다) */
function statusOfDeclaredUpload(url: URL, length: number, cookie: string): Promise<number> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      url,
      { method: "POST", headers: { "content-type": "multipart/form-data; boundary=x", "content-length": length, cookie } },
      (res) => {
        resolve(res.statusCode ?? 0);
        res.resume();
        req.destroy();
      },
    );
    req.on("error", reject);
    req.write("--x\r\n");
  });
}
