import { connection } from "next/server";
import { getDb } from "@/server/db/client";
import { OAuthError, registerClient } from "@/server/services/oauth";

/** 클라이언트 동적 등록 (RFC 7591) — 콜백은 Claude 주소만 받는다 */
export async function POST(request: Request) {
  await connection();
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "invalid_client_metadata", error_description: "JSON 본문이 필요해요" }, { status: 400 });
  }
  try {
    return Response.json(await registerClient(getDb(), body), { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof OAuthError) return Response.json({ error: error.code, error_description: error.message }, { status: 400 });
    throw error;
  }
}
