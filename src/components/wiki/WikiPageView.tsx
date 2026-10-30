"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronLeft, ChevronRight, CornerDownLeft, MessageCircleQuestion } from "lucide-react";
import { EmptyState, VerdictBadge } from "@/components/ui";
import { KIND_META, displayKind } from "@/lib/items";
import { useItems } from "@/lib/itemStore";
import { useQuestions } from "@/components/workspace/hooks";
import { WikiArticle } from "./WikiArticle";
import { orderedPages } from "./structure";
import { findPage, useWiki } from "./store";

/** 위키 페이지 화면 (본문·이력·주석 + 쓰인 곳·이전/다음·연결된 페이지) */
export function WikiPageView({ slug }: { slug: string }) {
  const wiki = useWiki();
  const items = useItems();
  const questions = useQuestions();
  const page = findPage(wiki, slug);
  if (!page) return <EmptyState title="없는 페이지예요" />;

  const order = orderedPages(wiki.pages);
  const idx = order.findIndex((o) => o.page.slug === slug);
  const here = order[idx];
  const prev = idx > 0 ? order[idx - 1] : undefined;
  const next = idx < order.length - 1 ? order[idx + 1] : undefined;

  const outLinks = page.links.flatMap((s) => wiki.pages.filter((p) => p.slug === s));
  const backLinks = wiki.pages.filter((p) => p.slug !== slug && p.links.includes(slug) && !page.links.includes(p.slug));
  const usedInItems = items.filter((it) => it.wikiRefs.includes(slug));
  const citedIn = questions.filter((q) => q.citations.some((c) => c.wikiSlug === slug));

  return (
    <WikiArticle
      base={page}
      number={here?.number}
      after={
        <>
          {(usedInItems.length > 0 || citedIn.length > 0) && (
            <section className="mt-10">
              <h2 className="text-[15px] font-semibold">쓰인 곳</h2>
              <ul className="mt-3 space-y-1.5">
                {usedInItems.map((it) => (
                  <li key={it.id}>
                    <Link href={`/items/${it.id}`} className="flex items-center gap-2 text-[13.5px] hover:text-accent-ink">
                      <ArrowUpRight className="size-3.5 text-faint" />
                      <span className="text-faint">{KIND_META[displayKind(it)].label}</span> {it.title}
                    </Link>
                  </li>
                ))}
                {citedIn.map((q) => (
                  <li key={q.id}>
                    <Link href={`/questions/${q.id}`} className="flex items-center gap-2 text-[13.5px] hover:text-accent-ink">
                      <MessageCircleQuestion className="size-3.5 text-faint" />
                      <span className="text-faint">질문</span>
                      <span className="truncate">{q.question}</span>
                      <VerdictBadge v={q.verdict} className="shrink-0" />
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* 이전 / 다음 */}
          <div className="mt-12 grid gap-3 border-t border-line pt-8 sm:grid-cols-2">
            {prev ? (
              <Link
                href={`/wiki/${prev.page.slug}`}
                className="group rounded-xl border border-line px-4 py-3.5 transition-colors hover:border-line-strong hover:bg-surface"
              >
                <div className="flex items-center gap-1 text-[12.5px] text-muted">
                  <ChevronLeft className="size-3.5" /> 이전
                </div>
                <div className="mt-1 text-[14.5px] font-semibold group-hover:text-accent-ink">{prev.page.title}</div>
              </Link>
            ) : (
              <span />
            )}
            {next && (
              <Link
                href={`/wiki/${next.page.slug}`}
                className="group rounded-xl border border-line px-4 py-3.5 text-right transition-colors hover:border-line-strong hover:bg-surface"
              >
                <div className="flex items-center justify-end gap-1 text-[12.5px] text-muted">
                  다음 <ChevronRight className="size-3.5" />
                </div>
                <div className="mt-1 text-[14.5px] font-semibold group-hover:text-accent-ink">{next.page.title}</div>
              </Link>
            )}
          </div>
        </>
      }
      aside={
        outLinks.length > 0 || backLinks.length > 0 ? (
          <div className="border-t border-line pt-5">
            <div className="mb-2 text-[12.5px] font-semibold">연결된 페이지</div>
            <ul className="space-y-1.5 text-[13px]">
              {outLinks.map((p) => (
                <li key={p.slug}>
                  <Link href={`/wiki/${p.slug}`} className="flex items-center gap-1.5 text-muted hover:text-ink">
                    <ArrowUpRight className="size-3.5 shrink-0 text-faint" />
                    <span className="truncate">{p.title}</span>
                  </Link>
                </li>
              ))}
              {backLinks.map((p) => (
                <li key={p.slug}>
                  <Link href={`/wiki/${p.slug}`} className="flex items-center gap-1.5 text-muted hover:text-ink">
                    <CornerDownLeft className="size-3.5 shrink-0 text-faint" />
                    <span className="truncate">{p.title}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ) : null
      }
    />
  );
}
