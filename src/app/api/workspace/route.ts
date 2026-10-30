import { after, connection } from "next/server";
import { requireUser, UnauthorizedError } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { loadWorkspace } from "@/server/services/workspace";
import { resumeStalledReviews } from "@/server/services/wiki";
import { resumeStalledMemos } from "@/server/services/memos";

/** 작업공간 스냅샷 — 화면이 처리 중인 일을 기다리거나 다시 불러올 때 */
export async function GET(request: Request) {
  await connection();
  try {
    await requireUser(request);
  } catch (error) {
    if (error instanceof UnauthorizedError) return Response.json({ error: error.message }, { status: 401 });
    throw error;
  }
  const db = getDb();
  // 서버 재시작 등으로 멈춘 처리는 다시 돌린다
  after(async () => {
    try {
      await resumeStalledReviews(db);
      await resumeStalledMemos(db);
    } catch (error) {
      console.error("[workspace] 멈춘 처리 재개 실패", error);
    }
  });
  return Response.json(await loadWorkspace(db), { headers: { "Cache-Control": "no-store" } });
}
