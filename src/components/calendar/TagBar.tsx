"use client";

import { useState } from "react";
import clsx from "clsx";
import { Plus, X } from "lucide-react";
import type { DisplayKind, ItemStatus } from "@/lib/types";
import { KIND_META, STATUSES, TAG_COLORS, statusColor, statusLabel, type Tag } from "@/lib/items";
import { toneStyle } from "./model";

const KINDS: DisplayKind[] = ["event", "simple", "task"];

function Chip({
  label,
  color,
  off,
  onToggle,
  onRemove,
}: {
  label: string;
  color: string;
  off: boolean;
  onToggle: () => void;
  onRemove?: () => void;
}) {
  return (
    <span
      style={toneStyle(color)}
      className={clsx(
        "group inline-flex h-7 items-center gap-1.5 rounded-full border pl-2.5 text-[12.5px] transition-colors",
        onRemove ? "pr-1" : "pr-2.5",
        off ? "border-line text-faint" : "tone-chip border-transparent font-medium",
      )}
    >
      <button type="button" onClick={onToggle} className="flex items-center gap-1.5" aria-pressed={!off}>
        <span className={clsx("size-2 rounded-full", off ? "bg-line-strong" : "tone-dot")} />
        {label}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={`${label} 태그 삭제`}
          className="grid size-5 place-items-center rounded-full opacity-40 hover:bg-black/5 hover:opacity-100 dark:hover:bg-white/10"
        >
          <X className="size-3" />
        </button>
      )}
    </span>
  );
}

/** 유형(고정 3종) 필터 + 자유 태그(추가·삭제·보이기/숨기기) */
export function TagBar({
  hiddenKinds,
  onToggleKind,
  hiddenStatus,
  onToggleStatus,
  tags,
  hiddenTags,
  onToggleTag,
  onAddTag,
  onRemoveTag,
}: {
  hiddenKinds: Set<DisplayKind>;
  onToggleKind: (k: DisplayKind) => void;
  hiddenStatus: Set<ItemStatus>;
  onToggleStatus: (s: ItemStatus) => void;
  tags: Tag[];
  hiddenTags: Set<string>;
  onToggleTag: (id: string) => void;
  onAddTag: (label: string, color: string) => void;
  onRemoveTag: (id: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [label, setLabel] = useState("");
  const [color, setColor] = useState(TAG_COLORS[0]);

  const submit = () => {
    const name = label.trim();
    if (!name) return;
    onAddTag(name, color);
    setLabel("");
    setAdding(false);
  };

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] font-medium text-faint">유형</span>
        {KINDS.map((k) => (
          <Chip
            key={k}
            label={KIND_META[k].label}
            color={KIND_META[k].color}
            off={hiddenKinds.has(k)}
            onToggle={() => onToggleKind(k)}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] font-medium text-faint">진행</span>
        {STATUSES.map((s) => (
          <Chip
            key={s}
            label={statusLabel[s]}
            color={statusColor[s]}
            off={hiddenStatus.has(s)}
            onToggle={() => onToggleStatus(s)}
          />
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] font-medium text-faint">태그</span>
        {tags.map((t) => (
          <Chip
            key={t.id}
            label={t.label}
            color={t.color}
            off={hiddenTags.has(t.id)}
            onToggle={() => onToggleTag(t.id)}
            onRemove={() => onRemoveTag(t.id)}
          />
        ))}
        {adding ? (
          <span className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface pr-1 pl-2.5 shadow-card">
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") setAdding(false);
              }}
              placeholder="태그 이름"
              className="w-24 bg-transparent text-[13px] outline-none placeholder:text-faint"
            />
            <span className="flex items-center gap-1">
              {TAG_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={`색 ${c}`}
                  onClick={() => setColor(c)}
                  className={clsx("size-3.5 rounded-full", color === c && "ring-2 ring-offset-1 ring-offset-surface")}
                  style={{ background: c, ["--tw-ring-color" as string]: c } as React.CSSProperties}
                />
              ))}
            </span>
            <button
              type="button"
              onClick={submit}
              className="h-6 rounded-full bg-accent px-2.5 text-[12px] font-medium text-white hover:bg-accent-ink"
            >
              추가
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 text-[12.5px] text-muted hover:border-faint hover:text-ink"
          >
            <Plus className="size-3.5" /> 태그
          </button>
        )}
      </div>
    </div>
  );
}
