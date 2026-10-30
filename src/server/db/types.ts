import type { MySql2Database } from "drizzle-orm/mysql2";
import type * as schema from "./schema";

export type Db = MySql2Database<typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
/** 트랜잭션 안팎 어디서나 쓰는 쿼리 실행기 */
export type Exec = Db | Tx;
