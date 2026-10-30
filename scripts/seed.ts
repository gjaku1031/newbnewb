// 개발용 목데이터 시드: npm run db:seed (비어 있을 때만) / npm run db:seed -- --force (모두 지우고 다시)
import { getDb, getPool } from "@/server/db/client";
import { seedDemo } from "@/server/seed";

async function main() {
  const force = process.argv.includes("--force");
  const result = await seedDemo(getDb(), { force });
  for (const w of result.warnings) console.warn(`경고: ${w}`);
  console.log(result.seeded ? "시드 완료" : "이미 데이터가 있어 건너뜀 (--force로 다시 채우기)");
  await getPool().end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
