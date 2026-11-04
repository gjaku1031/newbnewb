import "server-only";
import { getDb } from "@/server/db/client";
import { pruneScheduledRuns, runScheduledBriefing } from "@/server/services/briefing";

/**
 * 서버 안의 예약 작업 — 1분마다 "브리핑 만들 시각이 됐나"를 본다.
 * 하루 한 번만 도는 건 DB(scheduled_runs)로 보장하므로 서버가 여럿이어도 안전하다.
 * 운영(next start)에서만 켠다. 개발·e2e는 NEWB_SCHEDULER=on일 때만.
 */
const EVERY_MS = 60_000;
let started = false;

export function startScheduler() {
  const enabled = process.env.NEWB_SCHEDULER === "on" || (process.env.NODE_ENV === "production" && process.env.NEWB_SCHEDULER !== "off");
  if (!enabled || started) return;
  started = true;
  let running = false;
  const tick = async () => {
    if (running) return; // 앞 작업(Claude 호출)이 길어지면 겹쳐 돌지 않게
    running = true;
    try {
      const db = getDb();
      const result = await runScheduledBriefing(db);
      if (result === "done" || result === "failed") {
        console.log(`[scheduler] 아침 브리핑: ${result === "done" ? "만듦" : "실패"}`);
        await pruneScheduledRuns(db);
      }
    } catch (error) {
      console.error("[scheduler] 예약 작업 오류", error);
    } finally {
      running = false;
    }
  };
  const timer = setInterval(tick, EVERY_MS);
  timer.unref();
  setTimeout(tick, 10_000).unref();
  console.log("[scheduler] 예약 작업 시작 (1분마다 확인)");
}
