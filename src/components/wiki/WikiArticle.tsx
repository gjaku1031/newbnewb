"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Bot, Check, ChevronDown, ChevronRight, Loader2, MessageSquarePlus, X } from "lucide-react";
import type { WikiPage } from "@/lib/types";
import type { Revision, RevisionStatus, WikiComment } from "@/lib/wikiTypes";
import { fmt } from "@/lib/date";
import { diffLines, diffStats } from "@/lib/diff";
import { Markdown, extractHeadings } from "@/lib/markdown";
import { Button } from "@/components/ui";
import { DiffView } from "./DiffView";
import { IssueBox } from "./IssueBox";
import { OnThisPage } from "./OnThisPage";
import { CommentsPanel, type Draft } from "./CommentsPanel";
import {
  applyRevision,
  cancelRevision,
  commentsOf,
  effectivePage,
  openComments,
  requestClaudeEdit,
  revisionsOf,
  useWiki,
} from "./store";

const STATUS: Record<RevisionStatus, { label: string; cls: string }> = {
  applied: { label: "반영됨", cls: "bg-ok-soft text-ok" },
  pending: { label: "확인 대기", cls: "bg-warn-soft text-warn" },
  reviewing: { label: "검토 중", cls: "bg-info-soft text-info" },
  cancelled: { label: "취소", cls: "bg-sunken text-faint" },
};

function StatusPill({ status }: { status: RevisionStatus }) {
  const s = STATUS[status];
  return (
    <span
      className={clsx(
        "inline-flex h-[20px] shrink-0 items-center rounded-full px-2 text-[11.5px] font-semibold",
        s.cls,
      )}
    >
      {s.label}
    </span>
  );
}

const author = (r: Revision) => (r.author === "me" ? "나" : "Claude");

/* 넓은 화면이면 주석 목록을 오른쪽 열에, 아니면 본문 아래에 */
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia("(min-width: 1280px)");
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 1280px)").matches,
    () => true,
  );
}

/** 블록 안에서 인용문 위치를 찾아 Range로 (하이라이트용) */
function findRange(el: Element, quote: string): Range | null {
  const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let text = "";
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    nodes.push(n as Text);
    text += n.textContent ?? "";
  }
  const start = text.indexOf(quote);
  if (start < 0) return null;
  const end = start + quote.length;
  const range = document.createRange();
  let pos = 0;
  let setStart = false;
  for (const n of nodes) {
    const len = n.textContent?.length ?? 0;
    if (!setStart && start <= pos + len) {
      range.setStart(n, start - pos);
      setStart = true;
    }
    if (setStart && end <= pos + len) {
      range.setEnd(n, end - pos);
      return range;
    }
    pos += len;
  }
  return null;
}

