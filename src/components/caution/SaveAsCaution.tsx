"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import type { QuestionRecord } from "@/lib/types";
import { addCaution, useCautions } from "@/lib/cautionStore";
import { Button } from "@/components/ui";

/** 질문 기록 → 주의할 점으로 남기기 (이미 남겼으면 바로가기) */
export function SaveAsCaution({ q }: { q: QuestionRecord }) {
  const saved = useCautions().find((c) => c.source.kind === "question" && c.source.id === q.id);
  if (saved) {
    return (
      <Link
        href={`/wiki/cautions#${saved.id}`}
        className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-warn-soft px-2.5 text-[13px] font-medium text-warn hover:brightness-[0.98]"
      >
        <ShieldAlert className="size-3.5" /> 주의할 점에 있음
      </Link>
    );
  }
  // 알아온 답이 있으면 그 답을, 없으면 질문을 주의할 점으로 (실제로는 Claude가 한 줄로 요약)
  const answered = q.missing.find((m) => m.answer);
  return (
    <Button
      size="sm"
      onClick={() =>
        addCaution({
          point: answered?.answer ?? q.question,
          wrong: answered ? q.question : undefined,
          by: answered?.kind === "ask_person" ? answered.target : undefined,
          source: { kind: "question", id: q.id },
          wikiRefs: [...new Set(q.citations.map((c) => c.wikiSlug))],
          tags: [],
        })
      }
    >
      <ShieldAlert className="size-3.5" /> 주의할 점으로 남기기
    </Button>
  );
}
