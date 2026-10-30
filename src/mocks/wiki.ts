import type { Source, WikiPage } from "@/lib/types";

export const sources: Source[] = [
  { id: "s1", title: "신입사원 업무 매뉴얼 v3.2", type: "manual", fileType: "pdf", addedAt: "2026-10-20" },
  { id: "s2", title: "사내 PPT 작성 가이드라인", type: "guideline", fileType: "pptx", addedAt: "2026-10-21" },
  { id: "s3", title: "법인카드 사용 규정 (2026 개정)", type: "guideline", fileType: "hwp", addedAt: "2026-10-22" },
  { id: "s4", title: "팀장님 답변: 보고서는 결론부터", type: "boss_answer", fileType: "text", addedAt: "2026-10-23" },
  { id: "s5", title: "선임님 조언: 메일 회신 타이밍", type: "peer_advice", fileType: "text", addedAt: "2026-10-24" },
  { id: "s6", title: "주간보고 양식", type: "guideline", fileType: "docx", addedAt: "2026-10-24" },
  { id: "s7", title: "ERP 경비처리 가이드", type: "manual", fileType: "pdf", addedAt: "2026-10-26" },
  { id: "s8", title: "한빛물산 회사 소개서", type: "note", fileType: "pdf", addedAt: "2026-10-27" },
  { id: "s9", title: "엑셀 작업 규칙 (재무팀 공유)", type: "guideline", fileType: "xlsx", addedAt: "2026-10-28" },
  { id: "s10", title: "선임님 답변: 접대비 참석자 기재", type: "peer_advice", fileType: "text", addedAt: "2026-10-29" },
  { id: "s11", title: "정보보안 기본 수칙", type: "manual", fileType: "pdf", addedAt: "2026-10-20" },
  { id: "s12", title: "법인카드 사용 규정 (2024)", type: "guideline", fileType: "hwp", addedAt: "2026-10-22" },
];

