"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import { addDays, parseISO } from "date-fns";
import { fmt } from "@/lib/date";
import { TODAY } from "@/mocks/today";

/** 다음 노출 간격 — 망각 곡선 계산은 내부에서만 (지금은 단순히 2배, 최대 60일) */
export function nextInterval(days: number) {
  return Math.min(60, Math.max(1, days * 2));
}

/** 복습했음 버튼: 누르면 다음 복습일이 뒤로 밀린다 (목업: 화면 상태만) */
export function ReviewDoneButton({ intervalDays, size = "md" }: { intervalDays: number; size?: "sm" | "md" }) {
  const [done, setDone] = useState(false);
  const next = fmt(addDays(parseISO(TODAY), nextInterval(intervalDays)), "M/d");
  return (
    <button
      type="button"
      onClick={() => setDone((v) => !v)}
      title={done ? "되돌리기" : undefined}
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 rounded-md font-medium transition-colors",
        size === "sm" ? "h-7 px-2 text-[12px]" : "h-8 px-2.5 text-[12.5px]",
        done ? "bg-ok-soft text-ok" : "border border-line bg-surface hover:bg-sunken",
      )}
    >
      <Check className="size-3.5" />
      {done ? `복습함 · 다음 ${next}` : "복습했음"}
    </button>
  );
}
