"use client";

import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Plus, Trash2, X } from "lucide-react";
import type { Item, Priority, SubItem } from "@/lib/types";
import { PRIORITY_ORDER, STATUSES, statusColor, statusLabel, type Tag } from "@/lib/items";
import { convertKind, withSubItems } from "@/lib/itemStore";
import { dueLabel, dueTone } from "@/lib/date";
import { TODAY } from "@/mocks/today";
import { wikiPages, getWikiPage } from "@/mocks/wiki";

const tone = (color: string) => ({ "--tone": color }) as React.CSSProperties;

/* ───────────── 인라인 텍스트 ───────────── */

/** 평소엔 글자, 누르면 입력칸. Enter(여러 줄은 ⌘/Ctrl+Enter)·바깥 클릭 저장, Esc 취소 */
export function EditableText({
  value,
  onSave,
  placeholder,
  multiline = false,
  className,
  label,
}: {
  value: string | undefined;
  onSave: (v: string) => void;
  placeholder: string;
  multiline?: boolean;
  className?: string;
  label: string;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement>(null);

  useEffect(() => {
    if (editing) {
      ref.current?.focus();
      if (ref.current instanceof HTMLTextAreaElement) {
        ref.current.style.height = "auto";
        ref.current.style.height = `${ref.current.scrollHeight}px`;
      }
    }
  }, [editing]);

  const start = () => {
    setDraft(value ?? "");
    setEditing(true);
  };
  const commit = () => {
    setEditing(false);
    if (draft.trim() !== (value ?? "").trim()) onSave(draft.trim());
  };

  if (editing) {
    const common = {
      "aria-label": label,
      value: draft,
      placeholder,
      onBlur: commit,
      className: clsx(
        "w-full rounded-md bg-surface px-1.5 py-0.5 outline-none ring-2 ring-accent/50 placeholder:text-faint max-lg:py-1.5 max-lg:[font-size:max(16px,1em)]",
        className,
      ),
    };
    return multiline ? (
      <textarea
        {...common}
        ref={ref as React.RefObject<HTMLTextAreaElement>}
        rows={3}
        onChange={(e) => {
          setDraft(e.target.value);
          e.target.style.height = "auto";
          e.target.style.height = `${e.target.scrollHeight}px`;
        }}
        onKeyDown={(e) => {
          if (e.key === "Escape") setEditing(false);
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) commit();
        }}
        className={clsx(common.className, "resize-none leading-relaxed")}
      />
    ) : (
      <input
        {...common}
        ref={ref as React.RefObject<HTMLInputElement>}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.nativeEvent.isComposing) commit();
          if (e.key === "Escape") setEditing(false);
        }}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={start}
      aria-label={`${label} 편집`}
      className={clsx(
        "-mx-1.5 block w-[calc(100%+0.75rem)] cursor-text rounded-md px-1.5 py-0.5 text-left hover:bg-sunken max-lg:py-1.5",
        multiline && "whitespace-pre-line",
        !value && "text-faint",
        className,
      )}
    >
      {value || placeholder}
    </button>
  );
}

/* ───────────── 날짜·시간 ───────────── */

const inputCls =
  "h-10 min-w-0 rounded-md border border-line bg-surface px-2 text-base text-ink outline-none focus:border-accent tabular [color-scheme:light] dark:[color-scheme:dark] lg:h-8 lg:px-1.5 lg:text-[13.5px]";

/** 켜고 끄는 스위치 (기본 체크박스 대신) */
export function Switch({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="group inline-flex min-h-9 items-center gap-2 text-[13px] text-muted hover:text-ink lg:min-h-0"
    >
      <span
        className={clsx(
          "relative inline-flex h-[18px] w-8 shrink-0 items-center rounded-full transition-colors",
          checked ? "bg-accent" : "bg-line-strong",
        )}
      >
        <span
          className={clsx(
            "absolute size-[14px] rounded-full bg-white shadow-card transition-transform",
            checked ? "translate-x-[16px]" : "translate-x-[2px]",
          )}
        />
      </span>
      <span className={clsx(checked && "font-medium text-ink")}>{label}</span>
    </button>
  );
}

