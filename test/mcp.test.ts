import { createHash } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { oauthClients, oauthTokens, questions, sources } from "@/server/db/schema";
import * as oauth from "@/server/services/oauth";
import { addToWiki, askNewb, guidelines, taskBrief } from "@/server/mcp/tools";
import { listItems } from "@/server/services/items";
import { listWiki } from "@/server/services/wiki";
import { seedDemo } from "./fixtures/seed";
import { testDb } from "./db";

/** Claude Desktop 연결: OAuth 인가 서버 + MCP 도구 (가짜 Claude 서버) */

const { db, close } = testDb();
afterAll(close);
beforeEach(async () => {
  await seedDemo(db, { force: true });
  await db.delete(oauthClients);
});

const cfg = oauth.oauthConfig("https://newb.example.com");
const CALLBACK = "https://claude.ai/api/mcp/auth_callback";
const verifier = "v".repeat(43) + "erifier-0123456789";
const challenge = createHash("sha256").update(verifier).digest("base64url");

async function authorizedCode() {
  const client = await oauth.registerClient(db, { redirect_uris: [CALLBACK], client_name: "Claude" });
  const checked = await oauth.checkAuthorize(db, cfg, {
    client_id: client.client_id,
    redirect_uri: CALLBACK,
    response_type: "code",
    code_challenge: challenge,
    code_challenge_method: "S256",
    state: "st",
    resource: cfg.resource,
  });
  if (!("ok" in checked)) throw new Error("승인 요청이 거절됨");
  return { client, code: await oauth.createCode(db, checked.ok) };
}

describe("OAuth 인가 서버", () => {
  it("클라이언트 등록: Claude 콜백만 받고, 공개 클라이언트로 등록한다", async () => {
    await expect(oauth.registerClient(db, { redirect_uris: ["https://evil.example/cb"] })).rejects.toThrow("허용하지 않는");
    await expect(oauth.registerClient(db, {})).rejects.toThrow("redirect_uris");
    await expect(oauth.registerClient(db, { redirect_uris: [CALLBACK], token_endpoint_auth_method: "client_secret_basic" })).rejects.toThrow("공개 클라이언트");
    const c = await oauth.registerClient(db, { redirect_uris: [CALLBACK, "https://claude.com/api/mcp/auth_callback"], client_name: "Claude" });
    expect(c).toMatchObject({ client_name: "Claude", token_endpoint_auth_method: "none", grant_types: ["authorization_code", "refresh_token"] });
  });

  it("승인 요청 확인: client_id·redirect_uri가 틀리면 돌려보내지 않고, PKCE·resource가 틀리면 오류로 돌려보낸다", async () => {
    const c = await oauth.registerClient(db, { redirect_uris: [CALLBACK] });
    const base = { client_id: c.client_id, redirect_uri: CALLBACK, response_type: "code", code_challenge: challenge, code_challenge_method: "S256" };
    expect(await oauth.checkAuthorize(db, cfg, { ...base, client_id: "nope" })).toHaveProperty("fatal");
    expect(await oauth.checkAuthorize(db, cfg, { ...base, redirect_uri: "https://claude.ai/other" })).toHaveProperty("fatal");
    expect(await oauth.checkAuthorize(db, cfg, { ...base, code_challenge_method: "plain" })).toMatchObject({ redirectError: { error: "invalid_request" } });
    expect(await oauth.checkAuthorize(db, cfg, { ...base, resource: "https://other.example/mcp" })).toMatchObject({ redirectError: { error: "invalid_target" } });
    expect(await oauth.checkAuthorize(db, cfg, { ...base, resource: `${cfg.resource}/` })).toHaveProperty("ok");
  });

  it("코드 교환: PKCE가 맞아야 하고, 코드는 한 번만 (틀려도 버려진다)", async () => {
    const { client, code } = await authorizedCode();
    const p = { code, client_id: client.client_id, redirect_uri: CALLBACK };
    await expect(oauth.exchangeCode(db, cfg, { ...p, code_verifier: "w".repeat(50) })).rejects.toThrow("code_verifier");
    // 틀린 시도로 코드가 이미 버려졌다
    await expect(oauth.exchangeCode(db, cfg, { ...p, code_verifier: verifier })).rejects.toThrow("만료");

    const again = await authorizedCode();
    const t = await oauth.exchangeCode(db, cfg, { code: again.code, client_id: again.client.client_id, redirect_uri: CALLBACK, code_verifier: verifier });
    expect(t).toMatchObject({ token_type: "Bearer", expires_in: 3600, scope: "newb" });
    await expect(
      oauth.exchangeCode(db, cfg, { code: again.code, client_id: again.client.client_id, redirect_uri: CALLBACK, code_verifier: verifier }),
    ).rejects.toThrow("만료");
    // DB에는 토큰 원문이 없다
    const rows = await db.select().from(oauthTokens);
    expect(rows.some((r) => r.tokenHash === t.access_token || r.tokenHash === t.refresh_token)).toBe(false);
  });

  it("토큰 확인·갱신(회전)·리소스 묶기·연결 끊기", async () => {
    const { client, code } = await authorizedCode();
    const t = await oauth.exchangeCode(db, cfg, { code, client_id: client.client_id, redirect_uri: CALLBACK, code_verifier: verifier });
    expect(await oauth.verifyAccessToken(db, cfg, t.access_token)).toMatchObject({ clientId: client.client_id });
    expect(await oauth.verifyAccessToken(db, oauth.oauthConfig("https://other.example.com"), t.access_token)).toBeNull();
    expect(await oauth.verifyAccessToken(db, cfg, "bogus")).toBeNull();

    const t2 = await oauth.refreshTokens(db, cfg, { refresh_token: t.refresh_token, client_id: client.client_id });
    expect(t2.refresh_token).not.toBe(t.refresh_token);
    await expect(oauth.refreshTokens(db, cfg, { refresh_token: t.refresh_token, client_id: client.client_id })).rejects.toThrow("갱신 토큰");
    expect(await oauth.verifyAccessToken(db, cfg, t.access_token)).toBeNull(); // 예전 접근 토큰도 정리
    expect(await oauth.verifyAccessToken(db, cfg, t2.access_token)).toBeTruthy();

    const [conn] = await oauth.listConnections(db);
    expect(conn).toMatchObject({ clientName: "Claude" });
    expect(conn.lastUsedAt).toBeTruthy();
    await oauth.revokeConnection(db, conn.grantId);
    expect(await oauth.verifyAccessToken(db, cfg, t2.access_token)).toBeNull();
    expect(await oauth.listConnections(db)).toEqual([]);
  });

  it("만료된 접근 토큰은 거절", async () => {
    const { client, code } = await authorizedCode();
    const t = await oauth.exchangeCode(db, cfg, { code, client_id: client.client_id, redirect_uri: CALLBACK, code_verifier: verifier });
    await db.update(oauthTokens).set({ expiresAt: "2020-01-01 00:00:00.000" }).where(eq(oauthTokens.kind, "access"));
    expect(await oauth.verifyAccessToken(db, cfg, t.access_token)).toBeNull();
  });
});

