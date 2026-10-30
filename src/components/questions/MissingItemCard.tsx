"use client";

import { useState } from "react";
import clsx from "clsx";
import { Check, CheckCircle2, Copy, FileSearch, HelpCircle, RefreshCw, UserRound } from "lucide-react";
import { Button } from "@/components/ui";
import type { MissingItem } from "@/lib/types";

const kindMeta = {
  ask_person: { label: "사람에게 묻기", icon: UserRound },
  find_document: { label: "문서 찾기", icon: FileSearch },
  clarify_question: { label: "질문 다듬기", icon: HelpCircle },
} as const;

export function MissingItemCard({ item, index }: { item: MissingItem; index: number }) {
  const [copied, setCopied] = useState(false);
  const [draft, setDraft] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const meta = kindMeta[item.kind];
  const Icon = meta.icon;
  const done = item.done || submitted;

  async function copy() {
    if (!item.suggestedScript) return;
    try {
      await navigator.clipboard.writeText(item.suggestedScript);
    } catch {
      // 클립보드 권한이 없으면 무시 (목업)
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  }

  return (
    <div className={clsx("rounded-xl border bg-surface shadow-card", done ? "border-line" : "border-info/40")}>
      <div className="flex items-start gap-3 px-5 pt-4">
        <span
          className={clsx(
            "grid size-8 shrink-0 place-items-center rounded-lg",
            done ? "bg-ok-soft text-ok" : "bg-info-soft text-info",
          )}
        >
          {done ? <CheckCircle2 className="size-4" /> : <Icon className="size-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted">
            <span className="font-semibold text-ink tabular">#{index + 1}</span>
            {meta.label}
            {item.target && (
              <>
                <span className="text-faint">·</span>
                <span className="font-medium text-ink">{item.target}</span>
              </>
            )}
            {done && <span className="font-medium text-ok">· 완료</span>}
          </div>
          <p className="mt-1 text-[14.5px] leading-relaxed font-medium">{item.what}</p>
        </div>
      </div>

      <div className="space-y-3 px-5 pt-3 pb-4 pl-16">
        {item.suggestedScript && (
          <div className="rounded-lg bg-sunken px-3.5 py-3">
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-muted">이렇게 물어보세요</span>
              <button
                onClick={copy}
                className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-[12px] text-muted hover:bg-surface hover:text-ink"
              >
                {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
                {copied ? "복사됨" : "복사"}
              </button>
            </div>
            <p className="text-[13.5px] leading-relaxed">“{item.suggestedScript}”</p>
          </div>
        )}

        {item.answer ? (
          <div className="rounded-lg border border-ok/30 bg-ok-soft px-3.5 py-3">
            <div className="mb-1 text-[12px] font-semibold text-ok">받아온 답</div>
            <p className="text-[13.5px] leading-relaxed">{item.answer}</p>
            <div className="mt-2 text-[12px] text-muted">→ 위키에 반영됨</div>
          </div>
        ) : submitted ? (
          <div className="flex items-start gap-2 rounded-lg bg-accent-soft px-3.5 py-3 text-[13.5px]">
            <RefreshCw className="mt-0.5 size-4 shrink-0 text-accent" />
            <span>다시 판정하는 중</span>
          </div>
        ) : (
          <div>
            <label className="mb-1.5 block text-[12.5px] font-medium text-muted" htmlFor={`ans-${index}`}>
              알아온 답 입력
            </label>
            <textarea
              id={`ans-${index}`}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              rows={3}
              placeholder={item.kind === "find_document" ? "찾은 문서 내용이나 위치를 적거나, 위키에 문서를 올려주세요" : "들은 답을 그대로 적어주세요. 말투 그대로도 괜찮아요"}
              className="w-full resize-y rounded-lg border border-line bg-surface px-3 py-2 text-[14px] leading-relaxed outline-none placeholder:text-faint focus:border-accent focus:ring-3 focus:ring-accent/15"
            />
            <div className="mt-2 flex justify-end">
              <Button size="sm" variant="primary" disabled={!draft.trim()} onClick={() => setSubmitted(true)}>
                <RefreshCw className="size-3.5" />
                위키에 반영하고 다시 판정
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
