"use client";

import clsx from "clsx";
import { useDraggable, useDroppable } from "@dnd-kit/core";
import { GripVertical } from "lucide-react";
import type { Item } from "@/lib/types";
import { KIND_META, displayKind, type Tag } from "@/lib/items";
import { PriorityBadge } from "@/components/ui";
import { isMultiDay, toneStyle, type CalItem, type Edge } from "./model";

/** 좌/우 끝 손잡이 — 끌어서 시작일/종료일을 바꾼다 */
function ResizeHandle({
  side,
  visible,
  onStart,
}: {
  side: "left" | "right";
  visible: boolean;
  onStart: (ev: React.PointerEvent) => void;
}) {
  return (
    <span
      role="presentation"
      title={side === "left" ? "시작일" : "종료일"}
      onPointerDown={(ev) => {
        ev.stopPropagation();
        ev.preventDefault();
        onStart(ev);
      }}
      onTouchStart={(ev) => ev.stopPropagation()}
      style={{ touchAction: "none" }}
      className={clsx(
        "absolute inset-y-0 z-[2] flex w-2.5 cursor-ew-resize items-center justify-center transition-opacity",
        side === "left" ? "left-0" : "right-0",
        visible ? "opacity-100" : "opacity-0 group-hover:opacity-100",
      )}
    >
      <span className="h-4 w-[3px] rounded-full bg-[var(--tone)] opacity-70" />
    </span>
  );
}

/** 하위 항목 진행 (3/6) — 작업일 때만 */
function stepCount(i: Item) {
  if (i.kind !== "task" || i.subItems.length === 0) return null;
  return `${i.subItems.filter((s) => s.done).length}/${i.subItems.length}`;
}

/**
 * 월 보기 항목 — 두 줄: (시간·유형·태그·진행·P) / 제목.
 * 하루짜리는 칸 안의 칩, 여러 날이면 주 줄을 가로지르는 막대(bar).
 * 가운데를 끌면 날짜 이동, 좌/우 끝을 끌면 기간 조절.
 */
export function ItemChip({
  item,
  tags,
  selected,
  onSelect,
  onResizeStart,
  dragId,
  bar,
}: {
  item: CalItem;
  tags: Tag[];
  selected: boolean;
  onSelect: () => void;
  onResizeStart?: (edge: Edge, ev: React.PointerEvent) => void;
  /** 같은 항목이 여러 주에 걸쳐 그려질 수 있어 드래그 id를 따로 받는다 */
  dragId?: string;
  /** 여러 날 막대일 때: 이 줄에서 실제 시작/끝이 보이는지 */
  bar?: { capLeft: boolean; capRight: boolean };
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: dragId ?? `item:${item.id}` });
  const kind = displayKind(item);
  const meta = KIND_META[kind];
  const tag = tags.find((t) => item.tags.includes(t.id));
  const done = item.kind === "task" && item.status === "done";
  const steps = stepCount(item);
  const range = isMultiDay(item)
    ? `${Number(item.start.slice(5, 7))}/${Number(item.start.slice(8, 10))}–${Number(item.end.slice(5, 7))}/${Number(item.end.slice(8, 10))}`
    : null;
  const capLeft = bar ? bar.capLeft : true;
  const capRight = bar ? bar.capRight : true;

  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      onClick={onSelect}
      style={toneStyle(meta.color)}
      className={clsx(
        "group relative block w-full cursor-grab px-2 py-1 text-left leading-tight active:cursor-grabbing",
        bar
          ? clsx(
              "tone-chip-soft",
              capLeft ? "rounded-l-[6px] border-l-[3px] border-[var(--tone)]" : "rounded-l-none",
              capRight ? "rounded-r-[6px]" : "rounded-r-none",
            )
          : "tone-bar rounded-r-[5px]",
        "hover:brightness-[0.97] dark:hover:brightness-110",
        selected && "ring-2 ring-accent",
        isDragging && "opacity-30",
        done && "opacity-60",
      )}
    >
      {onResizeStart && capLeft && (
        <ResizeHandle side="left" visible={selected} onStart={(ev) => onResizeStart("start", ev)} />
      )}
      <span className="flex items-center gap-1 text-[11px] text-muted">
        <span className="shrink-0 tabular">{item.allDay ? "종일" : item.start.slice(11, 16)}</span>
        <span className="tone-text shrink-0 font-medium">{meta.label}</span>
        {tag && (
          <span className="truncate" style={{ color: tag.color }}>
            {tag.label}
          </span>
        )}
        <span className="ml-auto flex shrink-0 items-center gap-1">
          {range && <span className="tabular">{range}</span>}
          {steps && <span className="tabular">{steps}</span>}
          {item.kind === "task" && item.priority && (
            <span className={clsx(`tone-${item.priority}`, "tone-text text-[10.5px] font-semibold")}>
              {item.priority}
            </span>
          )}
        </span>
      </span>
      <span className={clsx("mt-0.5 block truncate text-[12.5px] font-medium text-ink", done && "line-through")}>
        {item.title}
      </span>
      {onResizeStart && capRight && (
        <ResizeHandle side="right" visible={selected} onStart={(ev) => onResizeStart("end", ev)} />
      )}
    </button>
  );
}

/** 미배치 보관함의 할 일 (날짜 칸으로 끌어서 배치) */
export function TrayChip({ item, selected, onSelect }: { item: Item; selected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: `item:${item.id}` });
  const meta = KIND_META[displayKind(item)];
  return (
    <button
      ref={setNodeRef}
      {...attributes}
      {...listeners}
      type="button"
      onClick={onSelect}
      style={toneStyle(meta.color)}
      className={clsx(
        "group flex w-full cursor-grab items-center gap-1.5 rounded-[5px] border border-dashed border-line-strong bg-surface px-2 py-1.5 text-left text-[12.5px] hover:border-faint active:cursor-grabbing",
        selected && "ring-2 ring-accent",
        isDragging && "opacity-30",
      )}
    >
      <GripVertical className="size-3.5 shrink-0 text-faint group-hover:text-muted" />
      {item.priority && <PriorityBadge p={item.priority} />}
      <span className="tone-text shrink-0 text-[11.5px] font-medium">{meta.label}</span>
      <span className="min-w-0 truncate">{item.title}</span>
    </button>
  );
}

/** 드롭 영역 래퍼 */
export function DropZone({
  id,
  className,
  overClassName = "bg-accent-soft/70",
  style,
  date,
  children,
}: {
  id: string;
  className?: string;
  overClassName?: string;
  style?: React.CSSProperties;
  /** 날짜 칸이면 YYYY-MM-DD (끝 잡고 늘릴 때 좌표→날짜 찾기용) */
  date?: string;
  children?: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  return (
    <div ref={setNodeRef} data-date={date} style={style} className={clsx(className, isOver && overClassName)}>
      {children}
    </div>
  );
}
