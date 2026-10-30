import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ko } from "date-fns/locale";
import { TODAY } from "@/mocks/today";

export const today = () => parseISO(TODAY);

export function fmt(dateLike: string | Date, pattern: string) {
  const d = typeof dateLike === "string" ? parseISO(dateLike) : dateLike;
  return format(d, pattern, { locale: ko });
}

/** "오늘", "내일", "D-3", "2일 지남" */
export function dueLabel(due: string) {
  const diff = differenceInCalendarDays(parseISO(due), today());
  if (diff === 0) return "오늘";
  if (diff === 1) return "내일";
  if (diff > 1) return `D-${diff}`;
  return `${-diff}일 지남`;
}

export function dueTone(due: string): "danger" | "warn" | "muted" {
  const diff = differenceInCalendarDays(parseISO(due), today());
  if (diff <= 0) return "danger";
  if (diff <= 2) return "warn";
  return "muted";
}
