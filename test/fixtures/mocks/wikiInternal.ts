import "server-only";

/**
 * 위키 내부 참고 데이터 — 화면·브라우저로는 절대 보내지 않는다 (server-only).
 * 사람 이름, 인용 출처 같은 세부 레퍼런스. Claude가 MCP로 답변할 때만 사용한다.
 * 화면에서는 이름 대신 직책(팀장님·선임님 등)만 쓴다.
 */

/** 원본 문서를 준 사람 (sourceId → 이름·직책) */
export const sourceAuthors: Record<string, string> = {
  s4: "박지훈 팀장",
  s5: "김서연 선임",
  s10: "김서연 선임",
};

/** 위키 페이지별 내부 메모 (slug → 메모) */
export const wikiInternalNotes: Record<string, string[]> = {
  "weekly-report": ['"보고서는 결론부터…" 인용 출처: 박지훈 팀장 (2026-10-23 구두)'],
  "report-conclusion-first": ["원칙 출처: 박지훈 팀장 (2026-10-23 구두)"],
  "corporate-card": [
    '접대비 직급 기재 확인: 김서연 선임 (2026-10-29) — "2026년부터 바뀐 거야. 재무팀에서 반려 많이 해."',
  ],
  "email-etiquette": ["회신 타이밍 조언 출처: 김서연 선임 (2026-10-24 메신저)"],
  "partner-hanbit": ["담당자: 최유진 과장 (구매팀)"],
};

/** 사람 (이름 → 직책). 화면 표시는 직책만 */
export const people: { name: string; role: string }[] = [
  { name: "박지훈", role: "팀장님" },
  { name: "김서연", role: "선임님" },
  { name: "이민호", role: "책임님" },
];