export const wikiPages: WikiPage[] = [
  {
    slug: "weekly-report",
    title: "주간 업무 보고 작성법",
    category: "보고·문서",
    summary: "매주 금요일 17시까지 팀장님께. 결론(이번 주 성과) → 이슈 → 다음 주 계획 순서.",
    body: `## 언제·누구에게
- **매주 금요일 17:00까지** 팀장님께 메일로 제출
- 제목: \`[주간보고] 사업기획팀 김뉴비 (10/27~10/31)\`

## 구성
1. **이번 주 성과** — 결론부터, 숫자가 있으면 숫자로
2. **이슈 / 도움 필요** — 막힌 것은 숨기지 말고 쓰기
3. **다음 주 계획** — 마감일 함께

## 팀장님 스타일
> "보고서는 결론부터. 과정은 물어보면 그때 말해도 돼."

## 자주 하는 실수
- 한 일을 시간순으로 나열 → 성과 중심으로 묶기
- '진행 중'만 쓰고 진척률 없음 → [[quest-progress]]처럼 % 같이 쓰기`,
    sourceIds: ["s6", "s4"],
    links: ["report-conclusion-first", "email-etiquette"],
    updatedAt: "2026-10-28",
    createdAt: "2026-10-24",
    review: { nextReview: "2026-10-30", intervalDays: 3, reviewCount: 2 },
  },
  {
    slug: "report-conclusion-first",
    title: "보고는 결론부터 (팀장님 원칙)",
    category: "보고·문서",
    summary: "모든 보고는 결론 → 근거 → 요청사항 순서. 구두 보고도 동일.",
    body: `## 원칙
결론을 첫 문장에. 근거는 2~3개만. 요청할 게 있으면 마지막에 분명히.

## 예시
- ❌ "제가 어제 거래처에 연락을 드렸는데요, 담당자분이 부재중이셔서..."
- ✅ "미팅은 월요일 10시로 확정됐습니다. 담당자 회신 메일 전달드렸습니다."`,
    sourceIds: ["s4"],
    links: ["weekly-report"],
    updatedAt: "2026-10-23",
    createdAt: "2026-10-23",
    review: { nextReview: "2026-10-30", intervalDays: 7, reviewCount: 1 },
  },
  {
    slug: "ppt-template-rules",
    title: "PPT 작성 규칙 (회사 표준 템플릿)",
    category: "보고·문서",
    summary: "표준 템플릿 필수. 슬라이드당 메시지 1개, 헤드라인은 문장형, 본문 14pt 이상.",
    body: `## 필수
- 회사 표준 템플릿(\`2026_표준_16x9.potx\`) 사용
- 표지 → 목차 → 본문 → 요약 → 별첨 순서
- **슬라이드 1장 = 메시지 1개**, 헤드라인은 문장형 ("~합니다")

## 서식
- 본문 폰트: 프리텐다드 14pt 이상, 색은 템플릿 팔레트 내에서만
- 출처는 슬라이드 하단 좌측 9pt

## 외부 제출용
- 대외비 표기 확인, 내부 숫자(원가·마진) 절대 포함 금지 → [[security-basics]]`,
    sourceIds: ["s2"],
    links: ["security-basics", "partner-hanbit"],
    updatedAt: "2026-10-27",
    createdAt: "2026-10-21",
    review: { nextReview: "2026-11-02", intervalDays: 7, reviewCount: 2 },
  },
  {
    slug: "corporate-card",
    title: "법인카드 사용 규정",
    category: "재무·경비",
    summary: "1회 50만원 초과 시 사전 품의. 접대비는 참석자 명단 필수. 증빙은 익월 3일까지.",
    body: `## 한도와 사전 승인
- 1회 **50만원 초과** 시 사전 품의 필요
- 주말·심야(22시 이후) 사용은 사유서 첨부

## 접대비
- 참석자(회사명/이름/직급) 명단 필수
- 1인당 10만원 초과 시 팀장 승인

## 증빙 마감
- **익월 3일까지** ERP 입력 + 영수증 업로드 → [[erp-expense]]`,
    sourceIds: ["s3", "s12", "s10"],
    links: ["erp-expense"],
    updatedAt: "2026-10-29",
    createdAt: "2026-10-22",
    review: { nextReview: "2026-10-31", intervalDays: 3, reviewCount: 1 },
    issues: [
      {
        kind: "conflict",
        message: "2024 규정은 사전 품의 기준이 30만원, 2026 개정판은 50만원입니다. 2026 기준으로 정리했어요. 맞는지 확인해 주세요.",
      },
    ],
  },
  {
    slug: "erp-expense",
    title: "ERP 경비 처리 방법",
    category: "재무·경비",
    summary: "경비청구 → 카드내역 불러오기 → 계정과목 선택 → 증빙 첨부 → 결재 상신.",
    body: `## 순서
1. ERP > 경비 > **경비청구** 메뉴
2. [카드내역 불러오기]로 해당 월 선택
3. 건별 계정과목 선택 (회의비 / 접대비 / 소모품비 / 교통비)
4. 영수증 스캔본 첨부 (PDF, 건당 1장)
5. 결재선 확인 후 상신 → [[e-approval]]

## 헷갈리는 계정과목
- 팀 내부 식사 = **회의비**, 외부인 포함 = **접대비**`,
    sourceIds: ["s7"],
    links: ["corporate-card", "e-approval"],
    updatedAt: "2026-10-26",
    createdAt: "2026-10-26",
    review: { nextReview: "2026-11-01", intervalDays: 3, reviewCount: 1 },
  },
  {
    slug: "e-approval",
    title: "전자결재 상신하기",
    category: "업무 시스템",
    summary: "품의서 작성 → 결재선 지정(담당→팀장→본부장) → 상신. 반려 시 사유 확인 후 재상신.",
    body: `## 결재선 기본
담당(나) → 팀장 → (금액에 따라) 본부장

## 팁
- 상신 전 첨부파일 이름 규칙: \`YYYYMMDD_건명_작성자\`
- 급한 건은 상신 후 메신저로 한 줄 알리기`,
    sourceIds: ["s1"],
    links: ["erp-expense"],
    updatedAt: "2026-10-21",
    createdAt: "2026-10-21",
    review: { nextReview: "2026-11-04", intervalDays: 14, reviewCount: 3 },
  },
  {
    slug: "email-etiquette",
    title: "업무 메일 작성·회신 예절",
    category: "커뮤니케이션",
    summary: "외부 메일은 당일 회신이 원칙, 답을 모르면 '확인 후 회신' 메일이라도 먼저.",
    body: `## 회신 타이밍
> "답을 몰라도 받았다는 회신은 당일에. '확인 후 내일 오전까지 회신드리겠습니다'면 충분해."

## 참조(CC)
- 외부 메일에는 팀장님 CC가 기본
- 내부 메일은 관련자만`,
    sourceIds: ["s5", "s1"],
    links: ["weekly-report"],
    updatedAt: "2026-10-24",
    createdAt: "2026-10-24",
    review: { nextReview: "2026-10-30", intervalDays: 1, reviewCount: 1 },
  },
  {
    slug: "partner-hanbit",
    title: "거래처: 한빛물산",
    category: "거래처",
    summary: "물류 자동화 장비 유통사. 구매팀 담당. 11/2 첫 미팅.",
    body: `## 기본 정보
- 업종: 물류 자동화 장비 유통
- 담당: 구매팀

## 미팅 히스토리
- 2026-11-02 첫 미팅 예정 (회사 소개 + 협업 제안)`,
    sourceIds: ["s8"],
    links: ["ppt-template-rules"],
    updatedAt: "2026-10-27",
    createdAt: "2026-10-27",
    review: { nextReview: "2026-11-01", intervalDays: 3, reviewCount: 0 },
  },
  {
    slug: "excel-conventions",
    title: "엑셀 작업 규칙",
    category: "보고·문서",
    summary: "원본 시트 보존, 하드코딩 금지(수식 참조), 단위는 헤더에, 숫자는 천 단위 구분.",
    body: `## 규칙
- **원본 데이터 시트는 수정 금지**, 가공은 별도 시트
- 숫자 하드코딩 금지 → 셀 참조
- 단위는 헤더에 (예: \`매출(백만원)\`)
- 입력 셀은 파란 글씨, 수식 셀은 검정`,
    sourceIds: ["s9"],
    links: [],
    updatedAt: "2026-10-28",
    createdAt: "2026-10-28",
    review: { nextReview: "2026-10-31", intervalDays: 1, reviewCount: 0 },
  },
  {
    slug: "security-basics",
    title: "정보보안 기본 수칙",
    category: "보안",
    summary: "대외비 문서 외부 반출 금지, USB 사용 신청제, 자리 비울 때 화면 잠금.",
    body: `## 꼭 지킬 것
- 대외비 표기 문서는 외부 메일 첨부 금지
- USB는 보안팀 신청 후 사용
- 자리 비울 때 \`Win + L\``,
    sourceIds: ["s11"],
    links: ["ppt-template-rules"],
    updatedAt: "2026-10-20",
    createdAt: "2026-10-20",
    review: { nextReview: "2026-11-03", intervalDays: 14, reviewCount: 3 },
  },
  {
    slug: "meeting-room",
    title: "회의실 예약",
    category: "업무 시스템",
    summary: "그룹웨어 > 자원예약. 외부 손님 미팅은 5층 대회의실, 하루 전까지.",
    body: `- 그룹웨어 > 자원예약 > 회의실
- 외부 손님: 5층 대회의실 / 내부: 3층 소회의실
- 외부 미팅은 **하루 전까지** 예약 + 1층 안내데스크에 방문자 등록`,
    sourceIds: ["s1"],
    links: [],
    updatedAt: "2026-10-29",
    createdAt: "2026-10-29",
    review: { nextReview: "2026-11-05", intervalDays: 7, reviewCount: 1 },
  },
  {
    slug: "meeting-notes",
    title: "회의록 작성법",
    category: "보고·문서",
    summary: "결정사항 / 할 일(담당·기한) / 논의 내용 순. 회의 당일 공유.",
    body: `1. **결정사항**
2. **할 일** — 담당자, 기한
3. 논의 내용 요약

회의 당일 퇴근 전 공유`,
    sourceIds: ["s1"],
    links: ["report-conclusion-first"],
    updatedAt: "2026-10-28",
    createdAt: "2026-10-28",
    review: { nextReview: "2026-11-01", intervalDays: 3, reviewCount: 1 },
    issues: [{ kind: "orphan", message: "다른 페이지에서 이 페이지로 연결된 링크가 없어요." }],
  },
];

export function getWikiPage(slug: string) {
  return wikiPages.find((p) => p.slug === slug);
}

export function getSource(id: string) {
  return sources.find((s) => s.id === id);
}

export const sourceTypeLabel: Record<Source["type"], string> = {
  manual: "매뉴얼",
  guideline: "가이드라인",
  boss_answer: "상사 답변",
  peer_advice: "동료 조언",
  note: "메모",
};
