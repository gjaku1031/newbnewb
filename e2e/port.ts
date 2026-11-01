import os from "node:os";
import path from "node:path";

/** e2e용 개발 서버 포트 — 평소 개발 서버(3000)와 겹치지 않게 */
export const E2E_PORT = Number(process.env.E2E_PORT ?? 3100);

/** global-setup이 Passkey로 로그인해 저장한 세션 쿠키 (모든 테스트가 이 상태로 시작) */
export const AUTH_STATE = path.join(os.tmpdir(), "newb-e2e", "owner.json");
