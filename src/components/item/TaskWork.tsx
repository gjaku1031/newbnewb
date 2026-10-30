"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, CheckCircle2, Plus, RotateCcw, X } from "lucide-react";
import type { SubItem } from "@/lib/types";
import { KindTag } from "@/components/ui";

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
 * 하위 항목을 추가/삭제하면 유형이 자동으로 바뀐다. (목업: 화면 상태만)
 */
export function TaskWork({
  initialSubItems,
  initialDone,
  itemId,
}: {
  initialSubItems: SubItem[];
  initialDone: boolean;
  itemId: string;
}) {
  const [subs, setSubs] = useState(initialSubItems);
  const [simpleDone, setSimpleDone] = useState(initialDone);
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);

  const isTask = subs.length > 0;
  const doneCount = subs.filter((s) => s.done).length;
  const value = isTask ? Math.round((doneCount / subs.length) * 100) : simpleDone ? 100 : 0;
  const next = subs.find((s) => !s.done);

  const toggle = (id: string) => setSubs((l) => l.map((s) => (s.id === id ? { ...s, done: !s.done } : s)));
  const remove = (id: string) => setSubs((l) => l.filter((s) => s.id !== id));
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setSubs((l) => [...l, { id: `${itemId}-n${Date.now()}`, title, done: false }]);
    setDraft("");
  };

  const addRow = adding ? (
    <div className="flex items-center gap-2 px-3 py-2">
      <span className="grid size-5 shrink-0 place-items-center rounded-md border border-dashed border-line-strong" />
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") add();
          if (e.key === "Escape") {
            setAdding(false);
            setDraft("");
          }
        }}
        placeholder="하위 항목"
        className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-faint"
      />
      <button
        type="button"
        onClick={add}
        className="h-7 rounded-md bg-accent px-2.5 text-[12.5px] font-medium text-white hover:bg-accent-ink"
      >
        추가
      </button>
    </div>
  ) : (
    <button
      type="button"
      onClick={() => setAdding(true)}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-[13.5px] text-muted hover:bg-sunken hover:text-ink"
    >
      <Plus className="size-4" /> 하위 항목 추가
    </button>
  );

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
              onClick={() => setSimpleDone(false)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-[14px] text-muted hover:text-ink"
            >
              <RotateCcw className="size-4" /> 되돌리기
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setSimpleDone(true)}
              className="inline-flex h-10 items-center gap-1.5 rounded-lg bg-accent px-5 text-[14.5px] font-semibold text-white hover:bg-accent-ink"
            >
              <Check className="size-4.5" /> 완료
            </button>
          )}
        </div>
        {!simpleDone && <div className="border-t border-line p-2">{addRow}</div>}
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
      <ul className="p-2">
        {subs.map((s, i) => (
          <li key={s.id} className="group flex items-center rounded-lg hover:bg-sunken">
            <button
              type="button"
              onClick={() => toggle(s.id)}
              className={clsx(
                "flex min-w-0 flex-1 items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[14px]",
                next?.id === s.id && "bg-accent-soft/60",
              )}
            >
              <span
                className={clsx(
                  "grid size-5 shrink-0 place-items-center rounded-md border transition-colors",
                  s.done ? "border-ok bg-ok text-white" : "border-line-strong bg-surface",
                )}
              >
                {s.done && <Check className="size-3.5" strokeWidth={3} />}
              </span>
              <span className="w-5 shrink-0 text-[12px] text-faint tabular">{i + 1}</span>
              <span className={clsx("flex-1", s.done && "text-muted line-through decoration-faint")}>{s.title}</span>
            </button>
            <button
              type="button"
              onClick={() => remove(s.id)}
              aria-label={`${s.title} 삭제`}
              className="mr-2 grid size-7 shrink-0 place-items-center rounded-md text-faint opacity-0 group-hover:opacity-100 hover:bg-surface hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </li>
        ))}
        <li>{addRow}</li>
      </ul>
    </div>
  );
}
