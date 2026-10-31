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

/** Route Handler용: 로그인 안 했으면 401, 했으면 handler 실행 */
export async function withUser(request: Request, handler: () => Promise<Response>): Promise<Response> {
  if (!(await getCurrentUser(request))) return Response.json({ error: new UnauthorizedError().message }, { status: 401 });
  return handler();
}
