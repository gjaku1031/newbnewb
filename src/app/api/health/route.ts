import { connection } from "next/server";
import { getPool } from "@/server/db/client";
import { checkBucket } from "@/server/storage";

type Check = "ok" | "error";

async function run(name: string, task: (signal: AbortSignal) => Promise<unknown>): Promise<Check> {
  const signal = AbortSignal.timeout(3_000);
  try {
    await Promise.race([
      task(signal),
      new Promise((_, reject) => signal.addEventListener("abort", () => reject(signal.reason))),
    ]);
    return "ok";
  } catch (error) {
    console.error(`[health] ${name} 실패`, error);
    return "error";
  }
}

/** DB·Object Storage 연결 확인 (배포 후 확인, 컨테이너 healthcheck용). 오류 내용은 서버 로그에만 남김 */
export async function GET() {
  await connection();
  const [db, storage] = await Promise.all([
    run("db", () => getPool().query("SELECT 1")),
    run("storage", (signal) => checkBucket(signal)),
  ]);
  const ok = db === "ok" && storage === "ok";
  return Response.json(
    { status: ok ? "ok" : "error", checks: { db, storage } },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
