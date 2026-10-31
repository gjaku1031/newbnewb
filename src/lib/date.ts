import { format, parseISO, differenceInCalendarDays } from "date-fns";
import { ko } from "date-fns/locale";
import { TODAY } from "@/lib/today";

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

/** "YYYY-MM-DD"가 달력에 있는 날짜인지 (2026-02-31, 2026-03-40 같은 값 거르기) */
export function isRealDate(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(v);
  if (!m) return false;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === mo - 1 && dt.getUTCDate() === d;
}
