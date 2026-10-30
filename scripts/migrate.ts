// DB 마이그레이션 실행 (drizzle/ 폴더의 SQL을 순서대로 적용)
// 로컬: npm run db:migrate   컨테이너: node migrate.cjs (Dockerfile에서 번들)
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import mysql from "mysql2/promise";
import { mysqlOptions } from "../src/server/db/connection";

async function main() {
  const migrationsFolder = process.env.MIGRATIONS_DIR ?? "drizzle";
  const conn = await mysql.createConnection({ ...mysqlOptions(), multipleStatements: true });
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
