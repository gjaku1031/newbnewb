import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      // Next가 처리하는 서버 전용 표시 — 테스트에선 빈 모듈
      "server-only": fileURLToPath(new URL("./scripts/server-only-stub.mjs", import.meta.url)),
    },
  },
  test: {
    include: ["test/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    // 한 MySQL을 함께 쓰므로 파일을 순서대로
    fileParallelism: false,
    testTimeout: 30_000,
    // 테스트는 실제 Claude API를 부르지 않는다 — 가짜 Claude 서버(test/fakeClaude.ts)로
    env: { ANTHROPIC_API_KEY: "test-fake-key" },
    setupFiles: ["test/setup-env.ts"],
    hookTimeout: 180_000,
  },
});