/** 시작/끝·종일. 할 일은 날짜를 지워 미배치로 돌릴 수 있다 */
export function WhenEditor({ item, onUpdate }: { item: Item; onUpdate: (fn: (i: Item) => Item) => void }) {
  if (!item.start) {
    return (
      <button
        type="button"
        onClick={() => onUpdate((i) => ({ ...i, start: `${TODAY}T00:00`, end: `${TODAY}T23:59`, allDay: true }))}
        className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-[14px] text-faint hover:bg-sunken hover:text-ink lg:h-7 lg:px-1.5 lg:text-[13.5px]"
      >
        <Plus className="size-3.5" /> 날짜
      </button>
    );
  }
  const s = item.start;
  const e = item.end ?? item.start;
  const set = (start: string, end: string, allDay = item.allDay) => {
    const fixedEnd = end < start ? start : end;
    onUpdate((i) => ({ ...i, start, end: fixedEnd, allDay }));
  };
  return (
    <div className="flex flex-col gap-1.5">
      <div className="grid grid-cols-[2rem_minmax(0,1fr)] items-center gap-x-1.5 gap-y-1.5">
        <span className="text-[12.5px] text-faint">시작</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <input
            type="date"
            aria-label="시작 날짜"
            value={s.slice(0, 10)}
            onChange={(ev) => ev.target.value && set(`${ev.target.value}${s.slice(10)}`, e)}
            className={inputCls}
          />
          {!item.allDay && (
            <input
              type="time"
              aria-label="시작 시간"
              value={s.slice(11, 16)}
              onChange={(ev) => ev.target.value && set(`${s.slice(0, 10)}T${ev.target.value}`, e)}
              className={inputCls}
            />
          )}
        </span>
        <span className="text-[12.5px] text-faint">끝</span>
        <span className="flex min-w-0 items-center gap-1.5">
          <input
            type="date"
            aria-label="끝 날짜"
            value={e.slice(0, 10)}
            onChange={(ev) => ev.target.value && set(s, `${ev.target.value}${e.slice(10)}`)}
            className={inputCls}
          />
          {!item.allDay && (
            <input
              type="time"
              aria-label="끝 시간"
              value={e.slice(11, 16)}
              onChange={(ev) => ev.target.value && set(s, `${e.slice(0, 10)}T${ev.target.value}`)}
              className={inputCls}
            />
          )}
        </span>
      </div>
      <div className="flex items-center gap-4 text-[13px] text-muted">
        <Switch
          label="종일"
          checked={!!item.allDay}
          onChange={(on) =>
            on
              ? set(`${s.slice(0, 10)}T00:00`, `${e.slice(0, 10)}T23:59`, true)
              : set(`${s.slice(0, 10)}T09:00`, `${e.slice(0, 10)}T10:00`, false)
          }
        />
        {item.kind === "task" && (
          <button
            type="button"
            onClick={() => onUpdate((i) => ({ ...i, start: undefined, end: undefined, allDay: undefined }))}
            className="min-h-9 hover:text-ink lg:min-h-0"
          >
            미배치로
          </button>
        )}
      </div>
    </div>
  );
}

/* ───────────── 속성 묶음 ───────────── */

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-[13px] text-muted max-sm:mt-2 sm:pt-1.5">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </>
  );
}

