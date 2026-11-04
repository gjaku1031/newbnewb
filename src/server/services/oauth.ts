import "server-only";
import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { and, asc, count, desc, eq, getTableColumns, gt, inArray, lt, lte, max, sql } from "drizzle-orm";
import { oauthClients, oauthCodes, oauthTokens } from "@/server/db/schema";
import type { Db, Exec } from "@/server/db/types";
import { affectedRows } from "./jobs";

/**
 * Claude Desktop(커스텀 커넥터)이 newb MCP에 붙기 위한 OAuth 2.1 인가 서버 (1인용).
 * - 클라이언트 동적 등록(RFC 7591): 콜백은 Claude 주소만 허용
 * - 승인 코드 + PKCE(S256), 코드는 5분·한 번
 * - 접근 토큰 1시간, 갱신 토큰 90일(쓸 때마다 새로 발급, 예전 것은 폐기)
 * - 토큰은 리소스(MCP 주소)에 묶고, DB에는 해시만
 */

export class OAuthError extends Error {
  constructor(
    readonly code: "invalid_request" | "invalid_client" | "invalid_grant" | "unsupported_grant_type" | "invalid_target" | "invalid_redirect_uri" | "invalid_client_metadata",
    message: string,
  ) {
    super(message);
  }
}

export interface OAuthConfig {
  issuer: string;
  /** MCP 엔드포인트 = 토큰이 쓰일 리소스 */
  resource: string;
}

export function oauthConfig(appOrigin = process.env.APP_ORIGIN): OAuthConfig {
  if (!appOrigin) throw new Error("APP_ORIGIN이 설정되지 않았어요");
  const origin = new URL(appOrigin).origin;
  return { issuer: origin, resource: `${origin}/api/mcp` };
}

