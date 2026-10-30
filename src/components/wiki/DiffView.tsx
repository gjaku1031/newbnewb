"use client";

import { useState } from "react";
import clsx from "clsx";
import type { PageContent } from "@/lib/wikiTypes";
import { collapse, diffLines, diffStats } from "@/lib/diff";

/** git diff처럼: 삭제(빨강) / 추가(초록), 변경 없는 줄은 접기 */
export function DiffView({ before, after }: { before: PageContent; after: PageContent }) {
  const lines = diffLines(before.body, after.body);
  const [open, setOpen] = useState<Set<number>>(new Set());
  const rows = collapse(lines, 2);
  const stats = diffStats(lines);
  const fieldChanged = (k: "title" | "summary") => before[k] !== after[k];

  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface text-[12.5px]">
      <div className="flex items-center gap-3 border-b border-line bg-sunken/60 px-3 py-1.5 text-[12px] text-muted tabular">
        <span className="font-semibold text-ok">+{stats.add}</span>
        <span className="font-semibold text-danger">−{stats.del}</span>
      </div>

      {(["title", "summary"] as const).map(
        (k) =>
          fieldChanged(k) && (
            <div key={k} className="border-b border-line px-3 py-2">
              <div className="mb-1 text-[11.5px] font-semibold text-faint">{k === "title" ? "제목" : "요약"}</div>
              {before[k] && <div className="rounded bg-danger-soft px-2 py-0.5 text-danger line-through">{before[k]}</div>}
              <div className="mt-0.5 rounded bg-ok-soft px-2 py-0.5 text-ok">{after[k]}</div>
            </div>
          ),
      )}

      <div className="overflow-x-auto font-mono leading-[1.65]">
        {rows.length === 0 && <div className="px-3 py-2 text-faint">본문 변경 없음</div>}
        {rows.map((row, idx) => {
          if (row.type === "skip") {
            if (open.has(row.from)) {
              return lines.slice(row.from, row.from + row.count).map((l, k) => (
                <Line key={`${idx}-${k}`} type="same" a={"a" in l ? l.a : undefined} b={"b" in l ? l.b : undefined} text={l.text} />
              ));
            }
            return (
              <button
                key={idx}
                type="button"
                onClick={() => setOpen((s) => new Set(s).add(row.from))}
                className="block w-full border-y border-line bg-sunken/50 px-3 py-0.5 text-left text-[11.5px] text-faint hover:text-muted"
              >
                ⋯ {row.count}줄
              </button>
            );
          }
          return (
            <Line
              key={idx}
              type={row.type}
              a={"a" in row ? row.a : undefined}
              b={"b" in row ? row.b : undefined}
              text={row.text}
            />
          );
        })}
      </div>
    </div>
  );
}

function Line({ type, a, b, text }: { type: "same" | "add" | "del"; a?: number; b?: number; text: string }) {
  return (
    <div
      className={clsx(
        "flex min-w-max",
        type === "add" && "bg-ok-soft text-ok",
        type === "del" && "bg-danger-soft text-danger",
        type === "same" && "text-muted",
      )}
    >
      <span className="w-9 shrink-0 pr-1.5 text-right text-faint/80 select-none tabular">{type === "add" ? "" : a}</span>
      <span className="w-9 shrink-0 pr-1.5 text-right text-faint/80 select-none tabular">{type === "del" ? "" : b}</span>
      <span className="w-4 shrink-0 text-center select-none">{type === "add" ? "+" : type === "del" ? "−" : ""}</span>
      <span className="pr-3 whitespace-pre-wrap">{text || " "}</span>
    </div>
  );
}
