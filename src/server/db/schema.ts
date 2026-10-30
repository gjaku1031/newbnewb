import { bigint, char, datetime, index, mysqlTable, tinyint, varchar } from "drizzle-orm/mysql-core";
import { sql } from "drizzle-orm";

/**
 * 원본 문서 (docs/PLAN.md 4장 `sources`)
 * 파일 자체는 Object Storage에 두고, DB에는 메타데이터만 저장한다.
 */
export const sources = mysqlTable(
  "sources",
  {
    id: varchar("id", { length: 36 })
      .primaryKey()
      .$defaultFn(() => crypto.randomUUID()),
    title: varchar("title", { length: 255 }).notNull(),
    // 문서 종류 (manual, advice, memo, file …)
    kind: varchar("kind", { length: 32 }).notNull(),
    // Object Storage 키 — 같은 키를 두 번 쓰지 않는다
    objectKey: varchar("object_key", { length: 512 }).notNull().unique(),
    contentType: varchar("content_type", { length: 255 }).notNull(),
    sizeBytes: bigint("size_bytes", { mode: "number", unsigned: true }).notNull(),
    sha256: char("sha256", { length: 64 }).notNull(),
    // 신뢰 등급 (0 = 미확인 … 높을수록 공식 문서)
    trustLevel: tinyint("trust_level", { unsigned: true }).notNull().default(0),
    uploadedAt: datetime("uploaded_at", { mode: "date", fsp: 3 })
      .notNull()
      .default(sql`CURRENT_TIMESTAMP(3)`),
  },
  (t) => [index("sources_uploaded_at_idx").on(t.uploadedAt)],
);

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;
