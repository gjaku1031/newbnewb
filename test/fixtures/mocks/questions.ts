import type { QuestionRecord } from "@/lib/types";

export const questions: QuestionRecord[] = [
  {
    id: "a1",
    askedAt: "2026-10-30T10:42",
    question: "팀 회식 때 법인카드로 결제하면 계정과목을 뭘로 해야 해?",
    verdict: "ANSWER",
    confidence: 0.92,
    rationale:
      "ERP 경비 가이드에 '팀 내부 식사 = 회의비'가 명시돼 있고, 법인카드 규정(2026)과도 충돌이 없어요. 금액이 크지 않으면 되돌리기 쉬운 작업이라 확답했어요.",
    answer:
      "팀원끼리만 먹은 회식은 **회의비**로 처리하면 돼요. 외부인이 한 명이라도 있으면 **접대비**이고, 이때는 참석자 명단이 필요해요.",
    citations: [
      { wikiSlug: "erp-expense", excerpt: "팀 내부 식사 = 회의비, 외부인 포함 = 접대비" },
      { wikiSlug: "corporate-card", excerpt: "참석자(회사명/이름/직급) 명단 필수" },
    ],
    missing: [],
    status: "resolved",
    feedback: "up",
    modelId: "claude-opus-5-5",
  },
  {
    id: "a2",
    askedAt: "2026-10-30T09:15",
    question: "한빛물산 미팅 자료에 우리 제품 단가표를 넣어도 돼?",
    verdict: "NEED_INFO",
    confidence: 0.31,
    rationale:
      "대외비 문서 반출 규정은 있지만 '단가표'가 대외비인지 위키에 근거가 없어요. 외부로 나가는 자료라 틀리면 되돌리기 어려워서(위험도 높음) 확답하지 않았어요.",
    citations: [
      { wikiSlug: "security-basics", excerpt: "대외비 표기 문서는 외부 메일 첨부 금지" },
      { wikiSlug: "ppt-template-rules", excerpt: "내부 숫자(원가·마진) 절대 포함 금지" },
    ],
    missing: [
      {
        kind: "ask_person",
        target: "팀장님",
        what: "첫 미팅 자료에 표준 단가표를 넣어도 되는지, 넣는다면 어느 버전인지",
        suggestedScript:
          "팀장님, 월요일 한빛물산 자료 관련해서 여쭤볼게요. 표준 단가표를 별첨으로 넣어도 될까요? 넣는다면 10월 버전으로 넣으면 될지 확인 부탁드립니다.",
      },
      {
        kind: "find_document",
        target: "영업팀 공유 드라이브",
        what: "외부 제출 가능한 단가표 최신본 (대외비 표기 여부 확인)",
      },
    ],
    status: "open",
    itemId: "i1",
    modelId: "claude-opus-5-5",
  },
  {
    id: "a3",
    askedAt: "2026-10-29T17:20",
    question: "주간보고에 아직 안 끝난 PPT 작업은 어떻게 써?",
    verdict: "ANSWER_WITH_CAVEAT",
    confidence: 0.7,
    rationale:
      "주간보고 양식과 팀장님 원칙(결론부터)으로 형식은 답할 수 있어요. 다만 진행 중 업무를 진척률로 쓸지 단계로 쓸지 팀장님 선호는 아직 기록이 없어서 주의사항을 붙였어요.",
    answer:
      "'이슈/진행 중' 항목에 **결론 + 진척률**로 쓰세요. 예: \"한빛물산 미팅 자료 — 목차 확정, 초안 작성 중(50%), 11/2 오전 제출 예정\".",
    citations: [
      { wikiSlug: "weekly-report", excerpt: "'진행 중'만 쓰고 진척률 없음 → % 같이 쓰기" },
      { wikiSlug: "report-conclusion-first", excerpt: "결론을 첫 문장에" },
    ],
    missing: [
      {
        kind: "ask_person",
        target: "팀장님",
        what: "진행 중 업무를 % 로 쓰는 걸 선호하시는지 (다음 1:1 때 가볍게)",
        done: false,
      },
    ],
    status: "resolved",
    modelId: "claude-opus-5-5",
  },
  {
    id: "a4",
    askedAt: "2026-10-29T11:03",
    question: "출장 갈 때 KTX 특실 타도 돼?",
    verdict: "NEED_INFO",
    confidence: 0.18,
    rationale: "출장비 규정 문서가 위키에 아예 없어요. 근거 없이 답하면 추측이라 확답하지 않았어요.",
    citations: [],
    missing: [
      {
        kind: "find_document",
        target: "인사팀 공유 드라이브",
        what: "최신 출장비 정산 규정 문서",
      },
    ],
    status: "open",
    itemId: "i11",
    modelId: "claude-opus-5-5",
  },
  {
    id: "a5",
    askedAt: "2026-10-28T14:30",
    question: "접대비 쓸 때 참석자 명단에 직급까지 써야 해?",
    verdict: "NEED_INFO",
    confidence: 0.4,
    rationale: "2024 규정과 2026 개정판의 기재 항목이 달라서(근거 충돌) 확답하지 않았어요.",
    citations: [{ wikiSlug: "corporate-card", excerpt: "참석자(회사명/이름/직급) 명단 필수" }],
    missing: [
      {
        kind: "ask_person",
        target: "선임님",
        what: "접대비 참석자 명단 기재 항목 (직급 포함 여부)",
        suggestedScript: "선임님, 접대비 처리할 때 참석자 명단에 직급까지 적어야 하나요? 규정이 두 버전이라 헷갈려서요.",
        done: true,
        answer: "응 직급까지 다 써야 해. 2026년부터 바뀐 거야. 재무팀에서 반려 많이 해.",
      },
    ],
    status: "resolved",
    modelId: "claude-opus-5-5",
  },
  {
    id: "a6",
    askedAt: "2026-10-27T10:10",
    question: "외부 손님 미팅 회의실은 어디로 잡아?",
    verdict: "ANSWER",
    confidence: 0.95,
    rationale: "매뉴얼에 명시돼 있고 충돌 없음. 위험도 낮음.",
    answer: "외부 손님은 **5층 대회의실**, 하루 전까지 예약하고 1층 안내데스크에 방문자 등록도 하세요.",
    citations: [{ wikiSlug: "meeting-room", excerpt: "외부 손님: 5층 대회의실" }],
    missing: [],
    status: "resolved",
    feedback: "up",
    modelId: "claude-opus-5-5",
  },
];
