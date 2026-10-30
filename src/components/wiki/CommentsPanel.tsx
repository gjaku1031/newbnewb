"use client";

import { useState } from "react";
import clsx from "clsx";
import { Bot, Check, Loader2, Pencil, Trash2 } from "lucide-react";
import type { CommentStatus, WikiComment } from "@/lib/wikiTypes";
import { fmt } from "@/lib/date";
import { Button } from "@/components/ui";
import { addComment, deleteComment, updateComment } from "./store";

export interface Draft {
  anchor: WikiComment["anchor"];
  text: string;
  /** 수정 중인 주석 id (없으면 새 주석) */
  id?: string;
}

const STATUS: Record<CommentStatus, { label: string; cls: string } | null> = {
  open: null,
  requested: { label: "반영 요청됨", cls: "bg-info-soft text-info" },
  applied: { label: "반영됨", cls: "bg-ok-soft text-ok" },
};

function Quote({ anchor }: { anchor: WikiComment["anchor"] }) {
  if (!anchor) return <span className="inline-flex rounded bg-sunken px-1.5 text-[11.5px] text-muted">문서 전체</span>;
  return (
    <div className="line-clamp-2 border-l-2 border-warn/70 pl-2 text-[12.5px] leading-snug text-muted">
      {anchor.quote}
    </div>
  );
}

/** 구글 독스 댓글처럼: 주석 목록 + 작성창 + 한 번에 Claude에게 반영 요청 */
export function CommentsPanel({
  slug,
  comments,
  draft,
  onDraft,
  activeId,
  onFocus,
  requesting,
  onRequest,
}: {
  slug: string;
  comments: WikiComment[];
  draft: Draft | null;
  onDraft: (d: Draft | null) => void;
  activeId: string | null;
  onFocus: (c: WikiComment) => void;
  requesting: boolean;
  onRequest: () => void;
}) {
  const [showClosed, setShowClosed] = useState(false);
  const open = comments.filter((c) => c.status === "open");
  const requested = comments.filter((c) => c.status === "requested");
  const closed = comments.filter((c) => c.status === "applied");
  const list = [...open, ...requested, ...(showClosed ? closed : [])];

  return (
    <section aria-label="주석">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[13px] font-semibold">
          주석 <span className="font-normal text-faint tabular">{open.length}</span>
        </h2>
        <Button size="sm" variant="primary" onClick={onRequest} disabled={open.length === 0 || requesting}>
          {requesting ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
          반영 요청
        </Button>
      </div>

      <div className="mt-3 space-y-2">
        {draft && !draft.id && (
          <Composer
            key={`new-${draft.anchor?.line ?? "doc"}-${draft.anchor?.quote ?? ""}`}
            draft={draft}
            slug={slug}
            onDraft={onDraft}
          />
        )}

        {list.map((c) =>
          draft?.id === c.id ? (
            <Composer key={c.id} draft={draft} slug={slug} onDraft={onDraft} />
          ) : (
            <div
              key={c.id}
              role="button"
              tabIndex={0}
              onClick={() => onFocus(c)}
              onKeyDown={(e) => e.key === "Enter" && onFocus(c)}
              className={clsx(
                "group cursor-pointer rounded-lg border bg-surface px-3 py-2.5 transition-colors",
                activeId === c.id ? "border-warn/60 shadow-card" : "border-line hover:border-line-strong",
                c.status === "applied" && "opacity-60",
              )}
            >
              <Quote anchor={c.anchor} />
              <p className="mt-1.5 text-[13.5px] leading-snug whitespace-pre-wrap">{c.text}</p>
              {c.note && <p className="mt-1 text-[12px] text-warn">{c.note}</p>}
              <div className="mt-2 flex items-center gap-2 text-[11.5px] text-faint">
                <span className="tabular">{fmt(c.at, "M/d HH:mm")}</span>
                {STATUS[c.status] && (
                  <span className={clsx("rounded-full px-1.5 py-px font-semibold", STATUS[c.status]!.cls)}>
                    {STATUS[c.status]!.label}
                  </span>
                )}
                {c.status === "open" && (
                  <span className="ml-auto flex gap-0.5 opacity-100 md:opacity-0 md:group-hover:opacity-100">
                    <button
                      type="button"
                      aria-label="주석 수정"
                      onClick={(e) => {
                        e.stopPropagation();
                        onDraft({ id: c.id, anchor: c.anchor, text: c.text });
                      }}
                      className="grid size-6 place-items-center rounded hover:bg-sunken hover:text-ink"
                    >
                      <Pencil className="size-3.5" />
                    </button>
                    <button
                      type="button"
                      aria-label="주석 삭제"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteComment(c.id);
                      }}
                      className="grid size-6 place-items-center rounded hover:bg-sunken hover:text-danger"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </span>
                )}
              </div>
            </div>
          ),
        )}

        {list.length === 0 && !draft && (
          <p className="rounded-lg border border-dashed border-line px-3 py-4 text-center text-[12.5px] text-faint">
            주석 없음
          </p>
        )}

        {closed.length > 0 && (
          <button
            type="button"
            onClick={() => setShowClosed((v) => !v)}
            className="inline-flex items-center gap-1 px-1 text-[12px] font-medium text-muted hover:text-ink"
          >
            <Check className="size-3.5" />
            반영됨 {closed.length} {showClosed ? "숨기기" : "보기"}
          </button>
        )}
      </div>
    </section>
  );
}

function Composer({ draft, slug, onDraft }: { draft: Draft; slug: string; onDraft: (d: Draft | null) => void }) {
  const [text, setText] = useState(draft.text);
  const save = () => {
    if (!text.trim()) return;
    if (draft.id) updateComment(draft.id, text);
    else addComment(slug, draft.anchor, text);
    onDraft(null);
  };
  return (
    <div className="rounded-lg border border-accent/50 bg-surface px-3 py-2.5 shadow-card">
      <Quote anchor={draft.anchor} />
      <textarea
        autoFocus
        aria-label="주석 내용"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
          if (e.key === "Escape") onDraft(null);
        }}
        rows={3}
        placeholder="어떻게 고쳐야 하는지"
        className="mt-2 w-full resize-y rounded-md border border-line bg-bg px-2.5 py-2 text-[16px] leading-snug outline-none focus:border-accent md:text-[13.5px]"
      />
      <div className="mt-2 flex justify-end gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => onDraft(null)}>
          취소
        </Button>
        <Button size="sm" variant="primary" onClick={save} disabled={!text.trim()}>
          {draft.id ? "저장" : "추가"}
        </Button>
      </div>
    </div>
  );
}
