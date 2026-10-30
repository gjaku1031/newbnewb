// DB 마이그레이션 실행 (drizzle/ 폴더의 SQL을 순서대로 적용)
// 로컬: npm run db:migrate   컨테이너: node migrate.cjs (Dockerfile에서 번들)
import { readFileSync } from "node:fs";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";

async function main() {
  const uri = process.env.DATABASE_URL;
  if (!uri) throw new Error("DATABASE_URL이 설정되지 않았습니다");
  const caFile = process.env.DATABASE_SSL_CA_FILE;
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? "drizzle";

  const conn = await mysql.createConnection({
    uri,
    ssl: caFile ? { ca: readFileSync(caFile, "utf8"), rejectUnauthorized: true } : undefined,
    multipleStatements: true,
  });
  try {
    await migrate(drizzle({ client: conn }), { migrationsFolder });
    console.log(`마이그레이션 완료 (${migrationsFolder})`);
  } finally {
    await conn.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
