"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { addDays, parseISO } from "date-fns";
import { ArrowRight, Check, CheckCircle2, Copy, MessageSquareText, Sparkles, X } from "lucide-react";
import type { RescheduleItem } from "@/lib/types";
import { Card, KindTag, PriorityBadge } from "@/components/ui";
import { fmt } from "@/lib/date";
import { rescheduleProposal } from "@/mocks/reschedule";
import { getItem, items } from "@/mocks/items";
import { displayKind } from "@/lib/items";
import { TODAY } from "@/mocks/today";

const CLAUDE_PROMPT = `newb의 재배치 제안(r1)을 불러와서 같이 상의하자. 법인카드 정리를 월요일로 미루는 게 괜찮은지 봐줘.`;

export function RescheduleView() {
  const p = rescheduleProposal;
  const [decisions, setDecisions] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(p.items.map((it) => [it.itemId, true])),
  );
  const [applied, setApplied] = useState(false);
  const [copied, setCopied] = useState(false);

  const acceptedCount = Object.values(decisions).filter(Boolean).length;

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(CLAUDE_PROMPT);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      /* 클립보드 권한이 없으면 무시 */
    }
  };

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
      <div className="space-y-4">
        {/* 요약 */}
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <div className="grid size-9 shrink-0 place-items-center rounded-lg bg-warn-soft text-warn">
              <Sparkles className="size-4.5" />
            </div>
            <div>
              <div className="text-[12.5px] text-muted tabular">
                {fmt(p.createdAt, "M월 d일 (EEE) HH:mm")} · 변경 {p.items.length}건 제안
              </div>
              <p className="mt-1 text-[14.5px] leading-relaxed">{p.summary}</p>
            </div>
          </div>
        </Card>

        {applied && (
          <div className="flex items-center gap-2 rounded-xl border border-ok/30 bg-ok-soft px-4 py-3 text-[13.5px] text-ok">
            <CheckCircle2 className="size-4.5" />
            <span>
              <b>{acceptedCount}건</b> 반영
            </span>
            <Link href="/calendar" className="ml-auto font-medium underline underline-offset-2">
              캘린더 보기
            </Link>
          </div>
        )}

        {/* 항목 */}
        <ul className="space-y-3">
          {p.items.map((it) => (
            <ItemRow
              key={it.itemId}
              it={it}
              accepted={decisions[it.itemId]}
              disabled={applied}
              onChange={(v) => setDecisions((d) => ({ ...d, [it.itemId]: v }))}
            />
          ))}
        </ul>

        <div className="sticky bottom-4 z-10 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface/95 px-4 py-3 shadow-pop backdrop-blur">
          <span className="text-[13.5px] text-muted">
            <b className="text-ink tabular">{acceptedCount}</b> / {p.items.length}건 수락
          </span>
          <div className="flex gap-2">
            <Link
              href="/calendar"
              className="inline-flex h-9 items-center rounded-lg px-3.5 text-[14px] font-medium text-muted hover:bg-sunken hover:text-ink"
            >
              나중에
            </Link>
            <button
              type="button"
              disabled={applied || acceptedCount === 0}
              onClick={() => setApplied(true)}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-4 text-[14px] font-medium text-white hover:bg-accent-ink disabled:opacity-50"
            >
              <Check className="size-4" />
              {applied ? "반영 완료" : "선택한 변경 캘린더에 반영"}
            </button>
          </div>
        </div>
      </div>

      {/* 오른쪽: 부하 미리보기 + Claude 상의 */}
      <aside className="space-y-4">
        <LoadPreview decisions={decisions} />
        <Card className="p-5">
          <div className="flex items-center gap-2 text-[14px] font-semibold">
            <MessageSquareText className="size-4 text-accent" />
            Claude Desktop에서 이어서 상의하기
          </div>
          <div className="mt-3 rounded-lg bg-sunken p-3 text-[12.5px] leading-relaxed">{CLAUDE_PROMPT}</div>
          <button
            type="button"
            onClick={copyPrompt}
            className="mt-2 inline-flex h-8 items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] hover:bg-sunken"
          >
            {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5 text-muted" />}
            {copied ? "복사했어요" : "예시 문장 복사"}
          </button>
        </Card>
      </aside>
    </div>
  );
}

