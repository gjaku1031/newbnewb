"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronRight, ListTodo, Target } from "lucide-react";
import { EmptyState, VerdictBadge } from "@/components/ui";
import { fmt } from "@/lib/date";
import type { QuestionRecord, Verdict } from "@/lib/types";
import { getItem } from "@/mocks/items";

type VerdictFilter = "all" | Verdict;
type StatusFilter = "all" | QuestionRecord["status"];

const VERDICT_TABS: { key: VerdictFilter; label: string }[] = [
  { key: "all", label: "전체" },
  { key: "NEED_INFO", label: "알아올 것 있음" },
  { key: "ANSWER_WITH_CAVEAT", label: "조건부" },
  { key: "ANSWER", label: "확답" },
];

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "모든 상태" },
  { key: "open", label: "진행 중" },
  { key: "resolved", label: "해결됨" },
];

export function QuestionList({ items }: { items: QuestionRecord[] }) {
  const [verdict, setVerdict] = useState<VerdictFilter>("all");
  const [status, setStatus] = useState<StatusFilter>("all");

  const filtered = useMemo(
    () =>
      items
        .filter((q) => verdict === "all" || q.verdict === verdict)
        .filter((q) => status === "all" || q.status === status)
        .sort((a, b) => b.askedAt.localeCompare(a.askedAt)),
    [items, verdict, status],
  );

  const count = (v: VerdictFilter) => (v === "all" ? items.length : items.filter((q) => q.verdict === v).length);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex gap-1 rounded-lg bg-sunken p-1">
          {VERDICT_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setVerdict(t.key)}
              className={clsx(
                "h-8 rounded-md px-3 text-[13.5px] transition-colors",
                verdict === t.key ? "bg-surface font-medium text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              {t.label}
              <span className="ml-1.5 text-[12px] text-faint tabular">{count(t.key)}</span>
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          {STATUS_TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setStatus(t.key)}
              className={clsx(
                "h-8 rounded-full border px-3 text-[13px] transition-colors",
                status === t.key
                  ? "border-accent bg-accent-soft font-medium text-accent-ink"
                  : "border-line text-muted hover:bg-sunken",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-line bg-surface shadow-card">
        {filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState title="조건에 맞는 질문이 없어요" />
          </div>
        ) : (
          <ul className="divide-y divide-line">
            {filtered.map((q) => {
              const openMissing = q.missing.filter((m) => !m.done).length;
              const quest = q.itemId ? getItem(q.itemId) : undefined;
              return (
                <li key={q.id}>
                  <Link
                    href={`/questions/${q.id}`}
                    className="group grid grid-cols-[1fr_auto] items-center gap-4 px-5 py-4 hover:bg-sunken/50"
                  >
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <VerdictBadge v={q.verdict} />
                        <span className="text-[12px] text-faint tabular">
                          확신도 {Math.round(q.confidence * 100)}%
                        </span>
                        {q.status === "open" ? (
                          <span className="text-[12px] font-medium text-info">· 진행 중</span>
                        ) : (
                          <span className="text-[12px] text-faint">· 해결됨</span>
                        )}
                      </div>
                      <p className="mt-1.5 truncate text-[15px] font-medium">{q.question}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12.5px] text-muted">
                        <span className="tabular">{fmt(q.askedAt, "M월 d일 (E) HH:mm")}</span>
                        {q.missing.length > 0 && (
                          <span className={clsx("inline-flex items-center gap-1", openMissing > 0 && "text-info")}>
                            <ListTodo className="size-3.5" />
                            알아올 것 {openMissing > 0 ? `${openMissing}개 남음` : "모두 완료"}
                          </span>
                        )}
                        {quest && (
                          <span className="inline-flex min-w-0 items-center gap-1">
                            <Target className="size-3.5 shrink-0" />
                            <span className="truncate">{quest.title}</span>
                          </span>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="size-4 text-faint group-hover:text-ink" />
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
