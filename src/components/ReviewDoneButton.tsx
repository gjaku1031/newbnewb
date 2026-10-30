"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check } from "lucide-react";
import type { WikiReview } from "@/lib/types";
import { fmt } from "@/lib/date";
import { markReviewed, undoReviewed } from "@/components/wiki/store";

export { nextInterval } from "@/lib/review";

/** 복습했음 버튼: 누르면 다음 복습일이 뒤로 밀린다 (다시 누르면 되돌리기) */
export function ReviewDoneButton({ slug, size = "md" }: { slug: string; size?: "sm" | "md" }) {
  const [done, setDone] = useState<{ prev: WikiReview; next: WikiReview } | null>(null);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    if (done) {
      undoReviewed(slug, done.prev);
      setDone(null);
      return;
    }
    setBusy(true);
    setDone(await markReviewed(slug));
    setBusy(false);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      title={done ? "되돌리기" : undefined}
      className={clsx(
        "inline-flex shrink-0 items-center gap-1 rounded-md font-medium transition-colors disabled:opacity-60",
        size === "sm" ? "h-7 px-2 text-[12px]" : "h-8 px-2.5 text-[12.5px]",
        done ? "bg-ok-soft text-ok" : "border border-line bg-surface hover:bg-sunken",
      )}
    >
      <Check className="size-3.5" />
      {done ? `복습함 · 다음 ${fmt(done.next.nextReview, "M/d")}` : "복습했음"}
    </button>
  );
}
