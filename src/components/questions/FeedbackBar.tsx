"use client";

import clsx from "clsx";
import { ThumbsDown, ThumbsUp } from "lucide-react";

import { setFeedback } from "./actions";

export function FeedbackBar({ questionId, value }: { questionId: string; value?: "up" | "down" }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-line bg-surface px-5 py-3.5 shadow-card">
      <div className="flex items-center gap-3">
        <span className="text-[13.5px] font-medium">이 판정이 맞았나요?</span>
        <div className="flex gap-1">
          {(["up", "down"] as const).map((v) => {
            const Icon = v === "up" ? ThumbsUp : ThumbsDown;
            const active = value === v;
            return (
              <button
                key={v}
                aria-label={v === "up" ? "맞았어요" : "틀렸어요"}
                onClick={() => setFeedback(questionId, active ? undefined : v)}
                className={clsx(
                  "grid size-8 place-items-center rounded-lg border transition-colors",
                  active
                    ? v === "up"
                      ? "border-ok/40 bg-ok-soft text-ok"
                      : "border-danger/40 bg-danger-soft text-danger"
                    : "border-line text-muted hover:bg-sunken",
                )}
              >
                <Icon className="size-4" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
