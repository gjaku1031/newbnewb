import { inject } from "vitest";
import { drizzle } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "@/server/db/schema";
import type { Db } from "@/server/db/types";

/** 테스트 파일마다 커넥션 풀 하나 */
export function testDb(): { db: Db; close: () => Promise<void> } {
  const pool = mysql.createPool({ uri: inject("databaseUrl"), connectionLimit: 4, timezone: "Z" });
  return { db: drizzle({ client: pool, schema, mode: "default" }), close: () => pool.end() };
}
