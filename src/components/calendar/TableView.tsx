"use client";

import { useState } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp } from "lucide-react";
import type { Item, ItemStatus, Priority } from "@/lib/types";
import {
  PRIORITY_ORDER,
  STATUSES,
  displayKind,
  progress,
  statusLabel,
  type Tag,
} from "@/lib/items";
import { ItemTagChip, KindTag, PriorityBadge, StatusBadge } from "@/components/ui";
import { dueLabel, dueTone, fmt } from "@/lib/date";

type SortKey = "title" | "kind" | "status" | "priority" | "date" | "due" | "progress";

const KIND_ORDER = { event: 0, simple: 1, task: 2 } as const;

const md = (iso: string) => `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}`;

function dateText(i: Item) {
  if (!i.start) return null;
  const s = i.start.slice(0, 10);
  const e = (i.end ?? i.start).slice(0, 10);
  if (e > s) return `${md(s)} – ${md(e)}`;
  if (i.allDay) return `${fmt(s, "M/d (EEE)")} 종일`;
  return `${fmt(s, "M/d (EEE)")} ${i.start.slice(11, 16)}–${(i.end ?? i.start).slice(11, 16)}`;
}

/** 보이는 배지 위에 투명한 기본 선택창을 겹쳐서, 어느 기기에서든 바로 바꿀 수 있게 */
function CellSelect<T extends string>({
  value,
  options,
  label,
  onChange,
  children,
}: {
  value: T | undefined;
  options: { value: T; label: string }[];
  label: string;
  onChange: (v: T) => void;
  children: React.ReactNode;
}) {
  return (
    <span className="relative inline-flex rounded-md hover:bg-sunken" onClick={(e) => e.stopPropagation()}>
      {children}
      <select
        aria-label={label}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value as T)}
        className="absolute inset-0 cursor-pointer opacity-0"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </span>
  );
}

/** 노션 데이터베이스(표) 보기 — 월별 */
export function TableView({
  items,
  tags,
  selection,
  onSelect,
  onUpdate,
}: {
  items: Item[];
  tags: Tag[];
  selection: string | null;
  onSelect: (id: string) => void;
  onUpdate: (id: string, fn: (i: Item) => Item) => void;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "date", dir: 1 });

  const val = (i: Item, key: SortKey): string | number => {
    switch (key) {
      case "title":
        return i.title;
      case "kind":
        return KIND_ORDER[displayKind(i)];
      case "status":
        return i.status ? STATUSES.indexOf(i.status) : 99;
      case "priority":
        return i.priority ? PRIORITY_ORDER.indexOf(i.priority) : 99;
      case "date":
        return i.start ?? `9${i.due ?? ""}`;
      case "due":
        return i.due ?? "9";
      case "progress":
        return progress(i) ?? -1;
    }
  };

  const rows = [...items].sort((a, b) => {
    const x = val(a, sort.key);
    const y = val(b, sort.key);
    const c = typeof x === "number" && typeof y === "number" ? x - y : String(x).localeCompare(String(y));
    return c * sort.dir || (a.start ?? "").localeCompare(b.start ?? "");
  });

  const head = (key: SortKey, label: string, className?: string) => (
    <th className={clsx("px-3 py-2 text-left font-medium", className)}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}
        className={clsx("inline-flex items-center gap-1 hover:text-ink", sort.key === key && "text-ink")}
      >
        {label}
        {sort.key === key && (sort.dir === 1 ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />)}
      </button>
    </th>
  );

  if (rows.length === 0) {
    return <div className="px-6 py-14 text-center text-[13.5px] text-muted">이번 달 항목이 없어요</div>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[980px] border-collapse text-[13.5px]">
        <thead>
          <tr className="border-b border-line text-[12.5px] text-muted">
            {head("title", "이름", "w-[34%] pl-4")}
            {head("kind", "유형")}
            {head("status", "진행")}
            {head("priority", "우선순위")}
            {head("date", "날짜")}
            {head("due", "마감")}
            <th className="px-3 py-2 text-left font-medium">태그</th>
            {head("progress", "달성률", "pr-4")}
          </tr>
        </thead>
        <tbody>
          {rows.map((i) => {
            const isTask = i.kind === "task";
            const done = isTask && i.status === "done";
            const pct = progress(i);
            const hasSubs = i.subItems.length > 0;
            const date = dateText(i);
            return (
              <tr
                key={i.id}
                onClick={() => onSelect(i.id)}
                className={clsx(
                  "cursor-pointer border-b border-line last:border-b-0 hover:bg-sunken/60",
                  selection === i.id && "bg-accent-soft/60",
                )}
              >
                <td className="py-2.5 pr-3 pl-4">
                  <span className={clsx("font-medium", done && "text-muted line-through")}>{i.title}</span>
                </td>
                <td className="px-3 py-2.5">
                  <KindTag kind={displayKind(i)} />
                </td>
                <td className="px-3 py-2.5">
                  {isTask && (
                    <CellSelect<ItemStatus>
                      label="진행 바꾸기"
                      value={i.status}
                      options={STATUSES.map((s) => ({ value: s, label: statusLabel[s] }))}
                      onChange={(s) => onUpdate(i.id, (x) => ({ ...x, status: s }))}
                    >
                      {i.status ? <StatusBadge status={i.status} /> : <span className="px-2 text-faint">—</span>}
                    </CellSelect>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  {isTask && (
                    <CellSelect<Priority>
                      label="우선순위 바꾸기"
                      value={i.priority}
                      options={PRIORITY_ORDER.map((p) => ({ value: p, label: p }))}
                      onChange={(p) => onUpdate(i.id, (x) => ({ ...x, priority: p }))}
                    >
                      {i.priority ? <PriorityBadge p={i.priority} /> : <span className="px-2 text-faint">—</span>}
                    </CellSelect>
                  )}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-muted tabular">
                  {date ?? <span className="text-faint">미배치</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap tabular">
                  {i.due ? (
                    <>
                      <span className="text-muted">{fmt(i.due, "M/d (EEE)")}</span>
                      {!done && (
                        <span
                          className={clsx(
                            "ml-1.5 text-[12px] font-medium",
                            dueTone(i.due) === "danger" ? "text-danger" : dueTone(i.due) === "warn" ? "text-warn" : "text-faint",
                          )}
                        >
                          {dueLabel(i.due)}
                        </span>
                      )}
                    </>
                  ) : null}
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex flex-wrap gap-1">
                    {i.tags.map((id) => {
                      const t = tags.find((x) => x.id === id);
                      return t ? <ItemTagChip key={id} label={t.label} color={t.color} /> : null;
                    })}
                  </span>
                </td>
                <td className="py-2.5 pr-4 pl-3">
                  {isTask && hasSubs && pct !== null && (
                    <span className="flex items-center gap-2">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-sunken">
                        <span
                          className={clsx("block h-full rounded-full", pct === 100 ? "bg-ok" : "bg-accent")}
                          style={{ width: `${pct}%` }}
                        />
                      </span>
                      <span className="text-[12px] text-muted tabular">
                        {i.subItems.filter((s) => s.done).length}/{i.subItems.length}
                      </span>
                    </span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
