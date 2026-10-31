import "server-only";
import { inArray } from "drizzle-orm";
import type { MySqlColumn, MySqlTable } from "drizzle-orm/mysql-core";
import type { Exec } from "./types";

/** values 중 table.column에 실제로 있는 값만 (중복 제거, 순서 유지) — 연결 테이블에 넣기 전 FK 오류 방지 */
export async function existing(db: Exec, table: MySqlTable, column: MySqlColumn, values: string[]): Promise<string[]> {
  const unique = [...new Set(values)];
  if (unique.length === 0) return [];
  const rows = await db.select({ v: column }).from(table).where(inArray(column, unique));
  const found = new Set(rows.map((r) => String(r.v)));
  return unique.filter((v) => found.has(v));
}
