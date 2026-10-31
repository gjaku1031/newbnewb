import { after, connection } from "next/server";
import { withUser } from "@/server/auth";
import { getDb } from "@/server/db/client";
import { loadWorkspace } from "@/server/services/workspace";
import { resumeStalledReviews } from "@/server/services/wiki";
import { resumeStalledMemos } from "@/server/services/memos";

/** 작업공간 스냅샷 — 화면이 처리 중인 일을 기다리거나 다시 불러올 때 */
export async function GET(request: Request) {
  await connection();
  return withUser(request, async () => {
    const db = getDb();
    // 서버 재시작 등으로 멈춘 처리는 다시 돌린다 (각 처리는 먼저 점유하므로 요청이 겹쳐도 한 번만 돈다)
    after(async () => {
      try {
        await resumeStalledReviews(db);
        await resumeStalledMemos(db);
      } catch (error) {
        console.error("[workspace] 멈춘 처리 재개 실패", error);
      }
    });
    return Response.json(await loadWorkspace(db), { headers: { "Cache-Control": "no-store" } });
  });
}
