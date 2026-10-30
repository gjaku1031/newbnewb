import "server-only";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";
import { mysqlOptions } from "./connection";

/** MySQL 연결 — 접속 정보·TLS 해석은 connection.ts (DATABASE_URL, DATABASE_SSL, DATABASE_SSL_CA_FILE) */
function createPool() {
  return mysql.createPool({
    ...mysqlOptions(),
    connectionLimit: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    timezone: "Z",
    connectTimeout: 5_000,
  });
}

// 개발 서버 HMR로 모듈이 다시 불려도 풀을 하나만 유지
const cache = globalThis as unknown as {
  newbPool?: mysql.Pool;
  newbDb?: MySql2Database<typeof schema>;
};

export function getPool() {
  return (cache.newbPool ??= createPool());
}

export function getDb() {
  return (cache.newbDb ??= drizzle({ client: getPool(), schema, mode: "default" }));
}
