import type { DisplayKind, Item, ItemStatus, Priority } from "@/lib/types";

/** 화면 유형: 일정 / 단순 작업(하위 항목 없음) / 작업(하위 항목 있음) */
export function displayKind(i: Item): DisplayKind {
  if (i.kind === "event") return "event";
  return i.subItems.length > 0 ? "task" : "simple";
}

/** 유형 3종 — 고정 (태그와 별개) */
export const KIND_META: Record<DisplayKind, { label: string; color: string }> = {
  event: { label: "일정", color: "var(--kind-event)" },
  simple: { label: "단순 작업", color: "var(--kind-simple)" },
  task: { label: "작업", color: "var(--kind-task)" },
};

/** 자유 태그 (기본 제공분 — 사용자가 추가·삭제 가능) */
export interface Tag {
  id: string;
  label: string;
  color: string;
}
/** 달성률 % (일정은 null) */
export function progress(i: Item): number | null {
  if (i.kind === "event") return null;
  if (i.subItems.length === 0) return i.status === "done" ? 100 : 0;
  return Math.round((i.subItems.filter((s) => s.done).length / i.subItems.length) * 100);
}

export const PRIORITY_ORDER: Priority[] = ["P0", "P1", "P2", "P3", "P4", "P5"];
export const byPriority = (a: Item, b: Item) =>
  PRIORITY_ORDER.indexOf(a.priority ?? "P5") - PRIORITY_ORDER.indexOf(b.priority ?? "P5");

export const STATUSES: ItemStatus[] = ["todo", "doing", "waiting", "done"];

export const statusLabel: Record<ItemStatus, string> = {
  todo: "할 일",
  doing: "진행 중",
  waiting: "알아오는 중",
  done: "완료",
};

export const statusColor: Record<ItemStatus, string> = {
  todo: "var(--muted)",
  doing: "var(--accent)",
  waiting: "var(--info)",
  done: "var(--ok)",
};

/** 캘린더에 놓인 날짜 (시작일) */
export const startDay = (i: Item) => i.start?.slice(0, 10);
export const endDay = (i: Item) => (i.end ?? i.start)?.slice(0, 10);
