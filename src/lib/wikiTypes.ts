/** 위키 변경 관리(git처럼) 타입 */

/** 페이지에서 사용자가 고칠 수 있는 내용 */
export interface PageContent {
  title: string;
  summary: string;
  body: string;
}

/** reviewing = Claude 검토 중, pending = 모순 있어 확인 대기, applied = 반영됨, cancelled = 취소 */
export type RevisionStatus = "reviewing" | "pending" | "applied" | "cancelled";

export type RevisionAuthor = "me" | "claude";

/** 검토에서 찾은 모순 하나 */
export interface Conflict {
  /** 충돌한 근거: 다른 위키 페이지 / 같은 페이지의 다른 문장 / 원본 문서 */
  ref: { kind: "page" | "self" | "source"; slug?: string; title: string };
  /** 근거 쪽 문장 */
  excerpt: string;
  /** 바뀐 쪽 문장 */
  changed: string;
  reason: string;
}

export interface ReviewResult {
  conflicts: Conflict[];
  summary: string;
  reviewerId: string;
}

/** 문서에 단 주석 — "어디를 어떻게 고쳐야 하는지". 직접 고치지 않고 Claude가 모아서 반영 */
export type CommentStatus = "open" | "requested" | "applied";

export interface WikiComment {
  id: string;
  slug: string;
  /** null = 문서 전체에 대한 주석 */
  anchor: { quote: string; line: number } | null;
  text: string;
  at: string;
  status: CommentStatus;
  /** 반영 요청된 버전 */
  revisionId?: string;
  /** 지난 요청에서 찾지 못하는 등 처리 메모 */
  note?: string;
}

/** 주석 하나가 문서에 어떻게 반영됐는지 */
export interface EditNote {
  commentId: string;
  note: string;
  applied: boolean;
}

/** 변경 요청 = 커밋 하나 */
export interface Revision {
  id: string;
  slug: string;
  version: number;
  /** "YYYY-MM-DDTHH:mm" */
  at: string;
  author: RevisionAuthor;
  status: RevisionStatus;
  message: string;
  before: PageContent;
  after: PageContent;
  conflicts: Conflict[];
  /** 이 버전을 만든 주석들 */
  commentIds?: string[];
  edits?: EditNote[];
}