/** 위키 본문: 직접 고치지 않고 주석을 달아 Claude에게 한 번에 반영 요청 + 변경 이력 */
export function WikiArticle({
  base,
  number,
  after,
  aside,
}: {
  base: WikiPage;
  number?: string;
  after?: React.ReactNode;
  aside?: React.ReactNode;
}) {
  const s = useWiki();
  const wide = useWide();
  const page = effectivePage(s, base);
  const revs = revisionsOf(s, base.slug);
  const comments = commentsOf(s, base.slug);
  const open = openComments(s, base.slug);
  const inFlight = revs.filter((r) => r.status === "reviewing" || r.status === "pending");
  const latestApplied = revs.find((r) => r.status === "applied");

  const [draft, setDraft] = useState<Draft | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [requesting, setRequesting] = useState(false);
  const [justApplied, setJustApplied] = useState<string | null>(null);
  const [sel, setSel] = useState<{ quote: string; line: number; x: number; y: number } | null>(null);
  const [hover, setHover] = useState<{ line: number; top: number; text: string } | null>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  // 본문에서 글자를 선택하면 '주석' 버튼 (마우스·터치 모두)
  useEffect(() => {
    let t: number | undefined;
    const onChange = () => {
      window.clearTimeout(t);
      t = window.setTimeout(() => {
        const sl = window.getSelection();
        const root = bodyRef.current;
        if (!sl || sl.isCollapsed || !root || sl.rangeCount === 0) return setSel(null);
        const range = sl.getRangeAt(0);
        if (!root.contains(range.commonAncestorContainer)) return setSel(null);
        const node = range.startContainer;
        const el = (node.nodeType === 1 ? node : node.parentElement) as Element | null;
        const block = el?.closest("[data-line]");
        const quote = sl.toString().split("\n")[0].trim();
        if (!block || !quote) return setSel(null);
        const rect = range.getBoundingClientRect();
        setSel({ quote, line: Number(block.getAttribute("data-line")), x: rect.left + rect.width / 2, y: rect.bottom });
      }, 180);
    };
    const hide = () => setSel(null);
    document.addEventListener("selectionchange", onChange);
    window.addEventListener("scroll", hide, { passive: true });
    return () => {
      document.removeEventListener("selectionchange", onChange);
      window.removeEventListener("scroll", hide);
      window.clearTimeout(t);
    };
  }, []);

  // 주석 단 부분 하이라이트 (CSS Custom Highlight API)
  useEffect(() => {
    const root = bodyRef.current;
    if (!root || typeof CSS === "undefined" || !("highlights" in CSS)) return;
    const normal: Range[] = [];
    const active: Range[] = [];
    for (const c of comments) {
      if (!c.anchor || c.status === "applied") continue;
      const el = root.querySelector(`[data-line="${c.anchor.line}"]`);
      const r = el && findRange(el, c.anchor.quote);
      if (r) (c.id === activeId ? active : normal).push(r);
    }
    CSS.highlights.set("wiki-comment", new Highlight(...normal));
    CSS.highlights.set("wiki-comment-active", new Highlight(...active));
    return () => {
      CSS.highlights.delete("wiki-comment");
      CSS.highlights.delete("wiki-comment-active");
    };
  }, [comments, activeId, page.body]);

  const startComment = (anchor: WikiComment["anchor"]) => {
    setDraft({ anchor, text: "" });
    setSel(null);
    window.getSelection()?.removeAllRanges();
  };

  const request = async () => {
    setRequesting(true);
    setJustApplied(null);
    await new Promise((r) => window.setTimeout(r, 600));
    const r = await requestClaudeEdit(base.slug);
    setRequesting(false);
    if (r) setJustApplied(r.id);
  };

  const focusComment = (c: WikiComment) => {
    setActiveId(c.id);
    if (!c.anchor) return;
    bodyRef.current
      ?.querySelector(`[data-line="${c.anchor.line}"]`)
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  const applied = justApplied ? revs.find((r) => r.id === justApplied && r.status === "applied") : undefined;

  const panel = (
    <CommentsPanel
      slug={base.slug}
      comments={comments}
      draft={draft}
      onDraft={setDraft}
      activeId={activeId}
      onFocus={focusComment}
      requesting={requesting}
      onRequest={request}
    />
  );

  return (
    <div className="flex gap-10 px-6 pt-8 pb-20 lg:px-12 lg:pt-10">
      {/* 하이라이트 색 */}
      <style>{`::highlight(wiki-comment){background-color:color-mix(in srgb,var(--warn) 26%,transparent)}::highlight(wiki-comment-active){background-color:color-mix(in srgb,var(--warn) 55%,transparent)}`}</style>

      <article className="min-w-0 max-w-[720px] flex-1">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="위치" className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
            <Link href="/wiki" className="hover:text-ink">
              위키
            </Link>
            <ChevronRight className="size-3.5 text-faint" />
            <span>{page.category}</span>
            <ChevronRight className="size-3.5 text-faint" />
            <span className="text-ink">{page.title}</span>
          </nav>
          <div className="flex shrink-0 gap-2">
            <Button size="sm" onClick={() => startComment(null)}>
              <MessageSquarePlus className="size-3.5" /> 주석
            </Button>
            <Button size="sm" variant="primary" onClick={request} disabled={open.length === 0 || requesting}>
              {requesting ? <Loader2 className="size-3.5 animate-spin" /> : <Bot className="size-3.5" />}
              Claude에게 반영 요청{open.length > 0 && <span className="tabular">({open.length})</span>}
            </Button>
          </div>
        </div>

        <h1 className="mt-4 text-[32px] leading-tight font-bold tracking-[-0.025em]">
          {number && <span className="mr-2.5 text-faint tabular">{number}</span>}
          {page.title}
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">{page.summary}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line pb-5 text-[12.5px] text-faint">
          <span>{fmt(page.updatedAt, "yyyy년 M월 d일")} 갱신</span>
          {latestApplied && (
            <>
              <span>·</span>
              <span className="tabular">v{latestApplied.version}</span>
            </>
          )}
          <span>·</span>
          <span>근거 {page.sourceIds.length}개</span>
          <span>·</span>
          <span>
            다음 복습 {fmt(page.review.nextReview, "M월 d일")} ({page.review.intervalDays}일마다)
          </span>
        </div>

        {requesting && (
          <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-[13.5px] text-info">
            <Loader2 className="size-4 animate-spin" />
            <span className="font-semibold">Claude 수정 중</span>
            <span className="text-muted">· 주석 {open.length}개</span>
          </div>
        )}

        {inFlight.map((r) => (
          <ReviewCard
            key={r.id}
            r={r}
            comments={s.comments}
            onApply={() => {
              applyRevision(r.id);
              setJustApplied(r.id);
            }}
            onCancel={() => cancelRevision(r.id)}
          />
        ))}

        {applied && (
          <div className="mt-6 flex items-center gap-2 rounded-xl border border-ok/30 bg-ok-soft px-4 py-3 text-[13.5px] text-ok">
            <Check className="size-4" />
            <span className="font-semibold">반영됨</span>
            <span className="tabular">v{applied.version}</span>
            <span className="text-muted">· {applied.message}</span>
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setJustApplied(null)}
              className="ml-auto grid size-6 place-items-center rounded text-muted hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>
        )}

        {page.issues?.length ? (
          <div className="mt-6 space-y-2">
            {page.issues.map((issue, i) => (
              <IssueBox key={i} issue={issue} />
            ))}
          </div>
        ) : null}

        {/* 본문 — 선택하면 주석, 문단에 마우스를 올리면 말풍선 */}
        <div
          ref={bodyRef}
          className="relative mt-7 text-[15.5px]"
          onMouseMove={(e) => {
            const block = (e.target as Element).closest?.("[data-line]") as HTMLElement | null;
            if (!block || !bodyRef.current?.contains(block)) return;
            const line = Number(block.dataset.line);
            if (hover?.line === line) return;
            const top = block.getBoundingClientRect().top - bodyRef.current.getBoundingClientRect().top;
            setHover({ line, top, text: (block.textContent ?? "").trim() });
          }}
          onMouseLeave={() => setHover(null)}
        >
          <Markdown source={page.body} />
          {hover && (
            <button
              type="button"
              aria-label="이 문단에 주석"
              onClick={() => startComment({ quote: hover.text, line: hover.line })}
              style={{ top: hover.top }}
              className="absolute -left-10 hidden size-7 place-items-center rounded-md border border-line bg-surface text-muted shadow-card hover:text-accent-ink md:grid"
            >
              <MessageSquarePlus className="size-3.5" />
            </button>
          )}
        </div>

        {!wide && <div className="mt-10">{panel}</div>}

        <History revs={revs} comments={s.comments} />

        {after}
      </article>

      <aside className="hidden w-[300px] shrink-0 xl:block">
        <div className="sticky top-8 max-h-[calc(100dvh-4rem)] space-y-7 overflow-y-auto pb-6">
          {wide && panel}
          <OnThisPage headings={extractHeadings(page.body)} />
          {aside}
        </div>
      </aside>

      {/* 선택 영역 아래 '주석' 버튼 */}
      {sel && (
        <button
          type="button"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => startComment({ quote: sel.quote, line: sel.line })}
          style={{ left: sel.x, top: sel.y + 8 }}
          className="fixed z-40 inline-flex h-9 -translate-x-1/2 items-center gap-1.5 rounded-lg bg-ink px-3 text-[13.5px] font-medium text-bg shadow-pop"
        >
          <MessageSquarePlus className="size-4" /> 주석
        </button>
      )}
    </div>
  );
}

