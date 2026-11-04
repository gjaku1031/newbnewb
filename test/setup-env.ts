import { inject } from "vitest";

// 앱의 Claude 호출이 실제 API 대신 테스트용 가짜 Claude 서버로 가게 한다 (키는 아무 값)
process.env.ANTHROPIC_BASE_URL = inject("claudeUrl");