/** Claude 커넥터 콜백 (claude.com으로 바뀔 수 있어 둘 다). 테스트용은 MCP_EXTRA_REDIRECT_URIS(쉼표) */
export function allowedRedirects() {
  const extra = (process.env.MCP_EXTRA_REDIRECT_URIS ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  return ["https://claude.ai/api/mcp/auth_callback", "https://claude.com/api/mcp/auth_callback", ...extra];
}

export const SCOPE = "newb";
const ACCESS_SECONDS = 60 * 60;
const REFRESH_DAYS = 90;
const CODE_MINUTES = 5;
const MAX_CLIENTS = 50;

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");
const token = () => randomBytes(32).toString("base64url");
const now = sql`CURRENT_TIMESTAMP(3)`;

/** 리소스 표기 차이(끝 슬래시)는 같은 것으로 */
const sameResource = (a: string, b: string) => a.replace(/\/+$/, "") === b.replace(/\/+$/, "");

/* ───────── 클라이언트 등록 ───────── */

export async function registerClient(db: Db, meta: { redirect_uris?: unknown; client_name?: unknown; token_endpoint_auth_method?: unknown }) {
  const uris = Array.isArray(meta.redirect_uris) ? meta.redirect_uris.filter((u): u is string => typeof u === "string") : [];
  if (uris.length === 0) throw new OAuthError("invalid_redirect_uri", "redirect_uris가 필요해요");
  const allowed = new Set(allowedRedirects());
  const bad = uris.filter((u) => !allowed.has(u));
  if (bad.length) throw new OAuthError("invalid_redirect_uri", `허용하지 않는 redirect_uri: ${bad.join(", ")}`);
  if (meta.token_endpoint_auth_method && meta.token_endpoint_auth_method !== "none")
    throw new OAuthError("invalid_client_metadata", "공개 클라이언트(token_endpoint_auth_method=none)만 등록할 수 있어요");

  // 등록이 쌓이면 토큰이 없는 오래된 것부터 정리
  const [{ n }] = await db.select({ n: count() }).from(oauthClients);
  if (n >= MAX_CLIENTS) {
    const used = db.selectDistinct({ id: oauthTokens.clientId }).from(oauthTokens);
    const stale = await db
      .select({ id: oauthClients.id })
      .from(oauthClients)
      .where(sql`${oauthClients.id} not in ${used}`)
      .orderBy(asc(oauthClients.createdAt))
      .limit(n - MAX_CLIENTS + 1);
    if (stale.length === 0) throw new OAuthError("invalid_request", "연결이 너무 많아요. 설정에서 안 쓰는 연결을 끊어 주세요");
    await db.delete(oauthClients).where(inArray(oauthClients.id, stale.map((s) => s.id)));
  }

  const id = `c_${randomBytes(16).toString("hex")}`;
  const name = typeof meta.client_name === "string" && meta.client_name.trim() ? meta.client_name.trim().slice(0, 200) : "Claude";
  await db.insert(oauthClients).values({ id, name, redirectUris: uris });
  return {
    client_id: id,
    client_id_issued_at: Math.floor(Date.now() / 1000),
    client_name: name,
    redirect_uris: uris,
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
    token_endpoint_auth_method: "none",
    scope: SCOPE,
  };
}

export async function getClient(db: Exec, id: string) {
  if (!id || id.length > 64) return undefined;
  const [c] = await db.select().from(oauthClients).where(eq(oauthClients.id, id));
  return c;
}

/* ───────── 승인 ───────── */

export interface AuthorizeRequest {
  clientId: string;
  clientName: string;
  redirectUri: string;
  codeChallenge: string;
  state?: string;
  scope?: string;
  resource?: string;
}

/**
 * /oauth/authorize 요청 확인.
 * client_id·redirect_uri가 틀리면 리다이렉트하지 않고 화면에 오류만 (남의 주소로 코드를 보내지 않게).
 * 그 밖의 오류는 { redirectError }로 — 클라이언트에 error=…로 돌려보낸다.
 */
export async function checkAuthorize(
  db: Exec,
  cfg: OAuthConfig,
  q: Record<string, string | undefined>,
): Promise<{ ok: AuthorizeRequest } | { fatal: string } | { redirectError: { redirectUri: string; state?: string; error: string; description: string } }> {
  const client = await getClient(db, q.client_id ?? "");
  if (!client) return { fatal: "등록되지 않은 연결 요청이에요 (client_id)." };
  if (!q.redirect_uri || !client.redirectUris.includes(q.redirect_uri)) return { fatal: "허용하지 않는 돌아갈 주소예요 (redirect_uri)." };
  const back = (error: string, description: string) => ({ redirectError: { redirectUri: q.redirect_uri!, state: q.state, error, description } });
  if (q.response_type !== "code") return back("unsupported_response_type", "response_type=code만 지원해요");
  if (!q.code_challenge || q.code_challenge_method !== "S256" || !/^[A-Za-z0-9_-]{43,128}$/.test(q.code_challenge))
    return back("invalid_request", "PKCE(S256)가 필요해요");
  if (q.resource && !sameResource(q.resource, cfg.resource)) return back("invalid_target", "알 수 없는 resource예요");
  return {
    ok: {
      clientId: client.id,
      clientName: client.name,
      redirectUri: q.redirect_uri,
      codeChallenge: q.code_challenge,
      state: q.state,
      scope: SCOPE,
      resource: cfg.resource,
    },
  };
}

/** 사용자가 허용 → 승인 코드 */
export async function createCode(db: Exec, r: AuthorizeRequest) {
  const code = token();
  await db.delete(oauthCodes).where(lte(oauthCodes.expiresAt, now));
  await db.insert(oauthCodes).values({
    codeHash: sha256(code),
    clientId: r.clientId,
    redirectUri: r.redirectUri,
    codeChallenge: r.codeChallenge,
    scope: r.scope ?? SCOPE,
    resource: r.resource,
    expiresAt: sql`CURRENT_TIMESTAMP(3) + INTERVAL ${sql.raw(String(CODE_MINUTES))} MINUTE`,
  });
  return code;
}

/** 돌려보낼 주소 (code·state·iss를 붙임) */
export function redirectWith(uri: string, params: Record<string, string | undefined>) {
  const url = new URL(uri);
  for (const [k, v] of Object.entries(params)) if (v !== undefined) url.searchParams.set(k, v);
  return url.toString();
}

/* ───────── 토큰 ───────── */

async function issue(db: Exec, clientId: string, grantId: string, scope: string, resource: string) {
  await db.delete(oauthTokens).where(lt(oauthTokens.expiresAt, now));
  const access = token();
  const refresh = token();
  await db.insert(oauthTokens).values([
    {
      tokenHash: sha256(access),
      kind: "access",
      grantId,
      clientId,
      scope,
      resource,
      expiresAt: sql`CURRENT_TIMESTAMP(3) + INTERVAL ${sql.raw(String(ACCESS_SECONDS))} SECOND`,
    },
    {
      tokenHash: sha256(refresh),
      kind: "refresh",
      grantId,
      clientId,
      scope,
      resource,
      expiresAt: sql`CURRENT_TIMESTAMP(3) + INTERVAL ${sql.raw(String(REFRESH_DAYS))} DAY`,
    },
  ]);
  return { access_token: access, token_type: "Bearer", expires_in: ACCESS_SECONDS, refresh_token: refresh, scope };
}

function pkceOk(verifier: string, challenge: string) {
  if (!/^[A-Za-z0-9._~-]{43,128}$/.test(verifier)) return false;
  const a = Buffer.from(createHash("sha256").update(verifier).digest("base64url"));
  const b = Buffer.from(challenge);
  return a.length === b.length && timingSafeEqual(a, b);
}

/** grant_type=authorization_code */
export async function exchangeCode(
  db: Db,
  cfg: OAuthConfig,
  p: { code?: string; redirect_uri?: string; client_id?: string; code_verifier?: string; resource?: string },
) {
  if (!p.code || !p.client_id || !p.redirect_uri || !p.code_verifier) throw new OAuthError("invalid_request", "code·client_id·redirect_uri·code_verifier가 필요해요");
  const hash = sha256(p.code);
  const [c] = await db
    .select({ ...getTableColumns(oauthCodes), live: sql<number>`${oauthCodes.expiresAt} > CURRENT_TIMESTAMP(3)` })
    .from(oauthCodes)
    .where(eq(oauthCodes.codeHash, hash));
  // 코드는 결과와 상관없이 먼저 지운다 (틀린 시도 뒤에도 다시 못 쓰게). 지운 쪽만 이어서 — 동시에 두 번 와도 한 번만
  const burned = c ? affectedRows(await db.delete(oauthCodes).where(eq(oauthCodes.codeHash, hash))) === 1 : false;
  if (!c || !burned || !Number(c.live)) throw new OAuthError("invalid_grant", "코드가 없거나 만료됐어요");
  if (c.clientId !== p.client_id || c.redirectUri !== p.redirect_uri) throw new OAuthError("invalid_grant", "코드를 받은 클라이언트·주소와 달라요");
  if (!pkceOk(p.code_verifier, c.codeChallenge)) throw new OAuthError("invalid_grant", "code_verifier가 맞지 않아요");
  if (p.resource && !sameResource(p.resource, cfg.resource)) throw new OAuthError("invalid_target", "알 수 없는 resource예요");
  return issue(db, c.clientId, randomBytes(16).toString("hex"), c.scope ?? SCOPE, c.resource ?? cfg.resource);
}

/** grant_type=refresh_token — 쓴 갱신 토큰은 폐기하고 새로 */
export async function refreshTokens(db: Db, cfg: OAuthConfig, p: { refresh_token?: string; client_id?: string; resource?: string }) {
  if (!p.refresh_token || !p.client_id) throw new OAuthError("invalid_request", "refresh_token·client_id가 필요해요");
  if (p.resource && !sameResource(p.resource, cfg.resource)) throw new OAuthError("invalid_target", "알 수 없는 resource예요");
  return db.transaction(async (tx) => {
    const hash = sha256(p.refresh_token!);
    const [t] = await tx
      .select()
      .from(oauthTokens)
      .where(and(eq(oauthTokens.tokenHash, hash), eq(oauthTokens.kind, "refresh"), gt(oauthTokens.expiresAt, now)))
      .for("update");
    if (!t || t.clientId !== p.client_id) throw new OAuthError("invalid_grant", "갱신 토큰이 없거나 만료됐어요");
    const used = await tx.delete(oauthTokens).where(eq(oauthTokens.tokenHash, hash));
    if (affectedRows(used) !== 1) throw new OAuthError("invalid_grant", "이미 쓴 갱신 토큰이에요");
    // 같은 승인의 예전 접근 토큰은 정리
    await tx.delete(oauthTokens).where(and(eq(oauthTokens.grantId, t.grantId), eq(oauthTokens.kind, "access")));
    return issue(tx, t.clientId, t.grantId, t.scope ?? SCOPE, t.resource ?? cfg.resource);
  });
}

/** MCP 요청의 Bearer 토큰 확인 → 유효하면 { clientId, grantId } */
export async function verifyAccessToken(db: Db, cfg: OAuthConfig, bearer: string | undefined) {
  if (!bearer || bearer.length > 200) return null;
  const hash = sha256(bearer);
  const [t] = await db
    .select({ clientId: oauthTokens.clientId, grantId: oauthTokens.grantId, resource: oauthTokens.resource, scope: oauthTokens.scope, lastUsedAt: oauthTokens.lastUsedAt })
    .from(oauthTokens)
    .where(and(eq(oauthTokens.tokenHash, hash), eq(oauthTokens.kind, "access"), gt(oauthTokens.expiresAt, now)));
  if (!t || (t.resource && !sameResource(t.resource, cfg.resource))) return null;
  // 마지막 사용 시각은 1분에 한 번만 기록
  await db
    .update(oauthTokens)
    .set({ lastUsedAt: now as unknown as string })
    .where(and(eq(oauthTokens.tokenHash, hash), sql`(${oauthTokens.lastUsedAt} is null or ${oauthTokens.lastUsedAt} < CURRENT_TIMESTAMP(3) - INTERVAL 1 MINUTE)`));
  return { clientId: t.clientId, grantId: t.grantId, scope: t.scope ?? SCOPE };
}

/* ───────── 연결 관리 (설정 화면) ───────── */

export interface Connection {
  grantId: string;
  clientName: string;
  connectedAt: string;
  lastUsedAt: string | null;
}

/** 살아 있는 연결(갱신 토큰이 유효한 승인)별 이름·연결 시각·마지막 사용 */
export async function listConnections(db: Exec): Promise<Connection[]> {
  const rows = await db
    .select({
      grantId: oauthTokens.grantId,
      clientName: oauthClients.name,
      connectedAt: sql<string>`min(${oauthTokens.createdAt})`,
      lastUsedAt: max(oauthTokens.lastUsedAt),
    })
    .from(oauthTokens)
    .innerJoin(oauthClients, eq(oauthClients.id, oauthTokens.clientId))
    .where(gt(oauthTokens.expiresAt, now))
    .groupBy(oauthTokens.grantId, oauthClients.name)
    .orderBy(desc(max(oauthTokens.lastUsedAt)));
  return rows.map((r) => ({ ...r, lastUsedAt: r.lastUsedAt ?? null }));
}

/** 연결 끊기 — 그 승인의 토큰을 모두 폐기 */
export async function revokeConnection(db: Exec, grantId: string) {
  await db.delete(oauthTokens).where(eq(oauthTokens.grantId, grantId));
}
