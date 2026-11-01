"use client";

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, BookOpen, ListPlus, Scale, Sparkles, Target } from "lucide-react";
import { Button, Card, CardTitle, EmptyState, PageBody, VerdictBadge } from "@/components/ui";
import { useQuestion, useWikiPages } from "@/components/workspace/hooks";
import { useItems } from "@/lib/itemStore";
import { fmt } from "@/lib/date";
import { Markdown } from "@/lib/markdown";
import { FeedbackBar } from "./FeedbackBar";
import { MissingItemCard } from "./MissingItemCard";
import { ItemLink } from "@/components/item/ItemPeek";
import { SaveAsCaution } from "@/components/caution/SaveAsCaution";

export function QuestionDetail({ id }: { id: string }) {
  const q = useQuestion(id);
  const items = useItems();
  const wikiPages = useWikiPages();
  if (!q)
    return (
      <PageBody className="pt-10">
        <EmptyState title="없는 질문 기록이에요" />
      </PageBody>
    );

  const getWikiPage = (slug: string) => wikiPages.find((p) => p.slug === slug);
  const quest = q.itemId ? items.find((i) => i.id === q.itemId) : undefined;
  const openMissing = q.missing.filter((m) => !m.done).length;

  return (
    <PageBody className="pt-6 lg:pt-8">
      <Link href="/questions" className="inline-flex items-center gap-1 text-[13px] text-muted hover:text-ink">
        <ArrowLeft className="size-3.5" /> 질문 기록
      </Link>

      <div className="mt-4 grid gap-8 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-w-0 max-w-[780px] space-y-6">
          {/* 질문 */}
          <header>
            <div className="text-[12.5px] text-muted tabular">{fmt(q.askedAt, "yyyy.M.d (E) HH:mm")}</div>
            <h1 className="mt-2 text-[24px] leading-snug font-bold tracking-[-0.02em]">{q.question}</h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <VerdictBadge v={q.verdict} />
              <span className="text-[13px] text-muted tabular">확신도 {Math.round(q.confidence * 100)}%</span>
              <span className="ml-auto">
                <SaveAsCaution q={q} />
              </span>
            </div>
          </header>

          {/* 답변 */}
          {q.answer && (
            <Card>
              <CardTitle icon={<Sparkles className="size-4" />}>답변</CardTitle>
              <div className="px-5 pb-5 text-[15px]">
                <Markdown source={q.answer} />
              </div>
            </Card>
          )}

          {/* 알아올 것 */}
          {q.missing.length > 0 && (
            <section>
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-[16px] font-semibold">
                  알아올 것
                  <span className="ml-2 text-[13px] font-normal text-muted">
                    {openMissing > 0 ? `${openMissing}개 남음` : "모두 완료"}
                  </span>
                </h2>
                {quest ? (
                  <ItemLink
                    id={quest.id}
                    className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-line bg-surface px-2.5 text-[13px] font-medium hover:bg-sunken"
                  >
                    <Target className="size-3.5" />
                    연결된 항목 보기
                  </ItemLink>
                ) : (
                  <Button size="sm">
                    <ListPlus className="size-3.5" />
                    할 일로 등록
                  </Button>
                )}
              </div>
              <div className="space-y-3">
                {q.missing.map((m, i) => (
                  <MissingItemCard key={i} questionId={q.id} item={m} index={i} />
                ))}
              </div>
            </section>
          )}

          {/* 근거 */}
          <Card>
            <CardTitle icon={<BookOpen className="size-4" />} right={<span className="text-[12px] text-muted tabular">{q.citations.length}개</span>}>
              근거로 쓴 위키
            </CardTitle>
            <div className="px-5 pb-5">
              {q.citations.length === 0 ? (
                <p className="rounded-lg bg-sunken px-4 py-3 text-[13.5px] text-muted">
                  근거로 쓴 위키가 없어요.
                </p>
              ) : (
                <ul className="space-y-2.5">
                  {q.citations.map((c, i) => {
                    const page = getWikiPage(c.wikiSlug);
                    return (
                      <li key={i}>
                        <Link
                          href={`/wiki/${c.wikiSlug}`}
                          className="group block rounded-lg border border-line px-4 py-3 hover:border-line-strong hover:bg-sunken/50"
                        >
                          <div className="flex items-center justify-between gap-2 text-[13px] font-medium text-accent-ink">
                            {page?.title ?? c.wikiSlug}
                            <ArrowUpRight className="size-3.5 text-faint group-hover:text-accent" />
                          </div>
                          <p className="mt-1 border-l-2 border-line-strong pl-3 text-[13.5px] leading-relaxed text-muted">
                            {c.excerpt}
                          </p>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </Card>

          <FeedbackBar questionId={q.id} value={q.feedback} />
        </div>

        {/* 판정 근거 */}
        <aside className="space-y-4">
          <Card>
            <CardTitle icon={<Scale className="size-4" />}>Claude가 이렇게 답한 이유</CardTitle>
            <div className="px-5 pb-5">
              <p className="text-[14px] leading-relaxed">{q.rationale}</p>
            </div>
          </Card>

          {quest && (
            <Card>
              <CardTitle icon={<Target className="size-4" />}>연결된 항목</CardTitle>
              <ItemLink id={quest.id} className="mx-2 mb-3 block rounded-lg px-3 py-2 hover:bg-sunken">
                <div className="text-[14px] font-medium">{quest.title}</div>
                <div className="mt-0.5 text-[12.5px] text-muted">
                  {[quest.priority, quest.due && `마감 ${fmt(quest.due, "M월 d일")}`].filter(Boolean).join(" · ")}
                </div>
              </ItemLink>
            </Card>
          )}
        </aside>
      </div>
    </PageBody>
  );
}
