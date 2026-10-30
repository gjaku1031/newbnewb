"use client";

import { useRef, useState } from "react";
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  TouchSensor,
  pointerWithin,
  rectIntersection,
  type CollisionDetection,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { addMonths, parseISO, startOfMonth } from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight, Eye, EyeOff, Inbox, Plus, Table2 } from "lucide-react";
import clsx from "clsx";
import type { DisplayKind, Item, ItemStatus } from "@/lib/types";
import { KIND_META, displayKind } from "@/lib/items";
import { fmt } from "@/lib/date";
import {
  addTag as storeAddTag,
  deleteItem,
  removeTag as storeRemoveTag,
  updateItem,
  useItems,
  useTags,
} from "@/lib/itemStore";
import { NewItemDialog } from "@/components/item/NewItemDialog";
import { TODAY } from "@/lib/today";
import { PriorityBadge } from "@/components/ui";
import { DropZone, TrayChip } from "./items";
import { MonthGrid } from "./MonthGrid";
import { TableView } from "./TableView";
import { DetailPanel } from "./DetailPanel";
import { TagBar } from "./TagBar";
import {
  applyResize,
  asCal,
  dateAtPoint,
  daysBetween,
  dragItemId,
  isPlaced,
  parseDropDate,
  shiftItem,
  startDay,
  toneStyle,
  type Edge,
  type Selection,
} from "./model";

/** 드롭 위치는 막대 전체가 아니라 포인터(손가락) 아래 칸으로 판단 */
const collision: CollisionDetection = (args) => {
  const hit = pointerWithin(args);
  return hit.length ? hit : rectIntersection(args);
};

type View = "calendar" | "table";

