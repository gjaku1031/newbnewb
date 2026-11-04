/**
 * 메모 처리기 인터페이스. 구현은 Claude(src/server/ai/memo.ts) — API 키가 없으면 처리하지 않는다.
 * 입력: 러프한 메모 원문 / 출력: 정리본 + 만들 항목·알아올 것·위키 갱신 계획
 */

export interface PlannedEvent {
  title: string;
  date: string;
  time?: string;
  location?: string;
  from?: string;
}

export interface PlannedTask {
  title: string;
  due: string;
  from?: string;
  /** 모르는 게 있으면 알아오는 중 */
  waitingFor?: string;
}

export interface PlannedWiki {
  slug: string;
  line: string;
}

/** 지적받은 것·실수 → 주의할 점 */
export interface PlannedCaution {
  point: string;
  by?: string;
  wikiSlug?: string;
}

export interface MemoPlan {
  cleaned: string;
  events: PlannedEvent[];
  tasks: PlannedTask[];
  /** 할 일에 붙지 못한 알아올 것 */
  asks: string[];
  wiki: PlannedWiki[];
  cautions: PlannedCaution[];
}

/** 처리기가 고를 수 있는 위키 페이지 */
export interface WikiPageRef {
  slug: string;
  title: string;
  summary: string;
}

export interface MemoProcessor {
  id: string;
  process(text: string, today: string, pages: WikiPageRef[]): Promise<MemoPlan>;
}
