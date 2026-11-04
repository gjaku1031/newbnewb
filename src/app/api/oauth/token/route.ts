import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { exchangeCode, OAuthError, oauthConfig, refreshTokens } from "@/server/services/oauth";

/** 토큰 발급 (승인 코드 + PKCE, 갱신 토큰). 본문은 application/x-www-form-urlencoded */
export async function POST(request: Request) {
  await connection();
  const noStore = { "Cache-Control": "no-store", Pragma: "no-cache" };
  let form: URLSearchParams;
  try {
    const type = request.headers.get("content-type") ?? "";
    form = type.includes("application/json")
      ? new URLSearchParams(Object.entries((await request.json()) as Record<string, string>))
      : new URLSearchParams(await request.text());
  } catch {
    return Response.json({ error: "invalid_request" }, { status: 400, headers: noStore });
  }
  const p = Object.fromEntries(form) as Record<string, string | undefined>;
  try {
    const db = getDb();
    const cfg = oauthConfig();
    if (p.grant_type === "authorization_code") return Response.json(await exchangeCode(db, cfg, p), { headers: noStore });
    if (p.grant_type === "refresh_token") return Response.json(await refreshTokens(db, cfg, p), { headers: noStore });
    throw new OAuthError("unsupported_grant_type", "authorization_code·refresh_token만 지원해요");
  } catch (error) {
    if (error instanceof OAuthError)
      return Response.json({ error: error.code, error_description: error.message }, { status: 400, headers: noStore });
    throw error;
  }
}