/** "작업" 화면: 같은 데이터·필터로 캘린더 / 데이터베이스(표) 보기 전환 (둘 다 월별) */
export function WorkView() {
  const [view, setView] = useState<View>("calendar");
  const [hiddenStatus, setHiddenStatus] = useState<Set<ItemStatus>>(new Set());
  const [month, setMonth] = useState<Date>(() => startOfMonth(parseISO(TODAY)));
  const items = useItems();
  const tags = useTags();
  /** 새 항목 창: null = 닫힘, "" = 날짜 없이, "YYYY-MM-DD" = 그 날짜로 */
  const [creating, setCreating] = useState<string | null>(null);
  const [hiddenTags, setHiddenTags] = useState<Set<string>>(new Set());
  const [hiddenKinds, setHiddenKinds] = useState<Set<DisplayKind>>(new Set());
  const [selection, setSelection] = useState<Selection>(null);
  const [dragging, setDragging] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  /** 여러 날 항목을 가운데쯤 잡고 끌 때, 잡은 지점이 시작일에서 며칠 떨어졌는지 */
  const grabOffset = useRef(0);

  // 마우스는 5px 움직이면 드래그, 터치(아이패드·아이폰)는 길게 눌러 드래그
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 6 } }),
  );

  const itemOf = (id?: string | null) => (id ? items.find((i) => i.id === id) : undefined);

  /** 유형·태그 필터: 유형이 숨겨졌거나, 붙은 태그 중 하나라도 숨겨졌으면 안 보임 */
  const isVisible = (i: Item) =>
    !hiddenKinds.has(displayKind(i)) &&
    !i.tags.some((t) => hiddenTags.has(t)) &&
    !(i.kind === "task" && i.status && hiddenStatus.has(i.status));
  const hideDone = hiddenStatus.has("done");

  // 표 보기: 이번 달에 걸친 항목 + 날짜는 없지만 마감이 이번 달인 할 일
  const monthKey = fmt(month, "yyyy-MM");
  const inMonth = (i: Item) => {
    if (i.start) {
      const s = i.start.slice(0, 7);
      const e = (i.end ?? i.start).slice(0, 7);
      return s <= monthKey && e >= monthKey;
    }
    return !!i.due && i.due.slice(0, 7) === monthKey;
  };
  const tableRows = items.filter(isVisible).filter(inMonth);

  const placed = items.filter(isPlaced).filter(isVisible).map(asCal);
  const unscheduled = items.filter((i) => i.kind === "task" && !i.start && isVisible(i) && i.status !== "done");

  const flash = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast(null), 2200);
  };

  const update = (id: string, fn: (i: Item) => Item) => updateItem(id, fn);

  const onDragStart = (e: DragStartEvent) => {
    const id = String(e.active.id);
    setDragging(id);
    grabOffset.current = 0;
    const it = itemOf(dragItemId(id));
    const act = e.activatorEvent as PointerEvent | TouchEvent;
    const pt = "touches" in act ? act.touches[0] : act;
    const grabbed = it?.start && pt ? dateAtPoint(pt.clientX, pt.clientY) : null;
    if (it?.start && grabbed) grabOffset.current = Math.max(0, daysBetween(it.start.slice(0, 10), grabbed));
  };

  const onDragEnd = ({ active, over }: DragEndEvent) => {
    setDragging(null);
    if (!over) return;
    const id = dragItemId(String(active.id));
    const it = itemOf(id);
    if (!it) return;
    const overId = String(over.id);

    // 보관함으로: 할 일만 미배치로
    if (overId === "tray") {
      if (it.kind === "task" && it.start) {
        update(id, (i) => ({ ...i, start: undefined, end: undefined, allDay: undefined }));
        flash(`'${it.title}' 미배치로 옮김`);
      }
      return;
    }

    const date = parseDropDate(overId);
    if (!date) return;

    if (!it.start) {
      // 미배치 할 일 → 그 날 종일 배치
      update(id, (i) => ({ ...i, start: `${date}T00:00`, end: `${date}T23:59`, allDay: true }));
      flash(`'${it.title}' ${fmt(date, "M월 d일 (EEE)")}에 배치`);
      return;
    }

    const cal = asCal(it);
    const delta = daysBetween(startDay(cal), date) - grabOffset.current;
    if (delta === 0) return;
    const moved = shiftItem(cal, delta);
    update(id, (i) => ({ ...i, start: moved.start, end: moved.end }));
    flash(`'${it.title}' ${fmt(startDay(moved), "M월 d일 (EEE)")}로 이동`);
  };

  const resizeItem = (id: string, edge: Edge, date: string) => {
    const it = itemOf(id);
    if (!it?.start) return;
    const cal = asCal(it);
    const next = applyResize(cal, edge, date);
    if (next.start === cal.start && next.end === cal.end) return;
    update(id, (i) => ({ ...i, start: next.start, end: next.end }));
    const s = fmt(next.start, "M월 d일");
    const e = fmt(next.end, "M월 d일");
    flash(s === e ? `'${it.title}' ${s} 하루` : `'${it.title}' ${s} – ${e}`);
  };

  const toggleIn = <T,>(set: Set<T>, v: T) => {
    const next = new Set(set);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    return next;
  };

  const addTag = (label: string, color: string) => storeAddTag(label, color);

  const removeTag = (id: string) => {
    storeRemoveTag(id);
    setHiddenTags((s) => {
      const next = new Set(s);
      next.delete(id);
      return next;
    });
  };

  const selected = itemOf(selection);

  const overlay = (() => {
    if (!dragging) return null;
    const it = itemOf(dragItemId(dragging));
    return it ? { title: it.title, priority: it.priority, color: KIND_META[displayKind(it)].color } : null;
  })();

  return (
    <DndContext
      id="calendar-dnd"
      sensors={sensors}
      collisionDetection={collision}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
    >
      {/* 툴바 */}
      <div className="flex flex-wrap items-center gap-3 pb-3">
        <button
          type="button"
          onClick={() => setMonth(startOfMonth(parseISO(TODAY)))}
          className="h-8 rounded-lg border border-line bg-surface px-3 text-[13px] font-medium hover:bg-sunken"
        >
          오늘
        </button>
        <div className="flex">
          <button
            type="button"
            aria-label="이전 달"
            onClick={() => setMonth((m) => addMonths(m, -1))}
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink"
          >
            <ChevronLeft className="size-4.5" />
          </button>
          <button
            type="button"
            aria-label="다음 달"
            onClick={() => setMonth((m) => addMonths(m, 1))}
            className="grid size-8 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink"
          >
            <ChevronRight className="size-4.5" />
          </button>
        </div>
        <h2 className="text-[18px] font-semibold tabular">{fmt(month, "yyyy년 M월")}</h2>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setCreating("")}
            className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-accent px-3 text-[13px] font-medium text-white hover:bg-accent-ink"
          >
            <Plus className="size-4" /> 새 항목
          </button>
          <button
            type="button"
            onClick={() => setHiddenStatus((s) => toggleIn(s, "done" as ItemStatus))}
            aria-pressed={hideDone}
            className={clsx(
              "inline-flex h-8 items-center gap-1.5 rounded-lg border px-3 text-[13px] font-medium transition-colors",
              hideDone
                ? "border-accent/40 bg-accent-soft text-accent-ink"
                : "border-line bg-surface text-muted hover:text-ink",
            )}
          >
            {hideDone ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
            완료 숨기기
          </button>
          <div role="tablist" className="flex rounded-lg bg-sunken p-0.5">
            {(
              [
                { id: "calendar", label: "캘린더", icon: CalendarDays },
                { id: "table", label: "데이터베이스", icon: Table2 },
              ] as const
            ).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={view === id}
                onClick={() => setView(id)}
                className={clsx(
                  "inline-flex h-7 items-center gap-1.5 rounded-md px-3 text-[13px] font-medium",
                  view === id ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
                )}
              >
                <Icon className="size-3.5" />
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="pb-4">
        <TagBar
          hiddenKinds={hiddenKinds}
          onToggleKind={(k) => setHiddenKinds((s) => toggleIn(s, k))}
          hiddenStatus={hiddenStatus}
          onToggleStatus={(st) => setHiddenStatus((s) => toggleIn(s, st))}
          tags={tags}
          hiddenTags={hiddenTags}
          onToggleTag={(id) => setHiddenTags((s) => toggleIn(s, id))}
          onAddTag={addTag}
          onRemoveTag={removeTag}
        />
      </div>

      {view === "calendar" && (
        <>
          {/* 미배치 할 일 보관함 */}
          <DropZone
            id="tray"
            className="mb-4 flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface px-3 py-2.5 transition-colors"
            overClassName="bg-accent-soft border-accent"
          >
            <span className="flex shrink-0 items-center gap-1.5 pr-1 text-[12.5px] font-medium text-muted">
              <Inbox className="size-4" />
              미배치 <span className="tabular text-faint">{unscheduled.length}</span>
            </span>
            {unscheduled.map((i) => (
              <div key={i.id} className="w-auto max-w-[340px]">
                <TrayChip item={i} selected={selection === i.id} onSelect={() => setSelection(i.id)} />
              </div>
            ))}
          </DropZone>

          <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
            <MonthGrid
              month={month}
              items={placed}
              tags={tags}
              selection={selection}
              onSelect={setSelection}
              onResize={resizeItem}
              onCreateAt={(d) => setCreating(d)}
            />
          </div>
        </>
      )}

      {view === "table" && (
        <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          <TableView
            items={tableRows}
            tags={tags}
            selection={selection}
            onSelect={setSelection}
            onUpdate={update}
            onCreate={() => setCreating("")}
          />
        </div>
      )}

      <DragOverlay dropAnimation={null}>
        {overlay && (
          <div
            style={toneStyle(overlay.color)}
            className="tone-bar flex max-w-[240px] items-center gap-1.5 rounded-r-md px-2 py-1.5 text-[12.5px] shadow-pop"
          >
            {overlay.priority && <PriorityBadge p={overlay.priority} />}
            <span className="truncate font-medium">{overlay.title}</span>
          </div>
        )}
      </DragOverlay>

      {selected && (
        <DetailPanel
          item={selected}
          tags={tags}
          onUpdate={(fn) => update(selected.id, fn)}
          onDelete={() => {
            deleteItem(selected.id);
            setSelection(null);
            flash(`'${selected.title}' 삭제`);
          }}
          onClose={() => setSelection(null)}
        />
      )}

      {creating !== null && (
        <NewItemDialog
          date={creating || undefined}
          onClose={() => setCreating(null)}
          onCreated={(id) => {
            setCreating(null);
            setSelection(id);
          }}
        />
      )}

      {toast && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg bg-ink px-4 py-2.5 text-[13px] text-bg shadow-pop">
          {toast}
        </div>
      )}
    </DndContext>
  );
}
