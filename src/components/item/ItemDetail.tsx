"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { BookOpen, ChevronLeft, ChevronRight, Hourglass, MessageCircleQuestion } from "lucide-react";
import type { Item } from "@/lib/types";
import { displayKind, statusColor, statusLabel } from "@/lib/items";
import { deleteItem, updateItem, useItem, useTags } from "@/lib/itemStore";
import { Card, CardTitle, ItemTagChip, KindTag, PageBody, PriorityBadge, VerdictBadge } from "@/components/ui";
import { fmt } from "@/lib/date";
import { useQuestions, useWikiPages } from "@/components/workspace/hooks";
import { DeleteButton, EditableText, ItemProperties } from "./fields";
import { TaskWork } from "./TaskWork";
import { ClaudeBrief } from "./ClaudeBrief";

/** 항목 상세 (편집 가능). 일정이든 할 일이든 같은 화면 */
export function ItemDetail({ id }: { id: string }) {
  const it = useItem(id);
  const tags = useTags();
  const router = useRouter();
  const questions = useQuestions();
  const wikiPages = useWikiPages();

  if (!it) {
    return (
      <PageBody className="pt-10">
        <p className="text-[14px] text-muted">없는 항목이에요.</p>
        <Link href="/tasks" className="mt-3 inline-block text-[13.5px] text-accent-ink hover:underline">
          작업으로
        </Link>
      </PageBody>
    );
  }

  const onUpdate = (fn: (i: Item) => Item) => updateItem(id, fn);
  const kind = displayKind(it);
  const isTodo = it.kind === "task";
  const done = isTodo && it.status === "done";
  const itemTags = it.tags.map((t) => tags.find((d) => d.id === t)).filter((t) => t !== undefined);
  const related = questions.filter((q) => q.itemId === it.id);
  const wikis = it.wikiRefs.flatMap((slug) => wikiPages.filter((p) => p.slug === slug));

  return (
    <>
      <header className="px-6 pt-7 pb-5 lg:px-10 lg:pt-9">
        <Link href="/" className="mb-3 inline-flex items-center gap-0.5 text-[13px] text-muted hover:text-ink">
          <ChevronLeft className="size-3.5" /> 오늘
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          <KindTag kind={kind} />
          {isTodo && it.priority && <PriorityBadge p={it.priority} />}
          {isTodo && it.status && (
            <span className="inline-flex h-[20px] items-center gap-1.5 rounded-[5px] border border-line px-1.5 text-[11.5px] font-medium">
              <span className="size-1.5 rounded-full" style={{ background: statusColor[it.status] }} />
              {statusLabel[it.status]}
            </span>
          )}
          {itemTags.map((t) => (
            <ItemTagChip key={t.id} label={t.label} color={t.color} />
          ))}
        </div>
        <div
          className={clsx(
            "mt-2 max-w-3xl text-[24px] leading-snug font-bold tracking-[-0.02em]",
            done && "text-muted line-through",
          )}
        >
          <EditableText
            label="제목"
            value={it.title}
            placeholder="제목 없음"
            onSave={(v) => v && onUpdate((i) => ({ ...i, title: v }))}
          />
        </div>
      </header>

      <PageBody>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-5">
            {isTodo && it.status === "waiting" && it.waitingFor && (
              <div className="flex gap-3 rounded-xl border border-info/25 bg-info-soft px-4 py-3.5">
                <Hourglass className="mt-0.5 size-4.5 shrink-0 text-info" />
                <div>
                  <div className="text-[13px] font-semibold text-info">알아오는 중</div>
                  <div className="mt-0.5 text-[14px]">{it.waitingFor}</div>
                </div>
              </div>
            )}

            {isTodo && <TaskWork item={it} onUpdate={onUpdate} />}

            {isTodo && (
              <ClaudeBrief
                itemId={it.id}
                brief={it.brief}
                guidelines={it.wikiRefs}
                onSave={(brief) => onUpdate((i) => ({ ...i, brief }))}
              />
            )}

            {isTodo && (
              <Card>
                <CardTitle icon={<MessageCircleQuestion className="size-4" />}>
                  관련 질문 {related.length > 0 && <span className="text-muted tabular">{related.length}</span>}
                </CardTitle>
                {related.length === 0 ? (
                  <p className="px-5 pb-5 text-[13px] text-muted">없음</p>
                ) : (
                  <ul className="divide-y divide-line border-t border-line">
                    {related.map((a) => (
                      <li key={a.id}>
                        <Link href={`/questions/${a.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-sunken/60">
                          <VerdictBadge v={a.verdict} className="shrink-0" />
                          <span className="min-w-0 flex-1 truncate text-[14px]">{a.question}</span>
                          <span className="shrink-0 text-[12px] text-faint tabular">{fmt(a.askedAt, "M/d HH:mm")}</span>
                          <ChevronRight className="size-4 shrink-0 text-faint" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}

            {/* 노션처럼 맨 아래 본문 */}
            <section className="border-t border-line pt-5 text-[15px] leading-relaxed">
              <EditableText
                label="본문"
                multiline
                value={it.description}
                placeholder="내용 적기"
                onSave={(v) => onUpdate((i) => ({ ...i, description: v || undefined }))}
              />
            </section>
          </div>

          <aside className="space-y-5">
            <Card className="p-5">
              <ItemProperties item={it} tags={tags} onUpdate={onUpdate} />
              <div className="mt-5 border-t border-line pt-3">
                <DeleteButton
                  onDelete={() => {
                    deleteItem(id);
                    router.push("/tasks");
                  }}
                />
              </div>
            </Card>

            {wikis.length > 0 && (
              <Card>
                <CardTitle icon={<BookOpen className="size-4" />}>관련 위키</CardTitle>
                <ul className="space-y-1 px-2 pb-2">
                  {wikis.map((w) => (
                    <li key={w.slug}>
                      <Link href={`/wiki/${w.slug}`} className="block rounded-lg px-3 py-2.5 hover:bg-sunken">
                        <div className="text-[13.5px] font-medium">{w.title}</div>
                        <div className="mt-0.5 line-clamp-2 text-[12.5px] leading-relaxed text-muted">{w.summary}</div>
                      </Link>
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </aside>
        </div>
      </PageBody>
    </>
  );
}
