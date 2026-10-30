"use client";

import { useState } from "react";
import clsx from "clsx";
import { Plus, X } from "lucide-react";
import type { DisplayKind, ItemStatus } from "@/lib/types";
import { KIND_META, STATUSES, statusColor, statusLabel, type Tag } from "@/lib/items";
import { toneStyle } from "./model";

const KINDS: DisplayKind[] = ["event", "simple", "task"];

function Chip({
  label,
  color,
  off,
  onToggle,
  onRemove,
  dot = true,
}: {
  label: string;
  color: string;
  off: boolean;
  /** 유형·진행은 점 표시, 태그는 점 없이 색 배경+글자만 */
  dot?: boolean;
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
        {dot && <span className={clsx("size-2 rounded-full", off ? "bg-line-strong" : "tone-dot")} />}
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
  const [color, setColor] = useState("#6e56cf");

  /** 새 태그 색은 무작위로 시작 (선택기로 바꿀 수 있음) */
  const open = () => {
    const h = Math.floor(Math.random() * 360);
    setColor(hslToHex(h, 62, 52));
    setLabel("");
    setAdding(true);
  };
  const close = () => {
    setLabel("");
    setAdding(false);
  };
  const submit = () => {
    const name = label.trim();
    if (!name) return;
    onAddTag(name, color);
    close();
  };

  return (
    <div className="flex flex-col gap-2">
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
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[12px] font-medium text-faint">태그</span>
        {tags.map((t) => (
          <Chip
            key={t.id}
            label={t.label}
            color={t.color}
            off={hiddenTags.has(t.id)}
            dot={false}
            onToggle={() => onToggleTag(t.id)}
            onRemove={() => onRemoveTag(t.id)}
          />
        ))}
        {adding ? (
          <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface pr-1 pl-1.5 shadow-card lg:h-8">
            {/* 색 선택기 (RGB) */}
            <label
              className="relative grid size-6 shrink-0 cursor-pointer place-items-center rounded-full ring-1 ring-line"
              style={{ background: color }}
              title="색 고르기"
            >
              <input
                type="color"
                aria-label="태그 색"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 size-full cursor-pointer opacity-0"
              />
            </label>
            <input
              autoFocus
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") submit();
                if (e.key === "Escape") close();
              }}
              placeholder="태그 이름"
              style={{ color }}
              className="w-28 bg-transparent text-[16px] font-medium outline-none placeholder:font-normal placeholder:text-faint lg:text-[13px]"
            />
            <button
              type="button"
              onClick={submit}
              disabled={!label.trim()}
              className="h-7 rounded-full bg-accent px-3 text-[12.5px] font-medium text-white hover:bg-accent-ink disabled:opacity-40 lg:h-6 lg:px-2.5 lg:text-[12px]"
            >
              추가
            </button>
            <button
              type="button"
              onClick={close}
              aria-label="닫기"
              className="grid size-7 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink lg:size-6"
            >
              <X className="size-3.5" />
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={open}
            className="inline-flex h-7 items-center gap-1 rounded-full border border-dashed border-line-strong px-2.5 text-[12.5px] text-muted hover:border-faint hover:text-ink"
          >
            <Plus className="size-3.5" /> 태그
          </button>
        )}
      </div>
    </div>
  );
}

/** HSL → #rrggbb */
function hslToHex(h: number, s: number, l: number) {
  const a = (s / 100) * Math.min(l / 100, 1 - l / 100);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const c = l / 100 - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
