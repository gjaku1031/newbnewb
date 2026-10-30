"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Check, Clock, Hourglass, MapPin, Plus, RotateCcw, X } from "lucide-react";
import type { Item, SubItem } from "@/lib/types";
import { PRIORITY_ORDER, STATUSES, displayKind, progress, statusColor, statusLabel, type Tag } from "@/lib/items";
import { KindTag, PriorityBadge, ProgressRing } from "@/components/ui";
import { dueLabel, dueTone, fmt } from "@/lib/date";
import { toneStyle } from "./model";

/** 항목 상세 패널 — 일정이면 시간·장소·태그, 할 일이면 마감·상태·하위 항목까지 */
export function DetailPanel({
  item,
  tags,
  onUpdate,
  onClose,
}: {
  item: Item;
  tags: Tag[];
  onUpdate: (fn: (i: Item) => Item) => void;
  onClose: () => void;
}) {
  const kind = displayKind(item);
  const isTask = item.kind === "task";
  const pct = progress(item);

  const toggleTag = (id: string) =>
    onUpdate((i) => ({ ...i, tags: i.tags.includes(id) ? i.tags.filter((t) => t !== id) : [...i.tags, id] }));

  /** 하위 항목이 바뀌면 상태도 맞춘다: 전부 끝나면 완료, 아니면 진행 중 */
  const setSubItems = (fn: (s: SubItem[]) => SubItem[]) =>
    onUpdate((i) => {
      const subItems = fn(i.subItems);
      let status = i.status;
      if (subItems.length > 0) {
        const all = subItems.every((s) => s.done);
        const any = subItems.some((s) => s.done);
        if (all) status = "done";
        else if (status === "done" || (any && status === "todo")) status = "doing";
      }
      return { ...i, subItems, status };
    });

  return (
    <aside className="fixed inset-y-0 right-0 z-40 flex w-full max-w-[380px] flex-col border-l border-line bg-surface shadow-pop">
      <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3">
        <div className="flex flex-wrap items-center gap-1.5">
          <KindTag kind={kind} />
          {isTask && item.priority && <PriorityBadge p={item.priority} />}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="grid size-8 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto px-5 py-5">
        <section>
          <div className="flex items-start gap-3">
            <h2
              className={clsx(
                "min-w-0 flex-1 text-[18px] leading-snug font-semibold",
                isTask && item.status === "done" && "text-muted line-through",
              )}
            >
              {item.title}
            </h2>
            {kind === "task" && pct !== null && <ProgressRing value={pct} size={48} />}
          </div>

          <dl className="mt-3 space-y-1.5 text-[13.5px]">
            {item.start && (
              <div className="flex items-center gap-2 text-muted">
                <Clock className="size-4 shrink-0" />
                <span className="tabular">{when(item)}</span>
              </div>
            )}
            {item.location && (
              <div className="flex items-center gap-2 text-muted">
                <MapPin className="size-4 shrink-0" />
                {item.location}
              </div>
            )}
          </dl>

          {isTask && (
            <dl className="mt-3 grid grid-cols-[56px_1fr] items-center gap-y-2 text-[13px]">
              <dt className="text-muted">진행</dt>
              <dd className="flex flex-wrap gap-1">
                {STATUSES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => onUpdate((i) => ({ ...i, status: s }))}
                    style={toneStyle(statusColor[s])}
                    className={clsx(
                      "inline-flex h-6 items-center gap-1 rounded-full border px-2 text-[12px]",
                      item.status === s ? "tone-chip border-transparent font-semibold" : "border-line text-muted hover:text-ink",
                    )}
                  >
                    <span className="tone-dot size-1.5 rounded-full" />
                    {statusLabel[s]}
                  </button>
                ))}
              </dd>
              <dt className="text-muted">우선순위</dt>
              <dd className="flex flex-wrap gap-1">
                {PRIORITY_ORDER.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => onUpdate((i) => ({ ...i, priority: p }))}
                    className={clsx(
                      `tone-${p}`,
                      "h-6 rounded-[5px] px-1.5 text-[11.5px] font-semibold tabular",
                      item.priority === p ? "tone-chip" : "text-faint hover:text-muted",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </dd>
              {item.due && (
                <>
                  <dt className="text-muted">마감</dt>
                  <dd className="tabular">
                    {fmt(item.due, "M월 d일 (EEE)")}
                    {item.status !== "done" && (
                      <span
                        className={clsx(
                          "ml-1.5 text-[12px] font-medium",
                          dueTone(item.due) === "danger" ? "text-danger" : dueTone(item.due) === "warn" ? "text-warn" : "text-muted",
                        )}
                      >
                        {dueLabel(item.due)}
                      </span>
                    )}
                  </dd>
                </>
              )}
              {item.from && (
                <>
                  <dt className="text-muted">받은 곳</dt>
                  <dd>{item.from}</dd>
                </>
              )}
            </dl>
          )}

          {isTask && item.waitingFor && item.status === "waiting" && (
            <div className="mt-3 flex gap-2 rounded-lg bg-info-soft px-3 py-2 text-[12.5px] text-info">
              <Hourglass className="mt-0.5 size-3.5 shrink-0" />
              <span>{item.waitingFor}</span>
            </div>
          )}
        </section>

        <section>
          <div className="mb-1.5 text-[12px] font-medium text-faint">태그</div>
          <div className="flex flex-wrap gap-1.5">
            {tags.map((t) => {
              const on = item.tags.includes(t.id);
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => toggleTag(t.id)}
                  aria-pressed={on}
                  style={toneStyle(t.color)}
                  className={clsx(
                    "inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-[12.5px]",
                    on ? "tone-chip border-transparent font-semibold" : "border-line text-muted hover:text-ink",
                  )}
                >
                  <span className="tone-dot size-2 rounded-full" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </section>

        {isTask && (
          <section>
            <div className="mb-1.5 text-[12px] font-medium text-faint">하위 항목</div>
            <SubItemList item={item} setSubItems={setSubItems} />
            {item.subItems.length === 0 && (
              <button
                type="button"
                onClick={() => onUpdate((i) => ({ ...i, status: i.status === "done" ? "todo" : "done" }))}
                className={clsx(
                  "mt-3 inline-flex h-9 items-center gap-1.5 rounded-lg px-3.5 text-[13.5px] font-medium",
                  item.status === "done"
                    ? "border border-line text-muted hover:text-ink"
                    : "bg-accent text-white hover:bg-accent-ink",
                )}
              >
                {item.status === "done" ? (
                  <>
                    <RotateCcw className="size-4" /> 되돌리기
                  </>
                ) : (
                  <>
                    <Check className="size-4" /> 완료
                  </>
                )}
              </button>
            )}
          </section>
        )}

        <Link
          href={`/items/${item.id}`}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3.5 text-[13.5px] font-medium hover:bg-sunken"
        >
          상세 보기 <ArrowRight className="size-4" />
        </Link>
      </div>
    </aside>
  );
}

function when(i: Item) {
  const s = i.start!;
  const e = i.end ?? s;
  if (s.slice(0, 10) !== e.slice(0, 10)) {
    return i.allDay
      ? `${fmt(s, "M월 d일 (EEE)")} – ${fmt(e, "M월 d일 (EEE)")}`
      : `${fmt(s, "M월 d일 (EEE) HH:mm")} – ${fmt(e, "M월 d일 (EEE) HH:mm")}`;
  }
  return i.allDay ? `${fmt(s, "M월 d일 (EEE)")} · 종일` : `${fmt(s, "M월 d일 (EEE)")} · ${s.slice(11, 16)} – ${e.slice(11, 16)}`;
}

/** 하위 항목 체크리스트 + 추가 (추가하면 단순 작업 → 작업, 다 지우면 다시 단순 작업) */
function SubItemList({ item, setSubItems }: { item: Item; setSubItems: (fn: (s: SubItem[]) => SubItem[]) => void }) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setSubItems((s) => [...s, { id: `${item.id}-n${Date.now()}`, title, done: false }]);
    setDraft("");
  };
  return (
    <div>
      {item.subItems.length > 0 && (
        <ul className="space-y-0.5">
          {item.subItems.map((s) => (
            <li key={s.id} className="group flex items-center gap-2 rounded-md px-1 py-1 hover:bg-sunken">
              <button
                type="button"
                role="checkbox"
                aria-checked={s.done}
                onClick={() => setSubItems((list) => list.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                className={clsx(
                  "grid size-4.5 shrink-0 place-items-center rounded-[5px] border",
                  s.done ? "border-ok bg-ok text-white" : "border-line-strong bg-surface",
                )}
              >
                {s.done && <Check className="size-3" strokeWidth={3} />}
              </button>
              <span className={clsx("min-w-0 flex-1 text-[13px]", s.done && "text-muted line-through")}>{s.title}</span>
              <button
                type="button"
                aria-label={`${s.title} 삭제`}
                onClick={() => setSubItems((list) => list.filter((x) => x.id !== s.id))}
                className="grid size-5 shrink-0 place-items-center rounded text-faint opacity-0 group-hover:opacity-100 hover:text-ink"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div className="mt-1.5 flex items-center gap-1.5 rounded-md border border-dashed border-line-strong px-2 py-1 focus-within:border-accent">
        <Plus className="size-3.5 shrink-0 text-faint" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") add();
          }}
          placeholder="하위 항목 추가"
          className="min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-faint"
        />
      </div>
    </div>
  );
}
