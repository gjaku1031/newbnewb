import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import type { Item } from "@/lib/types";

/** 선택된 항목 id */
export type Selection = string | null;

/** 캘린더에 놓인 항목 (start/end가 있는 항목) */
export type CalItem = Item & { start: string; end: string };

export const isPlaced = (i: Item): i is CalItem => !!i.start;

/** start만 있고 end가 없으면 start로 채워서 캘린더용으로 */
export const asCal = (i: Item): CalItem => ({ ...i, start: i.start!, end: i.end ?? i.start! });

/** tone-* 클래스가 쓰는 --tone 변수를 지정 */
export const toneStyle = (color: string) => ({ "--tone": color }) as React.CSSProperties;

export const dateKey = (d: Date) => format(d, "yyyy-MM-dd");

export function timeRange(i: { start: string; end: string }) {
  return `${i.start.slice(11, 16)} – ${i.end.slice(11, 16)}`;
}

/** 드래그 id: item:i6 (여러 주에 걸친 막대는 item:i6:w2), 드롭 id: day:2026-10-30 / tray */
export const dragItemId = (dragId: string) => dragId.split(":")[1];

export function parseDropDate(overId: string): string | null {
  if (!overId.startsWith("day:")) return null;
  return overId.split(":")[1];
}

/** 시작/끝 날짜 (YYYY-MM-DD) */
export const startDay = (i: { start: string }) => i.start.slice(0, 10);
export const endDay = (i: { end: string }) => i.end.slice(0, 10);
export const isMultiDay = (i: { start: string; end: string }) => endDay(i) > startDay(i);

export type Edge = "start" | "end";

/** 좌/우 끝을 끌어 기간 바꾸기: 시작이 끝을 넘거나 끝이 시작보다 앞서지 않게 막는다 */
export function applyResize<T extends { start: string; end: string }>(i: T, edge: Edge, date: string): T {
  if (edge === "start") {
    const d = date > endDay(i) ? endDay(i) : date;
    return { ...i, start: d + i.start.slice(10) };
  }
  const d = date < startDay(i) ? startDay(i) : date;
  return { ...i, end: d + i.end.slice(10) };
}

/** 기간은 유지한 채 n일 이동 */
export function shiftItem<T extends { start: string; end: string }>(i: T, days: number): T {
  const mv = (iso: string) => format(addDays(parseISO(iso.slice(0, 10)), days), "yyyy-MM-dd") + iso.slice(10);
  return { ...i, start: mv(i.start), end: mv(i.end) };
}

export const daysBetween = (from: string, to: string) => differenceInCalendarDays(parseISO(to), parseISO(from));

/** 화면 좌표 아래에 있는 날짜 칸(data-date) 찾기 */
export function dateAtPoint(x: number, y: number): string | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const d = (el as HTMLElement).dataset?.date;
    if (d) return d;
  }
  return null;
}
