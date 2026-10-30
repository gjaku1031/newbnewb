import "server-only";
import { getCurrentUser } from "@/lib/auth";

export class UnauthorizedError extends Error {
  constructor() {
    super("로그인이 필요해요");
  }
}

/** 서버 액션·API 첫 줄에서 부른다. 로그인 안 했으면 아무것도 하지 않고 실패 */
export async function requireUser(request?: Request) {
  const user = await getCurrentUser(request);
  if (!user) throw new UnauthorizedError();
  return user;
}
