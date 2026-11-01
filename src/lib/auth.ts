import "server-only";

export interface SessionUser {
  id: string;
  name: string;
}

/**
 * 현재 로그인한 사용자.
 *
 * TODO(Passkey): 0단계에서 Passkey(WebAuthn) 로그인이 붙으면 세션 쿠키를 검증하도록 교체.
 * 지금은 로그인 기능이 없어서:
 *  - 개발 모드(next dev): 1인용 목 사용자로 로그인된 것으로 간주
 *  - 프로덕션: 항상 비로그인 → 로그인 전용 기능(주석 툴바 등)이 열리지 않음 (안전한 기본값)
 */
export async function getCurrentUser(_request?: Request): Promise<SessionUser | null> {
  void _request;
  if (process.env.NODE_ENV === "development") {
    return { id: "me", name: "개발용 사용자" };
  }
  return null;
}
