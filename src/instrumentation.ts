/** 서버가 뜰 때 한 번 — Node 런타임에서만 예약 작업을 켠다 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { startScheduler } = await import("@/server/scheduler");
    startScheduler();
  }
}
