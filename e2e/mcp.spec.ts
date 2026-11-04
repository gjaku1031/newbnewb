import { createHash, randomBytes } from "node:crypto";
import { test, expect } from "./fixtures";

/**
 * Claude Desktop 커스텀 커넥터가 하는 일을 그대로: 메타데이터 찾기 → 등록 → 승인 화면(Passkey 로그인 상태) → 토큰 → MCP 호출
 */

// 테스트용 콜백 주소는 실제 화면이 없어 404 — 그 콘솔 오류는 무시
test.use({ allowErrors: /404|oauth-test-callback/ });

const MCP_HEADERS = { "Content-Type": "application/json", Accept: "application/json, text/event-stream" };

test("Claude 연결: OAuth 승인 후 MCP 도구를 부른다", async ({ page, baseURL }) => {
  const callback = `${baseURL}/oauth-test-callback`;

  // 1) 토큰 없이 부르면 401 + 메타데이터 주소
  const anon = await page.request.post("/api/mcp", { headers: MCP_HEADERS, data: {}, failOnStatusCode: false });
  expect(anon.status()).toBe(401);
  expect(anon.headers()["www-authenticate"]).toContain(`resource_metadata="${baseURL}/.well-known/oauth-protected-resource/api/mcp"`);

  // 2) 메타데이터
  const prm = await (await page.request.get("/.well-known/oauth-protected-resource/api/mcp")).json();
  expect(prm).toMatchObject({ resource: `${baseURL}/api/mcp`, authorization_servers: [baseURL] });
  const asm = await (await page.request.get("/.well-known/oauth-authorization-server")).json();
  expect(asm).toMatchObject({ issuer: baseURL, code_challenge_methods_supported: ["S256"] });

  // 3) 등록 (허용하지 않은 콜백은 거절)
  const bad = await page.request.post(asm.registration_endpoint, { data: { redirect_uris: ["https://evil.example/cb"] }, failOnStatusCode: false });
  expect(bad.status()).toBe(400);
  const client = await (await page.request.post(asm.registration_endpoint, { data: { redirect_uris: [callback], client_name: "e2e Claude" } })).json();

  // 4) 승인 화면 → 허용 → 콜백으로 code·state·iss
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const authorize = new URL(asm.authorization_endpoint);
  for (const [k, v] of Object.entries({
    response_type: "code",
    client_id: client.client_id,
    redirect_uri: callback,
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "e2e-state",
    resource: prm.resource,
  }))
    authorize.searchParams.set(k, v);
  await page.goto(authorize.toString());
  await expect(page.getByText("e2e Claude이(가) newb에 연결하려고 해요")).toBeVisible();
  await page.getByRole("button", { name: "허용" }).click();
  await page.waitForURL((u) => u.pathname === "/oauth-test-callback");
  const back = new URL(page.url());
  expect(back.searchParams.get("state")).toBe("e2e-state");
  expect(back.searchParams.get("iss")).toBe(baseURL);
  const code = back.searchParams.get("code")!;

  // 5) 토큰
  const token = await (
    await page.request.post(asm.token_endpoint, {
      form: { grant_type: "authorization_code", code, redirect_uri: callback, client_id: client.client_id, code_verifier: verifier, resource: prm.resource },
    })
  ).json();
  expect(token.token_type).toBe("Bearer");
  const auth = { ...MCP_HEADERS, Authorization: `Bearer ${token.access_token}` };

  // 6) MCP: initialize → tools/list → tools/call
  const init = await (
    await page.request.post("/api/mcp", {
      headers: auth,
      data: { jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-06-18", capabilities: {}, clientInfo: { name: "e2e", version: "1" } } },
    })
  ).json();
  expect(init.result.serverInfo.name).toBe("newb");

  const list = await (await page.request.post("/api/mcp", { headers: auth, data: { jsonrpc: "2.0", id: 2, method: "tools/list" } })).json();
  expect(list.result.tools.map((t: { name: string }) => t.name).sort()).toEqual(["add_to_wiki", "ask_newb", "get_guidelines", "get_task_brief"]);

  const call = await (
    await page.request.post("/api/mcp", {
      headers: auth,
      data: { jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "get_guidelines", arguments: { query: "주간보고" } } },
    })
  ).json();
  expect(call.result.isError).toBeFalsy();
  expect(call.result.content[0].text).toContain(`${baseURL}/wiki/`);

  // 7) 설정에 연결 표시 → 연결 끊기 → 토큰 거절
  await page.goto("/settings#claude");
  await expect(page.getByText("e2e Claude")).toBeVisible();
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "연결 끊기" }).first().click();
  await expect(page.getByText("e2e Claude")).toHaveCount(0);
  const revoked = await page.request.post("/api/mcp", { headers: auth, data: { jsonrpc: "2.0", id: 4, method: "tools/list" }, failOnStatusCode: false });
  expect(revoked.status()).toBe(401);
});
