"use client";

import clsx from "clsx";
import { Check, CheckCircle2, RotateCcw } from "lucide-react";
import type { Item } from "@/lib/types";
import { KindTag } from "@/components/ui";
import { SubItemsEditor } from "./fields";

/** 큰 달성률 링 */
function BigRing({ value }: { value: number }) {
  const size = 104;
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const done = value >= 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? "var(--ok)" : "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
          style={{ transition: "stroke-dashoffset 400ms ease" }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center text-[24px] font-bold tabular">{value}%</div>
    </div>
  );
}

/**
 * 할 일 진행 블록.
 * 하위 항목이 있으면 "작업"(체크리스트 + 달성률), 없으면 "단순 작업"(완료 버튼).
 * 하위 항목을 추가/삭제하면 유형이 자동으로 바뀐다.
 */
export function TaskWork({ item, onUpdate }: { item: Item; onUpdate: (fn: (i: Item) => Item) => void }) {
  const subs = item.subItems;
  const isTask = subs.length > 0;
  const doneCount = subs.filter((s) => s.done).length;
  const simpleDone = item.status === "done";
  const value = isTask ? Math.round((doneCount / subs.length) * 100) : simpleDone ? 100 : 0;
  const next = subs.find((s) => !s.done);

  if (!isTask) {
    return (
      <div
        className={clsx(
          "rounded-xl border shadow-card transition-colors",
          simpleDone ? "border-ok/30 bg-ok-soft" : "border-line bg-surface",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-3">
            <CheckCircle2 className={clsx("size-8", simpleDone ? "text-ok" : "text-faint")} strokeWidth={1.6} />
            <div className="flex items-center gap-2">
              <KindTag kind="simple" />
              {simpleDone && <span className="text-[15px] font-semibold">완료</span>}
            </div>
          </div>
          {simpleDone ? (
            <button
              type="button"
              onClick={() => onUpdate((i) => ({ ...i, status: "todo" }))}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-[14px] text-muted hover:text-ink"
            >
              <RotateCcw className="size-4" /> 되돌리기
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onUpdate((i) => ({ ...i, status: "done" }))}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-5 text-[14.5px] font-semibold text-white hover:bg-accent-ink"
            >
              <Check className="size-4.5" /> 완료
            </button>
          )}
        </div>
        {!simpleDone && (
          <div className="border-t border-line p-3">
            <SubItemsEditor item={item} onUpdate={onUpdate} large />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-surface shadow-card">
      <div className="flex flex-wrap items-center gap-6 border-b border-line p-5">
        <BigRing value={value} />
        <div className="min-w-0 flex-1">
          <KindTag kind="task" />
          <div className="mt-1.5 text-[22px] font-bold tabular">
            {doneCount} <span className="text-faint">/ {subs.length}</span>
          </div>
          {next && (
            <div className="mt-1 text-[13.5px]">
              <span className="text-muted">다음 · </span>
              <span className="font-medium">{next.title}</span>
            </div>
          )}
        </div>
      </div>
      <div className="p-3">
        <SubItemsEditor item={item} onUpdate={onUpdate} large />
      </div>
    </div>
  );
}