function ItemRow({
  it,
  accepted,
  disabled,
  onChange,
}: {
  it: RescheduleItem;
  accepted: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  const q = getItem(it.itemId);
  if (!q) return null;
  const prioChanged = it.fromPriority !== it.toPriority;
  return (
    <li
      className={clsx(
        "rounded-xl border bg-surface p-4 shadow-card transition-opacity",
        accepted ? "border-line" : "border-dashed border-line-strong opacity-60",
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="mb-1 flex items-center gap-1.5">
            {q.priority && <PriorityBadge p={q.priority} />}
            <KindTag kind={displayKind(q)} />
          </div>
          <Link href={`/items/${q.id}`} className="text-[14.5px] font-semibold hover:underline">
            {q.title}
          </Link>
        </div>
        <div className="flex shrink-0 rounded-lg bg-sunken p-0.5">
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(true)}
            className={clsx(
              "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[12.5px] font-medium",
              accepted ? "bg-surface text-ok shadow-card" : "text-muted hover:text-ink",
            )}
          >
            <Check className="size-3.5" /> 수락
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onChange(false)}
            className={clsx(
              "inline-flex h-7 items-center gap-1 rounded-md px-2.5 text-[12.5px] font-medium",
              !accepted ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
            )}
          >
            <X className="size-3.5" /> 그대로 두기
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px]">
        <div className="flex items-center gap-2">
          <span className="w-10 text-muted">날짜</span>
          <span className={clsx("tabular", "text-muted line-through decoration-faint")}>
            {it.fromDate ? fmt(it.fromDate, "M/d (EEE)") : "미배치"}
          </span>
          <ArrowRight className="size-3.5 text-faint" />
          <span className="font-semibold tabular">{fmt(it.toDate, "M/d (EEE)")}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-14 text-muted">우선순위</span>
          {prioChanged ? (
            <>
              <span className="opacity-60">
                <PriorityBadge p={it.fromPriority} />
              </span>
              <ArrowRight className="size-3.5 text-faint" />
              <PriorityBadge p={it.toPriority} />
            </>
          ) : (
            <span className="text-faint">변경 없음 ({it.toPriority})</span>
          )}
        </div>
        {q.due && (
          <div className="flex items-center gap-2 text-muted">
            <span>마감</span>
            <span className="tabular text-ink">{fmt(q.due, "M/d (EEE)")}</span>
          </div>
        )}
      </div>

      <p className="mt-2.5 rounded-lg bg-sunken px-3 py-2 text-[13px] leading-relaxed text-muted">{it.reason}</p>
    </li>
  );
}

/** 날짜별 배치된 할 일 수 — 변경 전/후 비교 */
function LoadPreview({ decisions }: { decisions: Record<string, boolean> }) {
  const days = Array.from({ length: 8 }, (_, i) => fmt(addDays(parseISO(TODAY), i), "yyyy-MM-dd"));
  const active = items.filter((q) => q.kind === "task" && q.status !== "done");

  const countFor = (day: string, after: boolean) =>
    active.filter((q) => {
      const it = rescheduleProposal.items.find((x) => x.itemId === q.id);
      const date = after && it && decisions[q.id] ? it.toDate : q.start?.slice(0, 10);
      return date === day;
    }).length;

  const rows = days.map((d) => ({ d, before: countFor(d, false), after: countFor(d, true) }));
  const max = Math.max(1, ...rows.flatMap((r) => [r.before, r.after]));

  return (
    <Card className="p-5">
      <div className="text-[14px] font-semibold">날짜별 할 일 수</div>
      <div className="mt-1 flex items-center gap-3 text-[12px] text-muted">
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-line-strong" /> 지금
        </span>
        <span className="flex items-center gap-1">
          <span className="size-2 rounded-sm bg-accent" /> 반영 후
        </span>
      </div>
      <div className="mt-4 flex h-[120px] items-end justify-between gap-1.5">
        {rows.map(({ d, before, after }) => (
          <div key={d} className="flex flex-1 flex-col items-center gap-1">
            <div className="flex h-[92px] w-full items-end justify-center gap-[3px]">
              <div
                className="w-2.5 rounded-t-[3px] bg-line-strong"
                style={{ height: `${(before / max) * 100}%`, minHeight: before ? 4 : 0 }}
                title={`지금 ${before}개`}
              />
              <div
                className="w-2.5 rounded-t-[3px] bg-accent"
                style={{ height: `${(after / max) * 100}%`, minHeight: after ? 4 : 0 }}
                title={`반영 후 ${after}개`}
              />
            </div>
            <span className={clsx("text-[11px] tabular", d === TODAY ? "font-semibold text-accent" : "text-muted")}>
              {fmt(d, "d")}
              <span className="text-faint">{fmt(d, "EEEEE")}</span>
            </span>
          </div>
        ))}
      </div>
    </Card>
  );
}
