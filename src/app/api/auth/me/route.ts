import { getCurrentUser } from "@/lib/auth";

/** 로그인 여부 확인 (클라이언트에서 로그인 전용 UI를 띄울지 판단할 때 사용) */
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return Response.json({ user: null }, { status: 401 });
  return Response.json({ user });
}
