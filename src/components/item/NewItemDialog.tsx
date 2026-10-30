"use client";

import { useState } from "react";
import clsx from "clsx";
import { X } from "lucide-react";
import type { ItemKind } from "@/lib/types";
import { addItem } from "@/lib/itemStore";
import { TODAY } from "@/lib/today";

/** 새 항목: 제목 → 일정/할 일 → (날짜) → 만들기. 할 일은 날짜 없이 만들면 미배치 */
export function NewItemDialog({
  date,
  onCreated,
  onClose,
}: {
  /** 캘린더 칸에서 열었으면 그 날짜 */
  date?: string;
  onCreated: (id: string) => void;
  onClose: () => void;
}) {
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<ItemKind>("task");
  const [day, setDay] = useState(date ?? "");

  const create = () => {
    const t = title.trim();
    if (!t) return;
    const base = { title: t, tags: [], subItems: [], wikiRefs: [] };
    const id =
      kind === "event"
        ? addItem({ ...base, kind, start: `${day || TODAY}T09:00`, end: `${day || TODAY}T10:00` })
        : addItem({
            ...base,
            kind,
            status: "todo",
            priority: "P3",
            ...(day ? { start: `${day}T00:00`, end: `${day}T23:59`, allDay: true } : {}),
          });
    onCreated(id);
  };

  return (
    <div className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/30 px-4 pt-[16vh]" onClick={onClose}>
      <div
        role="dialog"
        aria-label="새 항목"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-xl border border-line bg-surface p-4 shadow-pop"
      >
        <div className="flex items-center gap-2">
          <input
            autoFocus
            aria-label="제목"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.nativeEvent.isComposing) create();
              if (e.key === "Escape") onClose();
            }}
            placeholder="제목"
            className="min-w-0 flex-1 bg-transparent text-[17px] font-semibold outline-none placeholder:text-faint"
          />
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="grid size-7 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <div className="inline-flex rounded-md bg-sunken p-0.5">
            {(
              [
                { k: "task", label: "할 일" },
                { k: "event", label: "일정" },
              ] as const
            ).map(({ k, label }) => (
              <button
                key={k}
                type="button"
                aria-pressed={kind === k}
                onClick={() => setKind(k)}
                className={clsx(
                  "h-9 rounded px-3.5 text-[14px] font-medium lg:h-7 lg:px-3 lg:text-[13px]",
                  kind === k ? "bg-surface text-ink shadow-card" : "text-muted hover:text-ink",
                )}
              >
                {label}
              </button>
            ))}
          </div>
          <input
            type="date"
            aria-label="날짜"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            className="h-10 rounded-md border border-line bg-surface px-2 text-base tabular outline-none focus:border-accent [color-scheme:light] dark:[color-scheme:dark] lg:h-8 lg:text-[13px]"
          />
          <button
            type="button"
            onClick={create}
            disabled={!title.trim()}
            className="ml-auto h-10 rounded-lg bg-accent px-4 text-[14px] font-medium text-white hover:bg-accent-ink disabled:opacity-40 lg:h-8 lg:px-3.5 lg:text-[13.5px]"
          >
            만들기
          </button>
        </div>
      </div>
    </div>
  );
}