function EditNotes({ r, comments }: { r: Revision; comments: WikiComment[] }) {
  if (!r.edits?.length) return null;
  return (
    <ul className="space-y-1.5">
      {r.edits.map((e) => {
        const c = comments.find((x) => x.id === e.commentId);
        return (
          <li key={e.commentId} className="flex gap-2 text-[12.5px]">
            <span className={clsx("mt-0.5 shrink-0", e.applied ? "text-ok" : "text-faint")}>
              {e.applied ? <Check className="size-3.5" /> : <X className="size-3.5" />}
            </span>
            <span className="min-w-0">
              {c && <span className="text-muted">“{c.text}” </span>}
              <span className={e.applied ? "text-ink" : "text-faint"}>{e.note}</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function ReviewCard({
  r,
  comments,
  onApply,
  onCancel,
}: {
  r: Revision;
  comments: WikiComment[];
  onApply: () => void;
  onCancel: () => void;
}) {
  const [showDiff, setShowDiff] = useState(false);

  if (r.status === "reviewing") {
    return (
      <div className="mt-6 flex items-center gap-2.5 rounded-xl border border-info/30 bg-info-soft px-4 py-3 text-[13.5px] text-info">
        <Loader2 className="size-4 animate-spin" />
        <span className="font-semibold">Claude 검토 중</span>
        <span className="tabular">v{r.version}</span>
        <span className="text-muted">· {r.message}</span>
      </div>
    );
  }

  return (
    <section className="mt-6 overflow-hidden rounded-xl border border-warn/40 bg-surface">
      <div className="flex flex-wrap items-center gap-2 bg-warn-soft px-4 py-2.5 text-[13.5px]">
        <span className="font-semibold text-warn">모순 {r.conflicts.length}건 · 반영 보류</span>
        <span className="text-warn tabular">v{r.version}</span>
        <span className="text-muted">· {r.message}</span>
      </div>

      <ul className="divide-y divide-line">
        {r.conflicts.map((c, i) => (
          <li key={i} className="px-4 py-3 text-[13px]">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="rounded bg-sunken px-1.5 py-0.5 text-[11.5px] text-muted">
                {c.ref.kind === "source" ? "원본" : c.ref.kind === "self" ? "이 페이지" : "위키"}
              </span>
              {c.ref.kind === "page" && c.ref.slug ? (
                <Link href={`/wiki/${c.ref.slug}`} className="font-medium hover:text-accent-ink hover:underline">
                  {c.ref.title}
                </Link>
              ) : (
                <span className="font-medium">{c.ref.title}</span>
              )}
              <span className="font-semibold text-warn">{c.reason}</span>
            </div>
            <div className="mt-2 grid gap-1">
              <div className="rounded bg-sunken px-2.5 py-1.5 text-muted">{c.excerpt}</div>
              <div className="rounded bg-warn-soft px-2.5 py-1.5">{c.changed}</div>
            </div>
          </li>
        ))}
      </ul>

      <div className="space-y-2 border-t border-line px-4 py-3">
        <EditNotes r={r} comments={comments} />
        <button
          type="button"
          onClick={() => setShowDiff((v) => !v)}
          className="inline-flex items-center gap-1 text-[12.5px] font-medium text-muted hover:text-ink"
        >
          {showDiff ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          변경 내용
        </button>
        {showDiff && <DiffView before={r.before} after={r.after} />}
      </div>

      <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-sunken/40 px-4 py-3">
        <Button variant="ghost" onClick={onCancel}>
          취소
        </Button>
        <Button variant="primary" onClick={onApply}>
          <Check className="size-4" /> 그래도 반영
        </Button>
      </div>
    </section>
  );
}

function History({ revs, comments }: { revs: Revision[]; comments: WikiComment[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <section className="mt-12">
      <h2 className="flex items-center gap-2 text-[15px] font-semibold">
        변경 이력 <span className="text-[13px] font-normal text-faint tabular">{revs.length}</span>
      </h2>
      <ol className="mt-3 overflow-hidden rounded-xl border border-line bg-surface">
        {revs.map((r) => {
          const isOpen = open === r.id;
          const st = diffStats(diffLines(r.before.body, r.after.body));
          return (
            <li key={r.id} className="border-b border-line last:border-b-0">
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : r.id)}
                aria-expanded={isOpen}
                className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] hover:bg-sunken/60"
              >
                {isOpen ? (
                  <ChevronDown className="size-3.5 shrink-0 text-faint" />
                ) : (
                  <ChevronRight className="size-3.5 shrink-0 text-faint" />
                )}
                <span className="w-7 shrink-0 font-mono text-[12px] text-muted">v{r.version}</span>
                <StatusPill status={r.status} />
                <span
                  className={clsx("min-w-0 flex-1 truncate", r.status === "cancelled" && "text-faint line-through")}
                >
                  {r.message}
                </span>
                {!!r.commentIds?.length && (
                  <span className="hidden shrink-0 rounded bg-sunken px-1.5 text-[11.5px] text-muted sm:inline">
                    주석 {r.commentIds.length}
                  </span>
                )}
                <span className="shrink-0 text-[12px] tabular">
                  <span className="text-ok">+{st.add}</span> <span className="text-danger">−{st.del}</span>
                </span>
                <span className="w-12 shrink-0 text-right text-[12px] text-muted">{author(r)}</span>
                <span className="hidden w-[76px] shrink-0 text-right text-[12px] text-faint tabular sm:inline">
                  {fmt(r.at, "M/d HH:mm")}
                </span>
              </button>
              {isOpen && (
                <div className="space-y-3 px-4 pb-4">
                  <EditNotes r={r} comments={comments} />
                  <DiffView before={r.before} after={r.after} />
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
