"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { NotebookPen, X } from "lucide-react";
import { MemoComposer } from "./MemoBoard";
import { resumePending } from "./store";

/** 오른쪽 아래 빠른 메모 버튼 (주석 툴바 버튼 바로 위) */
export function QuickMemo() {
  const [open, setOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  // 새로고침 등으로 정리가 멈춘 메모가 있으면 이어서 처리
  useEffect(() => resumePending(), []);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      {open && (
        <div
          className={clsx(
            "fixed z-30 rounded-2xl border border-line bg-bg p-3 shadow-pop",
            "inset-x-3 bottom-[calc(132px+env(safe-area-inset-bottom))] sm:inset-x-auto sm:right-5 sm:w-[380px]",
          )}
        >
          <div className="mb-2 flex items-center justify-between px-1">
            <span className="flex items-center gap-1.5 text-[13px] font-semibold">
              <NotebookPen className="size-4 text-accent" />
              빠른 메모
            </span>
            <button
              type="button"
              aria-label="닫기"
              onClick={() => setOpen(false)}
              className="grid size-7 place-items-center rounded-md text-muted hover:bg-sunken hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>
          <MemoComposer
            autoFocus
            onSaved={() => {
              setOpen(false);
              setSaved(true);
              window.setTimeout(() => setSaved(false), 3000);
            }}
          />
        </div>
      )}

      {saved && (
        <div className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] left-1/2 z-30 -translate-x-1/2 rounded-lg bg-ink px-4 py-2.5 text-[13px] text-bg shadow-pop">
          메모 저장 · Claude 정리 중{" "}
          <Link href="/memos" className="ml-1 font-semibold underline underline-offset-2">
            보기
          </Link>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="빠른 메모"
        title="빠른 메모"
        className={clsx(
          "fixed right-5 bottom-[calc(76px+env(safe-area-inset-bottom))] z-30 grid size-11 place-items-center rounded-full shadow-pop transition-colors",
          open ? "bg-accent text-white" : "bg-surface text-ink ring-1 ring-line hover:bg-sunken",
        )}
      >
        <NotebookPen className="size-5" />
      </button>
    </>
  );
}
