/** 아침/저녁 브리핑 목데이터 (2026-10-30 기준) */

export const morningBriefing = {
  date: "2026-10-30",
  generatedAt: "2026-10-30T08:00",
  greeting: "좋은 아침이에요. 오늘은 월요일 미팅 자료가 제일 중요해요.",
  focus: ["i1", "i2", "i7"],
  /** 망각곡선 기반 오늘 복습할 위키 */
  reviews: [
    { slug: "email-etiquette", reason: "어제 배운 내용 — 1일차 복습" },
    { slug: "weekly-report", reason: "오늘 주간보고 제출일이라 다시 보면 좋아요" },
    { slug: "report-conclusion-first", reason: "7일 만의 복습" },
  ],
  heads_up: [
    "16:30 팀장님 PPT 중간 점검 — 단가표 포함 여부를 이때 물어보면 좋아요",
    "법인카드 접대비는 2026년부터 참석자 직급까지 적어야 해요 (선임님 확인)",
  ],
};

export const eveningBriefing = {
  date: "2026-10-29",
  generatedAt: "2026-10-29T18:30",
  done: ["i6", "i12"],
  progressed: [
    { itemId: "i1", from: 33, to: 50 },
    { itemId: "i8", from: 33, to: 67 },
  ],
  wikiAdded: ["meeting-room", "meeting-notes", "excel-conventions"],
  wikiUpdated: ["corporate-card"],
  learned: [
    "외부 손님 회의실은 5층 대회의실, 하루 전 예약 + 방문자 등록",
    "접대비 참석자 명단에 직급 필수 (2026 개정)",
  ],
  pendingInfo: [
    { questionId: "a2", what: "미팅 자료에 단가표 포함 여부 — 팀장님" },
    { questionId: "a4", what: "출장비 정산 규정 문서 — 인사팀 드라이브" },
  ],
  tomorrow: ["i1", "i2", "i7"],
  note: "오늘은 질문 3개 중 2개를 스스로 해결했어요. 회의실 예약은 처음인데 한 번에 끝냈어요.",
};
