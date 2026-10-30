import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowUpRight, ChevronLeft, ChevronRight, CornerDownLeft, MessageCircleQuestion } from "lucide-react";
import { VerdictBadge } from "@/components/ui";
import { IssueBox } from "@/components/wiki/IssueBox";
import { OnThisPage } from "@/components/wiki/OnThisPage";
import { orderedPages } from "@/components/wiki/structure";
import { fmt } from "@/lib/date";
import { KIND_META, displayKind } from "@/lib/items";
import { Markdown, extractHeadings } from "@/lib/markdown";
import { questions } from "@/mocks/questions";
import { items } from "@/mocks/items";
import { getWikiPage, wikiPages } from "@/mocks/wiki";

export function generateStaticParams() {
  return wikiPages.map((p) => ({ slug: p.slug }));
}

export async function generateMetadata(props: PageProps<"/wiki/[slug]">) {
  const { slug } = await props.params;
  const page = getWikiPage(slug);
  return { title: page ? `${page.title} · 위키 · newb` : "위키 · newb" };
}

export default async function WikiDetailPage(props: PageProps<"/wiki/[slug]">) {
  const { slug } = await props.params;
  const page = getWikiPage(slug);
  if (!page) notFound();

  const order = orderedPages();
  const idx = order.findIndex((o) => o.page.slug === slug);
  const here = order[idx];
  const prev = idx > 0 ? order[idx - 1] : undefined;
  const next = idx < order.length - 1 ? order[idx + 1] : undefined;

  const headings = extractHeadings(page.body);
  const outLinks = page.links.map(getWikiPage).filter((p) => p !== undefined);
  const backLinks = wikiPages.filter((p) => p.slug !== slug && p.links.includes(slug) && !page.links.includes(p.slug));
  const usedInItems = items.filter((it) => it.wikiRefs.includes(slug));
  const citedIn = questions.filter((q) => q.citations.some((c) => c.wikiSlug === slug));

  return (
    <div className="flex gap-12 px-6 pt-8 pb-20 lg:px-12 lg:pt-10">
      {/* 본문 */}
      <article className="min-w-0 max-w-[720px] flex-1">
        <nav aria-label="위치" className="flex flex-wrap items-center gap-1 text-[13px] text-muted">
          <Link href="/wiki" className="hover:text-ink">
            위키
          </Link>
          <ChevronRight className="size-3.5 text-faint" />
          <span>{page.category}</span>
          <ChevronRight className="size-3.5 text-faint" />
          <span className="text-ink">{page.title}</span>
        </nav>

        <h1 className="mt-4 text-[32px] leading-tight font-bold tracking-[-0.025em]">
          {here && <span className="mr-2.5 text-faint tabular">{here.number}</span>}
          {page.title}
        </h1>
        <p className="mt-3 text-[17px] leading-relaxed text-muted">{page.summary}</p>
        <div className="mt-4 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-line pb-5 text-[12.5px] text-faint">
          <span>{fmt(page.updatedAt, "yyyy년 M월 d일")} 갱신</span>
          <span>·</span>
          <span>근거 {page.sourceIds.length}개</span>
          <span>·</span>
          <span>
            다음 복습 {fmt(page.review.nextReview, "M월 d일")} ({page.review.intervalDays}일마다)
          </span>
        </div>

        {page.issues?.length ? (
          <div className="mt-6 space-y-2">
            {page.issues.map((issue, i) => (
              <IssueBox key={i} issue={issue} />
            ))}
          </div>
        ) : null}

        <div className="mt-7 text-[15.5px]">
          <Markdown source={page.body} />
        </div>


        {(usedInItems.length > 0 || citedIn.length > 0) && (
          <section className="mt-8">
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
      </article>

      {/* 오른쪽: 이 페이지에서 */}
      <aside className="hidden w-[220px] shrink-0 xl:block">
        <div className="sticky top-10 space-y-7">
          <OnThisPage headings={headings} />


          {(outLinks.length > 0 || backLinks.length > 0) && (
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
          )}
        </div>
      </aside>
    </div>
  );
}
