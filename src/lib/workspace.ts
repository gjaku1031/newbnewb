import type { Tag } from "@/lib/items";
import type {
  Caution,
  EveningBriefing,
  Item,
  MorningBriefing,
  QuestionRecord,
  RescheduleProposal,
  Source,
  WikiPage,
} from "@/lib/types";
import type { Revision, WikiComment } from "@/lib/wikiTypes";
import type { Memo } from "@/lib/memoTypes";

/**
 * 작업공간 스냅샷 — 1인용 앱이라 화면에 필요한 데이터를 한 번에 내려준다.
 * 서버 전용 정보(사람 이름, 내부 메모, 자료 제공자)는 들어가지 않는다.
 */
export interface WorkspaceSnapshot {
  /** 서버가 스냅샷을 만든 시각 (ms) — 더 새 스냅샷인지 비교용 */
  version: number;
  /** 서버 기준 한국 시간 "YYYY-MM-DDTHH:mm" */
  now: string;
  items: Item[];
  tags: Tag[];
  wiki: WikiData;
  memos: Memo[];
  questions: QuestionRecord[];
  cautions: Caution[];
  briefing: { morning: MorningBriefing | null; evening: EveningBriefing | null };
  reschedule: RescheduleProposal | null;
  /** Claude API 키가 있는지 — 없으면 메모 정리·위키 주석 반영·모순 검토가 돌지 않는다 */
  claude: boolean;
  /** 대시보드 알림 설정 (아침 브리핑 시각·요일, 0=일 … 6=토) */
  settings: { morningTime: string; days: number[] };
}

export interface WikiData {
  pages: WikiPage[];
  sources: (Source & { hasFile: boolean })[];
  revisions: Revision[];
  comments: WikiComment[];
}
