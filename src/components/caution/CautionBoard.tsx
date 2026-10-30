"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { Check, ChevronDown, ChevronRight, Plus, RotateCcw, ShieldAlert, Trash2, X } from "lucide-react";
import type { Caution } from "@/lib/types";
import { fmt } from "@/lib/date";
import { DEFAULT_TAGS } from "@/lib/items";
import { useTags } from "@/lib/itemStore";
import { getWikiPage, wikiPages } from "@/mocks/wiki";
import { Button, ItemTagChip } from "@/components/ui";
import { IntervalPill } from "@/components/wiki/badges";
import { addCaution, deleteCaution, isDue, reviewCaution, updateCaution, useCautions } from "@/lib/cautionStore";

const SOURCE_LABEL: Record<Caution["source"]["kind"], string> = {
  memo: "메모",
  question: "질문 기록",
  wiki: "위키",
  manual: "직접 추가",
};

function sourceHref(s: Caution["source"]) {
  if (s.kind === "memo") return "/memos";
  if (s.kind === "question" && s.id) return `/questions/${s.id}`;
  if (s.kind === "wiki" && s.id) return `/wiki/${s.id}`;
  return undefined;
}

/** 주의할 점 전체 화면 (위키 > 주의할 점) */
export function CautionBoard() {
  const list = useCautions();
  const [adding, setAdding] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [hash, setHash] = useState<string | null>(null);

  // 다른 화면에서 #c1 처럼 들어오면 그 카드로 이동·강조
  useEffect(() => {
    const read = () => setHash(window.location.hash.slice(1) || null);
    read();
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);
  useEffect(() => {
    if (!hash) return;
    const t = window.setTimeout(
      () => document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "center" }),
      50,
    );
    return () => window.clearTimeout(t);
  }, [hash]);

  const active = list.filter((c) => !c.archived);
  const due = active.filter(isDue).sort((a, b) => a.review.nextReview.localeCompare(b.review.nextReview));
  const rest = active.filter((c) => !isDue(c)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const archived = list.filter((c) => c.archived);
  // 익힌 것으로 바로 들어오면 펼쳐서 보여준다
  const archivedOpen = showArchived || archived.some((c) => c.id === hash);

  return (
    <div className="max-w-[860px] px-6 pt-8 pb-20 lg:px-12 lg:pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-6">
        <div>
          <h1 className="flex items-center gap-2.5 text-[32px] leading-tight font-bold tracking-[-0.025em]">
            <ShieldAlert className="size-7 text-warn" />
            주의할 점
          </h1>
          <div className="mt-2 flex gap-3 text-[13px] text-faint tabular">
            <span>{active.length}개</span>
            {archived.length > 0 && (
              <>
                <span>·</span>
                <span>익힌 것 {archived.length}</span>
              </>
            )}
          </div>
        </div>
        {!adding && (
          <Button variant="primary" onClick={() => setAdding(true)}>
            <Plus className="size-4" /> 추가
          </Button>
        )}
      </div>

      {adding && <AddForm onDone={() => setAdding(false)} />}

      {due.length > 0 && (
        <section className="mt-8">
          <h2 className="text-[15px] font-semibold">
            오늘 다시 볼 것 <span className="text-[13px] font-normal text-faint tabular">{due.length}</span>
          </h2>
          <ul className="mt-3 space-y-3">
            {due.map((c) => (
              <CautionCard key={c.id} c={c} due highlight={hash === c.id} />
            ))}
          </ul>
        </section>
      )}

      {rest.length > 0 && (
        <section className="mt-10">
          <h2 className="text-[15px] font-semibold">
            모두 <span className="text-[13px] font-normal text-faint tabular">{rest.length}</span>
          </h2>
          <ul className="mt-3 space-y-3">
            {rest.map((c) => (
              <CautionCard key={c.id} c={c} highlight={hash === c.id} />
            ))}
          </ul>
        </section>
      )}

      {active.length === 0 && !adding && <p className="mt-10 text-[14px] text-muted">아직 없어요.</p>}

      {archived.length > 0 && (
        <section className="mt-10">
          <button
            type="button"
            onClick={() => setShowArchived(!archivedOpen)}
            aria-expanded={archivedOpen}
            className="flex items-center gap-1.5 text-[15px] font-semibold"
          >
            {archivedOpen ? <ChevronDown className="size-4 text-faint" /> : <ChevronRight className="size-4 text-faint" />}
            익힌 것 <span className="text-[13px] font-normal text-faint tabular">{archived.length}</span>
          </button>
          {archivedOpen && (
            <ul className="mt-3 space-y-3">
              {archived.map((c) => (
                <CautionCard key={c.id} c={c} highlight={hash === c.id} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function CautionCard({ c, due, highlight }: { c: Caution; due?: boolean; highlight?: boolean }) {
  const tags = useTags();
  const href = sourceHref(c.source);
  const wikis = c.wikiRefs.map(getWikiPage).filter((p) => p !== undefined);
  const chips = c.tags.map((t) => tags.find((x) => x.id === t)).filter((t) => t !== undefined);

  return (
    <li
      id={c.id}
      className={clsx(
        "scroll-mt-24 rounded-xl border bg-surface px-5 py-4 transition-shadow",
        highlight ? "border-warn ring-3 ring-warn/20" : "border-line",
        c.archived && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-[15.5px] leading-snug font-semibold">{c.point}</div>
          {c.wrong && <p className="mt-1.5 text-[13.5px] leading-relaxed text-muted">{c.wrong}</p>}
        </div>
        {!c.archived && <IntervalPill days={c.review.intervalDays} />}
      </div>

      {(wikis.length > 0 || chips.length > 0) && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          {wikis.map((w) => (
            <Link
              key={w.slug}
              href={`/wiki/${w.slug}`}
              className="inline-flex h-[22px] items-center rounded-md border border-line px-2 text-[12px] hover:bg-sunken"
            >
              {w.title}
            </Link>
          ))}
          {chips.map((t) => (
            <ItemTagChip key={t.id} label={t.label} color={t.color} />
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[12.5px] text-faint">
          {c.by && <span>{c.by}</span>}
          {c.by && <span>·</span>}
          {href ? (
            <Link href={href} className="hover:text-ink hover:underline">
              {SOURCE_LABEL[c.source.kind]}
            </Link>
          ) : (
            <span>{SOURCE_LABEL[c.source.kind]}</span>
          )}
          <span>·</span>
          <span className="tabular">{fmt(c.createdAt, "M월 d일")}</span>
        </div>
        <div className="flex items-center gap-1.5">
          {c.archived ? (
            <Button size="sm" variant="ghost" onClick={() => updateCaution(c.id, (x) => ({ ...x, archived: false }))}>
              <RotateCcw className="size-3.5" /> 다시 알리기
            </Button>
          ) : (
            <>
              {due && (
                <Button size="sm" onClick={() => reviewCaution(c.id)}>
                  <Check className="size-3.5" /> 다시 봤어요
                </Button>
              )}
              <Button size="sm" variant="ghost" onClick={() => updateCaution(c.id, (x) => ({ ...x, archived: true }))}>
                익혔어요
              </Button>
            </>
          )}
          <button
            type="button"
            aria-label="삭제"
            title="삭제"
            onClick={() => deleteCaution(c.id)}
            className="grid size-8 place-items-center rounded-md text-faint hover:bg-sunken hover:text-danger"
          >
            <Trash2 className="size-3.5" />
          </button>
        </div>
      </div>
    </li>
  );
}

const input =
  "w-full rounded-lg border border-line bg-surface px-3 py-2 text-[16px] outline-none placeholder:text-faint focus:border-accent focus:ring-3 focus:ring-accent/15 lg:text-[14px]";

function AddForm({ onDone }: { onDone: () => void }) {
  const tags = useTags();
  const [point, setPoint] = useState("");
  const [wrong, setWrong] = useState("");
  const [by, setBy] = useState("");
  const [wikiRefs, setWikiRefs] = useState<string[]>([]);
  const [tagIds, setTagIds] = useState<string[]>([]);
  const allTags = tags.length ? tags : DEFAULT_TAGS;
  const linkable = wikiPages.filter((p) => !wikiRefs.includes(p.slug));

  const save = () => {
    if (!point.trim()) return;
    addCaution({
      point: point.trim(),
      wrong: wrong.trim() || undefined,
      by: by.trim() || undefined,
      source: { kind: "manual" },
      wikiRefs,
      tags: tagIds,
    });
    onDone();
  };

  return (
    <div className="mt-6 space-y-3 rounded-xl border border-line bg-surface p-5 shadow-card">
      <input
        autoFocus
        aria-label="주의할 점"
        value={point}
        onChange={(e) => setPoint(e.target.value)}
        placeholder="주의할 점"
        className={clsx(input, "font-medium")}
      />
      <textarea
        aria-label="무엇이 문제였는지"
        value={wrong}
        onChange={(e) => setWrong(e.target.value)}
        placeholder="무엇이 문제였는지"
        rows={2}
        className={clsx(input, "resize-y leading-relaxed")}
      />
      <input
        aria-label="누가 알려줬는지 (직책)"
        value={by}
        onChange={(e) => setBy(e.target.value)}
        placeholder="직책 (팀장님·선임님)"
        className={clsx(input, "max-w-[240px]")}
      />

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[13px] text-faint">관련 위키</span>
        {wikiRefs.map((slug) => (
          <span
            key={slug}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-line pr-0.5 pl-2.5 text-[12.5px]"
          >
            {getWikiPage(slug)?.title ?? slug}
            <button
              type="button"
              aria-label="연결 해제"
              onClick={() => setWikiRefs((w) => w.filter((x) => x !== slug))}
              className="grid size-6 place-items-center rounded text-faint hover:text-ink"
            >
              <X className="size-3" />
            </button>
          </span>
        ))}
        {linkable.length > 0 && (
          <span className="relative inline-flex">
            <span className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12.5px] text-faint hover:bg-sunken hover:text-ink">
              <Plus className="size-3.5" /> 연결
            </span>
            <select
              aria-label="위키 연결"
              value=""
              onChange={(e) => e.target.value && setWikiRefs((w) => [...w, e.target.value])}
              className="absolute inset-0 cursor-pointer text-base opacity-0"
            >
              <option value="">위키 선택</option>
              {linkable.map((p) => (
                <option key={p.slug} value={p.slug}>
                  {p.category} · {p.title}
                </option>
              ))}
            </select>
          </span>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[13px] text-faint">태그</span>
        {allTags.map((t) => {
          const on = tagIds.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              aria-pressed={on}
              onClick={() => setTagIds((s) => (on ? s.filter((x) => x !== t.id) : [...s, t.id]))}
              style={{ "--tone": t.color } as React.CSSProperties}
              className={clsx(
                "inline-flex h-7 items-center rounded-full border px-2.5 text-[12.5px]",
                on ? "tone-chip border-transparent font-semibold" : "border-line text-muted hover:text-ink",
              )}
            >
              {t.label}
            </button>
          );
        })}
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <Button variant="ghost" onClick={onDone}>
          취소
        </Button>
        <Button variant="primary" onClick={save} disabled={!point.trim()}>
          저장
        </Button>
      </div>
    </div>
  );
}
