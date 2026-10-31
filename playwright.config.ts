import { defineConfig, devices } from "@playwright/test";
import { E2E_PORT } from "./e2e/port";

/**
 * 브라우저 e2e: npm run test:e2e (Docker 필요)
 * global-setup이 격리된 MySQL·S3와 개발 서버를 띄운다. 테스트는 같은 DB를 쓰므로 순서대로 실행한다.
 */
export default defineConfig({
  testDir: "e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // 개발 서버는 처음 여는 화면을 그때 컴파일하므로 넉넉하게
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "test-results/report" }]],
  outputDir: "test-results/artifacts",
  use: {
    // localhost여야 개발 서버가 HMR·개발용 리소스를 막지 않는다 (127.0.0.1은 다른 출처로 취급)
    baseURL: `http://localhost:${E2E_PORT}`,
    locale: "ko-KR",
    timezoneId: "Asia/Seoul",
    navigationTimeout: 45_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile", use: { ...devices["iPhone 15"], browserName: "chromium" }, grep: /@mobile/ },
  ],
});
