import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { getDb } from "@/server/db/client";
import { sessionPasskey } from "@/server/services/auth";

export interface SessionUser {
  id: string;
  name: string;
  /** 이 세션을 연 Passkey (개발용 자동 로그인이면 null) */
  passkeyId: string | null;
}

/** https면 __Host- 접두사(+Secure)로 하위 도메인·평문 HTTP에서 못 건드리게 */
export function sessionCookie() {
  const secure = (process.env.APP_ORIGIN ?? "").startsWith("https://");
  return { name: secure ? "__Host-newb_session" : "newb_session", secure };
}

/** next dev에서는 로그인된 것으로 본다 (NEWB_DEV_LOGIN=off면 실제 Passkey 로그인 — e2e가 이렇게 돈다) */
function devLogin() {
  return process.env.NODE_ENV === "development" && process.env.NEWB_DEV_LOGIN !== "off";
}

const readUser = cache(async (): Promise<SessionUser | null> => {
  if (devLogin()) return { id: "owner", name: "나", passkeyId: null };
  const token = (await cookies()).get(sessionCookie().name)?.value;
  const passkeyId = await sessionPasskey(getDb(), token);
  return passkeyId ? { id: "owner", name: "나", passkeyId } : null;
});

/**
 * 현재 로그인한 사용자 (1인용 앱이라 Passkey 세션이 있으면 주인).
 * 세션 쿠키 → DB의 auth_sessions 확인. 같은 요청 안에서는 한 번만 조회한다.
 */
export async function getCurrentUser(_request?: Request): Promise<SessionUser | null> {
  void _request;
  return readUser();
}
