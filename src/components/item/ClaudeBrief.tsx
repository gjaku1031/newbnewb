"use client";

import { useState } from "react";
import Link from "next/link";
import { Bot, BookOpen, Pencil, ShieldAlert } from "lucide-react";
import type { Caution } from "@/lib/types";
import { Card, CardTitle, Button } from "@/components/ui";
import { CopyButton } from "@/components/CopyButton";
import { useWikiPages } from "@/components/workspace/hooks";

/**
 * 할 일의 Claude 작업 지침 (편집 가능).
 * 앱에서는 지침만 써 두고, 실제 작업·결과물·따라읽기는 Claude Desktop 채팅에 출력된다.
 * Claude는 MCP get_task_brief 로 이 지침과 관련 위키를 가져간다.
 */
export function ClaudeBrief({
  itemId,
  brief,
  guidelines,
  cautions = [],
  onSave,
}: {
  itemId: string;
  brief?: string;
  guidelines: string[];
  cautions?: Caution[];
  onSave: (brief: string | undefined) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(brief ?? "");
  const startPrompt = `newb 항목 ${itemId} 지침대로 작업해줘. 작성하면서 어디를 왜 이렇게 썼는지 따라읽기로 설명해줘.`;
  const wikiPages = useWikiPages();
  const wikis = guidelines.flatMap((slug) => wikiPages.filter((p) => p.slug === slug));

  const open = () => {
    setDraft(brief ?? "");
    setEditing(true);
  };
  const save = () => {
    onSave(draft.trim() || undefined);
    setEditing(false);
  };

  return (
    <Card>
      <CardTitle
        icon={<Bot className="size-4" />}
        right={
          !editing && (
            <Button size="sm" variant="ghost" onClick={open}>
              <Pencil className="size-3.5" /> {brief ? "지침 수정" : "지침 쓰기"}
            </Button>
          )
        }
      >
        Claude 작업 지침
      </CardTitle>

      {editing ? (
        <div className="space-y-2 px-5 pb-5">
          <textarea
            autoFocus
            aria-label="Claude 작업 지침"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Escape") setEditing(false);
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) save();
            }}
            rows={8}
            className="w-full resize-y rounded-lg border border-line bg-surface px-4 py-3 text-[14px] leading-relaxed outline-none focus:border-accent"
          />
          <div className="flex justify-end gap-2">
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              취소
            </Button>
            <Button size="sm" variant="primary" onClick={save}>
              저장
            </Button>
          </div>
        </div>
      ) : brief ? (
        <div className="space-y-4 px-5 pb-5">
          <p className="rounded-lg bg-sunken/70 px-4 py-3 text-[14px] leading-relaxed whitespace-pre-line">{brief}</p>

          {wikis.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="mr-1 flex items-center gap-1 text-[12.5px] text-muted">
                <BookOpen className="size-3.5" /> 함께 전달되는 가이드라인
              </span>
              {wikis.map((w) => (
                <Link
                  key={w.slug}
                  href={`/wiki/${w.slug}`}
                  className="rounded-md border border-line px-2 py-0.5 text-[12.5px] hover:bg-sunken"
                >
                  {w.title}
                </Link>
              ))}
            </div>
          )}

          {cautions.length > 0 && (
            <div>
              <span className="flex items-center gap-1 text-[12.5px] text-muted">
                <ShieldAlert className="size-3.5" /> 함께 전달되는 주의할 점
              </span>
              <ul className="mt-1.5 space-y-1">
                {cautions.map((c) => (
                  <li key={c.id} className="flex gap-2 text-[13px] leading-snug">
                    <span className="mt-[7px] size-1 shrink-0 rounded-full bg-warn" />
                    {c.point}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div className="rounded-lg border border-accent/25 bg-accent-soft px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-[12.5px] font-semibold text-accent-ink">Claude Desktop에 이렇게 말하세요</span>
              <CopyButton text={startPrompt} />
            </div>
            <p className="mt-1.5 text-[13.5px] leading-relaxed">{startPrompt}</p>
          </div>
        </div>
      ) : (
        <p className="px-5 pb-5 text-[13px] text-muted">아직 지침이 없어요.</p>
      )}
    </Card>
  );
}
