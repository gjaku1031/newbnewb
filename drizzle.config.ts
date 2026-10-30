import { defineConfig } from "drizzle-kit";

// drizzle-kit은 .env를 읽지 않으므로 직접 불러옴 (없으면 무시)
try {
  process.loadEnvFile(".env.local");
} catch {}

export default defineConfig({
  dialect: "mysql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DATABASE_URL ?? "" },
});
