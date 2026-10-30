"use client";

import { useEffect } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, Check, Maximize2, RotateCcw, X } from "lucide-react";
import type { Item } from "@/lib/types";
import { displayKind, progress, type Tag } from "@/lib/items";
import { KindTag, PriorityBadge, ProgressRing } from "@/components/ui";
import { DeleteButton, EditableText, ItemProperties, SubItemsEditor } from "@/components/item/fields";

/**
 * 항목 상세 패널 — 제목·설명·속성·하위 항목을 바로 고친다.
 * - 데스크톱(≥1024): 노션 사이드 픽처럼 오른쪽 넓은 패널 (뒤 화면은 그대로 보임)
 * - 태블릿(640~1023): 가운데 모달 + 어두운 배경
 * - 모바일(<640): 전체 화면 시트
 */
export function DetailPanel({
  item,
  tags,
  onUpdate,
  onDelete,
  onClose,
}: {
  item: Item;
  tags: Tag[];
  onUpdate: (fn: (i: Item) => Item) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const kind = displayKind(item);
  const isTask = item.kind === "task";
  const pct = progress(item);
  const done = isTask && item.status === "done";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      const typing = t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.tagName === "SELECT");
      if (e.key === "Escape" && !typing) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex sm:items-center sm:justify-center lg:inset-y-0 lg:right-0 lg:left-auto lg:block lg:w-[min(620px,48vw)]">
      {/* 태블릿: 어두운 배경 (바깥 클릭으로 닫기) */}
      <div className="absolute inset-0 hidden bg-black/40 sm:block lg:hidden" onClick={onClose} />

      <aside
        role="dialog"
        aria-label={item.title}
        className={clsx(
          "relative flex h-dvh w-full flex-col bg-surface",
          "pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)] sm:pt-0 sm:pb-0",
          "sm:h-auto sm:max-h-[90dvh] sm:w-[min(720px,92vw)] sm:rounded-2xl sm:border sm:border-line sm:shadow-pop",
          "lg:h-full lg:max-h-none lg:w-full lg:rounded-none lg:border-0 lg:border-l lg:shadow-pop",
        )}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line px-5 py-3 sm:px-7">
          <div className="flex flex-wrap items-center gap-1.5">
            <KindTag kind={kind} />
            {isTask && item.priority && <PriorityBadge p={item.priority} />}
          </div>
          <div className="flex items-center gap-1">
            <Link
              href={`/items/${item.id}`}
              aria-label="전체 화면으로 열기"
              title="전체 화면으로 열기"
              className="grid size-10 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink lg:size-8"
            >
              <Maximize2 className="size-4" />
            </Link>
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="grid size-10 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink lg:size-8"
            >
              <X className="size-4.5" />
            </button>
          </div>
        </div>

        <div className="flex-1 space-y-7 overflow-y-auto px-5 py-6 sm:px-7">
          <section className="space-y-2">
            <div className="flex items-start gap-4">
              <div
                className={clsx(
                  "min-w-0 flex-1 text-[21px] leading-snug font-bold tracking-[-0.01em] lg:text-[22px]",
                  done && "text-muted line-through",
                )}
              >
                <EditableText
                  label="제목"
                  value={item.title}
                  placeholder="제목 없음"
                  onSave={(v) => v && onUpdate((i) => ({ ...i, title: v }))}
                />
              </div>
              {kind === "task" && pct !== null && <ProgressRing value={pct} size={52} />}
            </div>
          </section>

          <ItemProperties item={item} tags={tags} onUpdate={onUpdate} />

          {isTask && (
            <section>
              <div className="mb-2 text-[13px] font-medium text-faint">하위 항목</div>
              <SubItemsEditor item={item} onUpdate={onUpdate} large />
              {item.subItems.length === 0 && (
                <button
                  type="button"
                  onClick={() => onUpdate((i) => ({ ...i, status: i.status === "done" ? "todo" : "done" }))}
                  className={clsx(
                    "mt-3 inline-flex h-10 items-center gap-1.5 rounded-lg px-4 text-[14.5px] font-medium",
                    done ? "border border-line text-muted hover:text-ink" : "bg-accent text-white hover:bg-accent-ink",
                  )}
                >
                  {done ? (
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

          {/* 노션처럼 속성 아래 본문 */}
          <section className="border-t border-line pt-5 text-[15px] leading-relaxed">
            <EditableText
              label="본문"
              multiline
              value={item.description}
              placeholder="내용 적기"
              onSave={(v) => onUpdate((i) => ({ ...i, description: v || undefined }))}
            />
          </section>
        </div>

        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3 sm:px-7">
          <DeleteButton onDelete={onDelete} />
          <Link
            href={`/items/${item.id}`}
            className="inline-flex h-10 items-center gap-1.5 rounded-lg border border-line px-4 text-[14px] font-medium hover:bg-sunken lg:h-9"
          >
            상세 보기 <ArrowRight className="size-4" />
          </Link>
        </div>
      </aside>
    </div>
  );
}
