import "server-only";
import { sql } from "drizzle-orm";
import type { ResultSetHeader } from "mysql2";

/**
 * 서버 백그라운드 처리(메모 처리·위키 검토) 공용 도우미.
 * 멈춘 처리를 다시 돌릴 때는 updated_at을 먼저 지금으로 바꿔 "점유"하고, 바뀐 행이 1개일 때만 처리한다.
 */

/** DB 시계 기준 "지금 - ms" (앱 서버와 DB 서버의 시간대가 달라도 안전) */
export const stalledBefore = (ms: number) => sql`NOW(3) - INTERVAL ${ms * 1000} MICROSECOND`;

/**
 * 처리 중인 일을 "멈췄다"고 볼 시간 — Claude 호출이 실패로 끝날 수 있는 최대 시간(요청 5분 × 3번)보다 길게.
 * 짧으면 아직 Claude가 답하는 중인 일을 또 돌려 같은 요청을 두 번 보낸다.
 */
export const STALLED_MS = 16 * 60 * 1000;

/** drizzle(mysql2) update/delete 결과에서 바뀐 행 수 */
export function affectedRows(result: unknown): number {
  const header = (Array.isArray(result) ? result[0] : result) as ResultSetHeader | undefined;
  return header?.affectedRows ?? 0;
}
