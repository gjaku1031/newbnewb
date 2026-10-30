"use client";

import { useRef, useState } from "react";
import clsx from "clsx";
import { Plus } from "lucide-react";
import { addDays, isSameMonth, startOfMonth, startOfWeek } from "date-fns";
import type { Tag } from "@/lib/items";
import { TODAY } from "@/lib/today";
import { DropZone, ItemChip } from "./items";
import {
  applyResize,
  dateAtPoint,
  dateKey,
  endDay,
  isMultiDay,
  startDay,
  type CalItem,
  type Edge,
  type Selection,
} from "./model";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];
const HEAD_H = 32;
const LANE_H = 44;
/** 태그 줄이 있는 막대가 있는 주는 레인을 높인다 */
const LANE_H_TAGS = 64;
const WEEK_MIN_H = 156;

type Resizing = { id: string; edge: Edge; date: string } | null;

/** 노션 캘린더 스타일 월 보기 — 여러 날 항목은 막대로, 좌/우 끝을 끌어 기간 조절 */
export function MonthGrid({
  month,
  items,
  tags,
  selection,
  onSelect,
  onResize,
  onCreateAt,
}: {
  month: Date;
  /** 캘린더에 놓인(보이는) 항목 */
  items: CalItem[];
  tags: Tag[];
  selection: Selection;
  onSelect: (id: string) => void;
  onResize: (id: string, edge: Edge, date: string) => void;
  /** 그 날짜로 새 항목 만들기 */
  onCreateAt: (date: string) => void;
}) {
  const [resizing, setResizing] = useState<Resizing>(null);
  const latest = useRef<Resizing>(null);

  const gridStart = startOfWeek(startOfMonth(month), { weekStartsOn: 0 });
  const weekCount = isSameMonth(addDays(gridStart, 35), month) ? 6 : 5;
  const weeks = Array.from({ length: weekCount }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => addDays(gridStart, w * 7 + d)),
  );

  // 끝을 끄는 중이면 미리보기로 반영
  const shown = resizing
    ? items.map((i) => (i.id === resizing.id ? applyResize(i, resizing.edge, resizing.date) : i))
    : items;

  const startResize = (i: CalItem, edge: Edge) => {
    const init = { id: i.id, edge, date: edge === "start" ? startDay(i) : endDay(i) };
    latest.current = init;
    setResizing(init);

    const move = (pe: PointerEvent) => {
      const d = dateAtPoint(pe.clientX, pe.clientY);
      if (d && latest.current && d !== latest.current.date) {
        latest.current = { ...latest.current, date: d };
        setResizing(latest.current);
      }
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("pointercancel", up);
      const r = latest.current;
      latest.current = null;
      setResizing(null);
      if (r) onResize(r.id, r.edge, r.date);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    window.addEventListener("pointercancel", up);
  };

  return (
    <div className={clsx("overflow-x-auto", resizing && "cursor-ew-resize select-none")}>
      <div className="min-w-[880px]">
        <div className="grid grid-cols-7 border-b border-line">
          {WEEKDAYS.map((w, i) => (
            <div
              key={w}
              className={clsx(
                "px-3 py-2 text-[12.5px] font-medium",
                i === 0 ? "text-danger" : i === 6 ? "text-faint" : "text-muted",
              )}
            >
              {w}
            </div>
          ))}
        </div>

        {weeks.map((week, wi) => {
          const keys = week.map(dateKey);
          const ws = keys[0];
          const we = keys[6];

          // 이 주에 걸친 여러 날 항목 → 줄(lane) 배정
          const spans = shown
            .filter((i) => isMultiDay(i) && startDay(i) <= we && endDay(i) >= ws)
            .sort((a, b) => startDay(a).localeCompare(startDay(b)) || endDay(b).localeCompare(endDay(a)));
          const laneEnds: number[] = [];
          const placed = spans.map((i) => {
            const cs = startDay(i) < ws ? 0 : keys.indexOf(startDay(i));
            const ce = endDay(i) > we ? 6 : keys.indexOf(endDay(i));
            let lane = laneEnds.findIndex((end) => end < cs);
            if (lane === -1) {
              lane = laneEnds.length;
              laneEnds.push(ce);
            } else laneEnds[lane] = ce;
            return { i, cs, ce, lane, capLeft: startDay(i) >= ws, capRight: endDay(i) <= we };
          });
          const lanes = laneEnds.length;
          const laneH = spans.some((i) => i.tags.some((t) => tags.some((x) => x.id === t))) ? LANE_H_TAGS : LANE_H;
          const restMin = Math.max(48, WEEK_MIN_H - HEAD_H - lanes * laneH);

          return (
            <div
              key={ws}
              className="grid grid-cols-7 border-b border-line last:border-b-0"
              style={{
                gridTemplateRows: [`${HEAD_H}px`, ...Array(lanes).fill(`${laneH}px`), `minmax(${restMin}px, auto)`].join(
                  " ",
                ),
              }}
            >
              {/* 배경 칸 (드롭 영역 + 좌표→날짜) */}
              {week.map((d, c) => {
                const key = keys[c];
                const inMonth = isSameMonth(d, month);
                return (
                  <DropZone
                    key={`bg-${key}`}
                    id={`day:${key}`}
                    date={key}
                    onDoubleClick={() => onCreateAt(key)}
                    style={{ gridColumn: c + 1, gridRow: "1 / -1" }}
                    className={clsx(
                      "transition-colors",
                      c !== 0 && "border-l border-line",
                      (c === 0 || c === 6) && "bg-sunken/30",
                      !inMonth && "bg-sunken/60",
                      resizing && resizing.date === key && "bg-accent-soft/80",
                    )}
                  />
                );
              })}

              {/* 날짜 숫자 */}
              {week.map((d, c) => {
                const key = keys[c];
                const inMonth = isSameMonth(d, month);
                return (
                  <div
                    key={`h-${key}`}
                    style={{ gridColumn: c + 1, gridRow: 1 }}
                    className="group/day relative z-[1] flex items-start justify-between px-2.5 pt-1.5"
                    onDoubleClick={() => onCreateAt(key)}
                  >
                    <span
                      className={clsx(
                        "grid h-6 w-fit min-w-6 place-items-center rounded-full px-1 text-[12.5px] font-medium tabular",
                        key === TODAY && "bg-accent text-white",
                        key !== TODAY && c === 0 && (inMonth ? "text-danger" : "text-danger/50"),
                        key !== TODAY && c !== 0 && !inMonth && "text-faint",
                      )}
                    >
                      {d.getDate() === 1 ? `${d.getMonth() + 1}월 1일` : d.getDate()}
                    </span>
                    <button
                      type="button"
                      aria-label={`${key} 새 항목`}
                      onClick={() => onCreateAt(key)}
                      className="grid size-6 place-items-center rounded-md text-faint opacity-0 group-hover/day:opacity-100 focus:opacity-100 hover:bg-sunken hover:text-ink"
                    >
                      <Plus className="size-3.5" />
                    </button>
                  </div>
                );
              })}

              {/* 여러 날 막대 */}
              {placed.map(({ i, cs, ce, lane, capLeft, capRight }) => (
                <div
                  key={`span-${i.id}`}
                  style={{ gridColumn: `${cs + 1} / ${ce + 2}`, gridRow: lane + 2 }}
                  className={clsx("relative z-[1] py-[3px]", capLeft ? "pl-1.5" : "pl-0", capRight ? "pr-1.5" : "pr-0")}
                >
                  <ItemChip
                    item={i}
                    tags={tags}
                    dragId={`item:${i.id}:w${wi}`}
                    bar={{ capLeft, capRight }}
                    selected={selection === i.id}
                    onSelect={() => onSelect(i.id)}
                    onResizeStart={(edge) => startResize(i, edge)}
                  />
                </div>
              ))}

              {/* 하루짜리 항목 */}
              {week.map((d, c) => {
                const key = keys[c];
                const inMonth = isSameMonth(d, month);
                const dayItems = shown
                  .filter((i) => !isMultiDay(i) && startDay(i) === key)
                  .sort((a, b) => Number(!!b.allDay) - Number(!!a.allDay) || a.start.localeCompare(b.start));
                return (
                  <div
                    key={`c-${key}`}
                    onDoubleClick={(e) => e.target === e.currentTarget && onCreateAt(key)}
                    style={{ gridColumn: c + 1, gridRow: lanes + 2 }}
                    className={clsx("relative z-[1] space-y-1 px-1.5 pt-[3px] pb-1.5", !inMonth && "opacity-60")}
                  >
                    {dayItems.map((i) => (
                      <ItemChip
                        key={i.id}
                        item={i}
                        tags={tags}
                        selected={selection === i.id}
                        onSelect={() => onSelect(i.id)}
                        onResizeStart={(edge) => startResize(i, edge)}
                      />
                    ))}
                  </div>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