describe("MCP 도구", () => {
  it("ask_newb: 위키 근거로 답하고 질문 기록에 남긴다", async () => {
    const r = await askNewb(db, { question: "주간보고는 언제까지 내요?" });
    expect(r.record.verdict).toBe("ANSWER");
    expect(r.record.citations.length).toBe(1);
    expect(r.text).toContain("/wiki/");
    expect(r.text).toContain(`/questions/${r.record.id}`);
    const [row] = await db.select().from(questions).where(eq(questions.id, r.record.id));
    expect(row).toMatchObject({ question: "주간보고는 언제까지 내요?", verdict: "ANSWER", status: "resolved" });
  });

  it("ask_newb: 근거가 없으면 누구에게 무엇을 물어볼지와 함께 '열린 질문'으로", async () => {
    const r = await askNewb(db, { question: "우주선 발사 절차" });
    expect(r.record).toMatchObject({ verdict: "NEED_INFO", status: "open" });
    expect(r.text).toContain("팀장님");
    expect(r.text).toContain("이렇게 물어보세요");
  });

  it("get_task_brief: id 없으면 할 일 목록, 있으면 지침·하위 항목·관련 위키", async () => {
    expect(await taskBrief(db, {})).toContain("아직 안 끝난 할 일");
    const item = (await listItems(db)).find((i) => i.kind === "task" && i.wikiRefs.length > 0)!;
    const text = await taskBrief(db, { item_id: item.id });
    expect(text).toContain(`# ${item.title}`);
    expect(text).toContain("## 관련 위키");
    expect(await taskBrief(db, { item_id: "nope" })).toContain("찾지 못했어요");
  });

  it("get_guidelines: 위키 전문과 링크, 없으면 안내", async () => {
    const text = await guidelines(db, { query: "주간보고" });
    expect(text).toContain("/wiki/");
    expect(await guidelines(db, { query: "존재하지않는낱말" })).toContain("찾지 못했어요");
  });

  it("add_to_wiki: 메모 원본으로 남기고 위키로 정리한다", async () => {
    const before = (await listWiki(db)).pages.length;
    const text = await addToWiki(db, { title: "택배 보내는 법", content: "택배는 1층 우편실에서 오후 4시까지 접수" });
    expect(text).toContain("새 페이지");
    expect((await listWiki(db)).pages.length).toBe(before + 1);
    const [src] = await db.select().from(sources).where(eq(sources.title, "택배 보내는 법"));
    expect(src).toMatchObject({ type: "note", fileType: "text", wikiStatus: "done" });
  });
});
