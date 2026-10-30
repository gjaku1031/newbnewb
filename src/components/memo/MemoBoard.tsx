"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { BookOpen, CalendarPlus, HelpCircle, ListPlus, Loader2, ShieldAlert, Sparkles, Trash2 } from "lucide-react";
import type { Memo, MemoAction, MemoActionKind } from "@/lib/memoTypes";
import { fmt } from "@/lib/date";
import { useWiki } from "@/components/wiki/store";
import { addMemo, deleteMemo, useMemos } from "./store";
import { ItemLink } from "@/components/item/ItemPeek";

const ACTION_ICON: Record<MemoActionKind, typeof CalendarPlus> = {
  create_event: CalendarPlus,
  create_task: ListPlus,
  ask: HelpCircle,
  update_wiki: BookOpen,
  add_caution: ShieldAlert,
};

const ACTION_TONE: Record<MemoActionKind, string> = {
  create_event: "text-[var(--kind-event)]",
  create_task: "text-[var(--kind-simple)]",
  ask: "text-info",
  update_wiki: "text-accent",
  add_caution: "text-warn",
};

/** 메모 입력창 (메모 탭 상단 · 빠른 메모 공용) */
export function MemoComposer({ onSaved, autoFocus }: { onSaved?: () => void; autoFocus?: boolean }) {
  const [text, setText] = useState("");
  const save = () => {
    const t = text.trim();
    if (!t) return;
    addMemo(t);
    setText("");
    onSaved?.();
  };
  return (
    <div className="rounded-xl border border-line bg-surface shadow-card focus-within:border-line-strong">
      <textarea
        autoFocus={autoFocus}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            save();
          }
        }}
        rows={3}
        placeholder="대충 적어두기"
        className="block w-full resize-none bg-transparent px-4 pt-3 text-[16px] leading-relaxed outline-none placeholder:text-faint lg:text-[15px]"
      />
      <div className="flex items-center justify-end gap-2 px-3 pb-2.5">
        <span className="hidden text-[12px] text-faint sm:inline">Ctrl + Enter</span>
        <button
          type="button"
          onClick={save}
          disabled={!text.trim()}
          className="h-8 rounded-lg bg-accent px-3.5 text-[13px] font-medium text-white hover:bg-accent-ink disabled:opacity-40"
        >
          메모
        </button>
      </div>
    </div>
  );
}

function WikiStatus({ revisionId }: { revisionId: string }) {
  const wiki = useWiki();
  const r = wiki.revisions.find((x) => x.id === revisionId);
  if (!r) return null;
  const map = {
    reviewing: { label: "검토 중", cls: "bg-sunken text-muted" },
    pending: { label: "확인 필요", cls: "bg-warn-soft text-warn" },
    applied: { label: "반영됨", cls: "bg-ok-soft text-ok" },
    cancelled: { label: "취소됨", cls: "bg-sunken text-faint" },
  } as const;
  const m = map[r.status];
  return <span className={clsx("ml-1.5 rounded-full px-1.5 py-0.5 text-[11px] font-semibold", m.cls)}>{m.label}</span>;
}

function ActionRow({ a }: { a: MemoAction }) {
  const Icon = ACTION_ICON[a.kind];
  const inner = (
    <>
      <Icon className={clsx("mt-0.5 size-4 shrink-0", ACTION_TONE[a.kind])} />
      <span className="min-w-0 flex-1">
        {a.label}
        {a.revisionId && <WikiStatus revisionId={a.revisionId} />}
      </span>
    </>
  );
  // 항목으로 가는 링크는 사이드 패널로 연다 (저장된 예전 주소 /items/… 도 그대로 처리)
  const itemId = a.href?.match(/^\/items\/([^/?#]+)$/)?.[1];
  const rowCls = "flex gap-2 rounded-md px-2 py-1.5 text-[13.5px] hover:bg-sunken";
  return (
    <li>
      {itemId ? (
        <ItemLink id={decodeURIComponent(itemId)} className={rowCls}>
          {inner}
        </ItemLink>
      ) : a.href ? (
        <Link href={a.href} className="flex gap-2 rounded-md px-2 py-1.5 text-[13.5px] hover:bg-sunken">
          {inner}
        </Link>
      ) : (
        <div className="flex gap-2 px-2 py-1.5 text-[13.5px]">{inner}</div>
      )}
    </li>
  );
}

function MemoCard({ memo }: { memo: Memo }) {
  return (
    <article className="group grid overflow-hidden rounded-xl border border-line bg-surface shadow-card lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      {/* 내 메모 원문 */}
      <div className="relative border-b border-line bg-sunken/40 px-5 py-4 lg:border-r lg:border-b-0">
        <div className="flex items-center justify-between gap-2 text-[12px] text-faint">
          <span className="tabular">{fmt(memo.createdAt, "M/d (EEE) HH:mm")}</span>
          <button
            type="button"
            onClick={() => deleteMemo(memo.id)}
            aria-label="메모 삭제"
            className="grid size-7 place-items-center rounded-md opacity-0 transition-opacity group-hover:opacity-100 hover:bg-sunken hover:text-danger focus:opacity-100"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
        <p className="mt-1 text-[14.5px] leading-relaxed whitespace-pre-wrap">{memo.text}</p>
      </div>

      {/* Claude 정리 */}
      <div className="px-5 py-4">
        <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-accent">
          <Sparkles className="size-3.5" />
          Claude 정리
        </div>
        {memo.status === "processing" || !memo.result ? (
          <div className="flex items-center gap-2 py-2 text-[13.5px] text-muted">
            <Loader2 className="size-4 animate-spin" />
            정리 중
          </div>
        ) : (
          <>
            <p className="text-[14.5px] leading-relaxed">{memo.result.cleaned}</p>
            {memo.result.actions.length > 0 ? (
              <ul className="mt-3 -mx-2 space-y-0.5">
                {memo.result.actions.map((a, i) => (
                  <ActionRow key={i} a={a} />
                ))}
              </ul>
            ) : (
              <p className="mt-2 text-[13px] text-faint">반영할 내용 없음</p>
            )}
          </>
        )}
      </div>
    </article>
  );
}

export function MemoBoard() {
  const memos = useMemos();
  return (
    <div className="mx-auto max-w-[1100px] space-y-6">
      <MemoComposer />
      <div className="space-y-3">
        {memos.map((m) => (
          <MemoCard key={m.id} memo={m} />
        ))}
      </div>
    </div>
  );
}
