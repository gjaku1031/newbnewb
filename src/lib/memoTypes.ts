/**
 * 빠른 메모 — 급하게 대충(오타 포함) 적으면 Claude가 읽고 항목·위키를 갱신한다.
 * 실제로는 DB memos 테이블 + Claude(MCP) 처리, 지금은 목업 규칙 처리기.
 */

export type MemoStatus = "processing" | "done";

/** Claude가 메모를 보고 한 일 */
export type MemoActionKind = "create_event" | "create_task" | "ask" | "update_wiki" | "add_caution";

export interface MemoAction {
  kind: MemoActionKind;
  /** 화면에 보일 한 줄 (예: "일정 추가 · 10/30 (금) 08:00 회의") */
  label: string;
  /** 반영된 대상 링크 */
  href?: string;
  /** 위키 갱신이면 변경 요청 id (검토 상태는 위키 스토어에서 실시간으로 확인) */
  revisionId?: string;
}

export interface MemoResult {
  /** 오타·띄어쓰기 고친 정리본 */
  cleaned: string;
  actions: MemoAction[];
}

export interface Memo {
  id: string;
  /** 내가 쓴 원문 그대로 */
  text: string;
  createdAt: string;
  status: MemoStatus;
  result?: MemoResult;
}
