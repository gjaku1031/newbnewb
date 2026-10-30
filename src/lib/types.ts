// 앱 전체에서 쓰는 도메인 타입. 지금은 목데이터용이지만 DB 스키마의 기준이 된다.

export type Priority = "P0" | "P1" | "P2" | "P3" | "P4" | "P5";

/**
 * 항목(Item) — 일정과 할 일을 하나로 합친 단위.
 * - kind "event"  → 일정 (시간이 있고 완료 체크 없음)
 * - kind "task"   → 할 일. 하위 항목이 없으면 "단순 작업", 있으면 "작업"(달성률 %)으로 자동 구분
 * 유형(kind)은 고정이고, 분류 라벨은 자유 태그(tags)로 따로 붙인다.
 */
export type ItemKind = "event" | "task";

/** 화면에 보이는 유형 (task는 하위 항목 유무로 simple/task 자동 결정) */
export type DisplayKind = "event" | "simple" | "task";

/** 할 일 상태 */
export type ItemStatus = "todo" | "doing" | "waiting" | "done";

/** 하위 항목 = 달성률을 만드는 체크리스트 (1단계만) */
export interface SubItem {
  id: string;
  title: string;
  done: boolean;
}

export interface Item {
  id: string;
  title: string;
  kind: ItemKind;
  /**
   * 캘린더에 놓인 시간 (ISO "YYYY-MM-DDTHH:mm"). 일정은 필수,
   * 할 일은 "작업할 날·기간"으로 선택 (없으면 미배치 보관함)
   */
  start?: string;
  end?: string;
  allDay?: boolean;
  /** 할 일 마감일 (YYYY-MM-DD) */
  due?: string;
  /** 할 일만 */
  priority?: Priority;
  status?: ItemStatus;
  /** 자유 태그 id (회의·개인·커스텀…) */
  tags: string[];
  subItems: SubItem[];
  /** 누가/어디서 받은 일인지 (이름 대신 직책) */
  from?: string;
  description?: string;
  location?: string;
  /** 관련 위키 페이지 slug */
  wikiRefs: string[];
  /** status가 waiting일 때 무엇을 기다리는지 */
  waitingFor?: string;
  /** Claude Desktop에 줄 작업 지침 */
  brief?: string;
  createdAt: string;
}

export type SourceType =
  | "manual"
  | "guideline"
  | "boss_answer"
  | "peer_advice"
  | "note";

export interface Source {
  id: string;
  title: string;
  type: SourceType;
  fileType: "pdf" | "docx" | "xlsx" | "pptx" | "hwp" | "hwpx" | "text" | "image";
  addedAt: string;
}

/** 복습 노출 일정. 간격 계산(망각 곡선)은 내부에서만 하고, 화면엔 "N일마다 · 다음 복습일"만 보여준다 */
export interface WikiReview {
  /** YYYY-MM-DD */
  nextReview: string;
  /** 몇 일마다 다시 보여줄지 */
  intervalDays: number;
  reviewCount: number;
}

export interface WikiPage {
  slug: string;
  title: string;
  category: string;
  summary: string;
  /** 마크다운 본문 */
  body: string;
  sourceIds: string[];
  links: string[];
  updatedAt: string;
  createdAt: string;
  review: WikiReview;
  /** 위키 점검(lint)에서 걸린 문제 */
  issues?: { kind: "conflict" | "stale" | "orphan"; message: string }[];
}

export type Verdict = "ANSWER" | "ANSWER_WITH_CAVEAT" | "NEED_INFO";

export interface MissingItem {
  kind: "ask_person" | "find_document" | "clarify_question";
  target?: string;
  what: string;
  suggestedScript?: string;
  done?: boolean;
  /** 사용자가 알아온 답 */
  answer?: string;
}

export interface QuestionRecord {
  id: string;
  askedAt: string;
  question: string;
  verdict: Verdict;
  confidence: number;
  /** 0~1 정규화된 판정 신호 */
  signals: {
    coverage: number;
    conflict: number;
    freshness: number;
    risk: number;
    ambiguity: number;
  };
  rationale: string;
  answer?: string;
  citations: { wikiSlug: string; excerpt: string }[];
  missing: MissingItem[];
  status: "open" | "resolved";
  itemId?: string;
  feedback?: "up" | "down";
  modelId: string;
}

export interface RescheduleItem {
  itemId: string;
  fromDate?: string;
  toDate: string;
  fromPriority: Priority;
  toPriority: Priority;
  reason: string;
  accepted?: boolean;
}

export interface RescheduleProposal {
  id: string;
  createdAt: string;
  summary: string;
  items: RescheduleItem[];
}