/** 항목 속성 편집: 유형·진행·우선순위·날짜·마감·장소·받은 곳·알아오는 중·태그·관련 위키 */
export function ItemProperties({
  item,
  tags,
  onUpdate,
}: {
  item: Item;
  tags: Tag[];
  onUpdate: (fn: (i: Item) => Item) => void;
}) {
  const isTask = item.kind === "task";
  const linkable = wikiPages.filter((p) => !item.wikiRefs.includes(p.slug));

  return (
    <dl className="grid grid-cols-1 items-start gap-y-1 text-[14.5px] sm:grid-cols-[96px_1fr] sm:gap-x-3 sm:gap-y-3">
      <Row label="유형">
        <div className="inline-flex rounded-md bg-sunken p-0.5">
          {(
            [
              { k: "event", label: "일정" },
              { k: "task", label: "할 일" },
            ] as const
          ).map(({ k, label }) => (
            <button
              key={k}
              type="button"
              aria-pressed={item.kind === k}
              onClick={() => onUpdate((i) => convertKind(i, k, TODAY))}
              className={clsx(
                "h-9 rounded px-3.5 text-[14px] font-medium lg:h-7 lg:px-3 lg:text-[13px]",
                item.kind === k ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </Row>

      {isTask && (
        <Row label="진행">
          <div className="flex flex-wrap gap-1">
            {STATUSES.map((s) => (
              <button
                key={s}
                type="button"
                aria-pressed={item.status === s}
                onClick={() => onUpdate((i) => ({ ...i, status: s }))}
                style={tone(statusColor[s])}
                className={clsx(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13.5px] lg:h-7 lg:px-2.5 lg:text-[12.5px]",
                  item.status === s
                    ? "tone-chip border-transparent font-semibold"
                    : "border-line text-muted hover:text-ink",
                )}
              >
                <span className="tone-dot size-1.5 rounded-full" />
                {statusLabel[s]}
              </button>
            ))}
          </div>
        </Row>
      )}

      {isTask && item.status === "waiting" && (
        <Row label="기다리는 것">
          <EditableText
            label="기다리는 것"
            value={item.waitingFor}
            placeholder="비어 있음"
            onSave={(v) => onUpdate((i) => ({ ...i, waitingFor: v || undefined }))}
          />
        </Row>
      )}

      {isTask && (
        <Row label="우선순위">
          <div className="flex flex-wrap gap-1">
            {PRIORITY_ORDER.map((p: Priority) => (
              <button
                key={p}
                type="button"
                aria-pressed={item.priority === p}
                onClick={() => onUpdate((i) => ({ ...i, priority: p }))}
                className={clsx(
                  `tone-${p}`,
                  "h-9 min-w-9 rounded-[6px] px-2 text-[13px] font-semibold tabular lg:h-7 lg:min-w-0 lg:text-[12px]",
                  item.priority === p ? "tone-chip" : "text-faint hover:text-muted",
                )}
              >
                {p}
              </button>
            ))}
          </div>
        </Row>
      )}

      <Row label={isTask ? "작업할 날" : "시간"}>
        <WhenEditor item={item} onUpdate={onUpdate} />
      </Row>

      {isTask && (
        <Row label="마감">
          <div className="flex items-center gap-2">
            <input
              type="date"
              aria-label="마감일"
              value={item.due ?? ""}
              onChange={(e) => onUpdate((i) => ({ ...i, due: e.target.value || undefined }))}
              className={inputCls}
            />
            {item.due && item.status !== "done" && (
              <span
                className={clsx(
                  "text-[12px] font-medium",
                  dueTone(item.due) === "danger"
                    ? "text-danger"
                    : dueTone(item.due) === "warn"
                      ? "text-warn"
                      : "text-muted",
                )}
              >
                {dueLabel(item.due)}
              </span>
            )}
          </div>
        </Row>
      )}

      <Row label="장소">
        <EditableText
          label="장소"
          value={item.location}
          placeholder="비어 있음"
          onSave={(v) => onUpdate((i) => ({ ...i, location: v || undefined }))}
        />
      </Row>

      {isTask && (
        <Row label="받은 곳">
          <EditableText
            label="받은 곳"
            value={item.from}
            placeholder="비어 있음"
            onSave={(v) => onUpdate((i) => ({ ...i, from: v || undefined }))}
          />
        </Row>
      )}

      <Row label="태그">
        <div className="flex flex-wrap gap-1.5">
          {tags.map((t) => {
            const on = item.tags.includes(t.id);
            return (
              <button
                key={t.id}
                type="button"
                aria-pressed={on}
                onClick={() =>
                  onUpdate((i) => ({
                    ...i,
                    tags: i.tags.includes(t.id) ? i.tags.filter((x) => x !== t.id) : [...i.tags, t.id],
                  }))
                }
                style={tone(t.color)}
                className={clsx(
                  "inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13.5px] lg:h-7 lg:px-2.5 lg:text-[12.5px]",
                  on ? "tone-chip border-transparent font-semibold" : "border-line text-muted hover:text-ink",
                )}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </Row>

      <Row label="관련 위키">
        <div className="flex flex-wrap items-center gap-1">
          {item.wikiRefs.map((slug) => {
            const p = getWikiPage(slug);
            if (!p) return null;
            return (
              <span
                key={slug}
                className="inline-flex h-9 items-center gap-1 rounded-md border border-line pr-0.5 pl-2.5 text-[13.5px] lg:h-7 lg:text-[12.5px]"
              >
                {p.title}
                <button
                  type="button"
                  aria-label={`${p.title} 연결 해제`}
                  onClick={() => onUpdate((i) => ({ ...i, wikiRefs: i.wikiRefs.filter((x) => x !== slug) }))}
                  className="grid size-8 place-items-center rounded text-faint hover:text-ink lg:size-6"
                >
                  <X className="size-3" />
                </button>
              </span>
            );
          })}
          {linkable.length > 0 && (
            <span className="relative inline-flex">
              <span className="inline-flex h-9 items-center gap-1 rounded-md px-2 text-[13.5px] text-faint hover:bg-sunken hover:text-ink lg:h-7 lg:text-[12.5px]">
                <Plus className="size-3.5" /> 연결
              </span>
              <select
                aria-label="위키 연결"
                value=""
                onChange={(e) => {
                  const slug = e.target.value;
                  if (slug) onUpdate((i) => ({ ...i, wikiRefs: [...i.wikiRefs, slug] }));
                }}
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
      </Row>
    </dl>
  );
}

/* ───────────── 하위 항목 ───────────── */

/** 하위 항목: 체크·이름 수정·삭제·추가 (추가하면 단순 작업 → 작업, 다 지우면 단순 작업) */
export function SubItemsEditor({
  item,
  onUpdate,
  large = false,
}: {
  item: Item;
  onUpdate: (fn: (i: Item) => Item) => void;
  large?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const setSubs = (fn: (s: SubItem[]) => SubItem[]) => onUpdate((i) => withSubItems(i, fn(i.subItems)));
  const next = item.subItems.find((s) => !s.done);
  const add = () => {
    const title = draft.trim();
    if (!title) return;
    setSubs((s) => [...s, { id: `${item.id}-s${Date.now().toString(36)}`, title, done: false }]);
    setDraft("");
  };

  return (
    <div>
      {item.subItems.length > 0 && (
        <ul className="space-y-0.5">
          {item.subItems.map((s, idx) => (
            <li
              key={s.id}
              className={clsx(
                "group flex items-center gap-2 rounded-md hover:bg-sunken",
                large ? "px-2 py-1.5" : "px-1 py-0.5",
                large && next?.id === s.id && "bg-accent-soft/50",
              )}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={s.done}
                aria-label={s.title}
                onClick={() => setSubs((l) => l.map((x) => (x.id === s.id ? { ...x, done: !x.done } : x)))}
                className={clsx(
                  "grid shrink-0 place-items-center rounded-[5px] border transition-colors",
                  large ? "size-5.5 lg:size-5" : "size-4.5",
                  s.done ? "border-ok bg-ok text-white" : "border-line-strong bg-surface",
                )}
              >
                {s.done && <Check className="size-3" strokeWidth={3} />}
              </button>
              {large && <span className="w-4 shrink-0 text-[12px] text-faint tabular">{idx + 1}</span>}
              <div
                className={clsx(
                  "min-w-0 flex-1",
                  large ? "text-[14.5px]" : "text-[13px]",
                  s.done && "text-muted line-through",
                )}
              >
                <EditableText
                  label="하위 항목 이름"
                  value={s.title}
                  placeholder="이름 없음"
                  onSave={(v) => v && setSubs((l) => l.map((x) => (x.id === s.id ? { ...x, title: v } : x)))}
                />
              </div>
              <button
                type="button"
                aria-label={`${s.title} 삭제`}
                onClick={() => setSubs((l) => l.filter((x) => x.id !== s.id))}
                className="grid size-9 shrink-0 place-items-center rounded text-faint hover:text-ink lg:size-6 lg:opacity-0 lg:group-hover:opacity-100 lg:focus:opacity-100"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      <div
        className={clsx(
          "mt-1.5 flex items-center gap-1.5 rounded-md border border-dashed border-line-strong focus-within:border-accent",
          large ? "px-2.5 py-2 lg:py-1.5" : "px-2 py-1",
        )}
      >
        <Plus className="size-3.5 shrink-0 text-faint" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.nativeEvent.isComposing) add();
          }}
          placeholder="하위 항목 추가"
          aria-label="하위 항목 추가"
          className={clsx(
            "min-w-0 flex-1 bg-transparent outline-none placeholder:text-faint max-lg:text-base",
            large ? "text-[14.5px]" : "text-[13px]",
          )}
        />
      </div>
    </div>
  );
}

/* ───────────── 삭제 ───────────── */

/** 한 번 누르면 "정말 삭제"로 바뀌고, 다시 누르면 삭제 */
export function DeleteButton({ onDelete, className }: { onDelete: () => void; className?: string }) {
  const [armed, setArmed] = useState(false);
  useEffect(() => {
    if (!armed) return;
    const t = window.setTimeout(() => setArmed(false), 3000);
    return () => window.clearTimeout(t);
  }, [armed]);
  return (
    <button
      type="button"
      onClick={() => (armed ? onDelete() : setArmed(true))}
      className={clsx(
        "inline-flex h-10 items-center gap-1.5 rounded-lg px-3 text-[14px] font-medium transition-colors lg:h-9 lg:text-[13.5px]",
        armed ? "bg-danger text-white" : "text-muted hover:bg-danger-soft hover:text-danger",
        className,
      )}
    >
      <Trash2 className="size-4" />
      {armed ? "정말 삭제" : "삭제"}
    </button>
  );
}
