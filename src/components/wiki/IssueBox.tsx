"use client";

import { useState } from "react";
import { AlertTriangle, Check, Clock, PencilLine, Unlink } from "lucide-react";
import { Button } from "@/components/ui";
import type { WikiPage } from "@/lib/types";

type Issue = NonNullable<WikiPage["issues"]>[number];

const meta = {
  conflict: { title: "근거가 서로 달라요", icon: AlertTriangle, box: "bg-danger-soft", ink: "text-danger" },
  stale: { title: "오래된 내용일 수 있어요", icon: Clock, box: "bg-warn-soft", ink: "text-warn" },
  orphan: { title: "다른 페이지와 연결이 없어요", icon: Unlink, box: "bg-sunken", ink: "text-muted" },
} as const;

export function IssueBox({ issue }: { issue: Issue }) {
  const [resolved, setResolved] = useState<null | "ok" | "edit">(null);
  const m = meta[issue.kind];
  const Icon = m.icon;

  if (resolved) {
    return (
      <div className="flex items-center gap-2 rounded-xl border border-line bg-surface px-4 py-3 text-[13.5px] text-muted">
        <Check className="size-4 text-ok" />
        {resolved === "ok" ? "확인 완료로 기록했어요. 판정할 때 이 내용을 더 믿고 쓸게요." : "수정 요청을 남겼어요. 다음에 정리할 때 반영할게요."}
      </div>
    );
  }

  return (
    <div className={`rounded-xl px-4 py-3.5 ${m.box}`}>
      <div className="flex gap-3">
        <Icon className={`mt-0.5 size-[18px] shrink-0 ${m.ink}`} />
        <div className="min-w-0 flex-1">
          <div className={`text-[14px] font-semibold ${m.ink}`}>{m.title}</div>
          <p className="mt-0.5 text-[13.5px] leading-relaxed">{issue.message}</p>
          {issue.kind === "conflict" && (
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" onClick={() => setResolved("ok")}>
                <Check className="size-3.5" /> 확인했어요
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setResolved("edit")}>
                <PencilLine className="size-3.5" /> 수정할게요
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
