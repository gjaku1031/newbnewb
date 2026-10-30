import "server-only";
import { readFileSync } from "node:fs";
import { drizzle, type MySql2Database } from "drizzle-orm/mysql2";
import mysql from "mysql2/promise";
import * as schema from "./schema";

/**
 * MySQL 연결
 *
 * DATABASE_URL          mysql://user:password@host:3306/newb
 * DATABASE_SSL_CA_FILE  (선택) 서버 인증서를 검증할 CA 파일 경로. 지정하면 TLS 필수
 * DATABASE_POOL_SIZE    (선택) 커넥션 풀 크기, 기본 5
 */
function createPool() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL이 설정되지 않았습니다");
  const caFile = process.env.DATABASE_SSL_CA_FILE;
  return mysql.createPool({
    uri,
    connectionLimit: Number(process.env.DATABASE_POOL_SIZE ?? 5),
    ssl: caFile ? { ca: readFileSync(caFile, "utf8"), rejectUnauthorized: true } : undefined,
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
