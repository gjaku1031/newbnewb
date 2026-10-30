import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import clsx from "clsx";
import { BookOpen, ChevronLeft, ChevronRight, Hourglass, MessageCircleQuestion } from "lucide-react";
import { Card, CardTitle, ItemTagChip, KindTag, PageBody, PriorityBadge, VerdictBadge } from "@/components/ui";
import { TaskWork } from "@/components/item/TaskWork";
import { ClaudeBrief } from "@/components/item/ClaudeBrief";
import { DEFAULT_TAGS, displayKind, statusColor, statusLabel } from "@/lib/items";
import { dueLabel, dueTone, fmt } from "@/lib/date";
import { getItem, items } from "@/mocks/items";
import { getWikiPage } from "@/mocks/wiki";
import { questions } from "@/mocks/questions";
import type { Item } from "@/lib/types";

export function generateStaticParams() {
  return items.map((i) => ({ id: i.id }));
}

export async function generateMetadata(props: PageProps<"/items/[id]">): Promise<Metadata> {
  const { id } = await props.params;
  const it = getItem(id);
  return { title: it ? `${it.title} · newb` : "항목 · newb" };
}

/** 시간/기간 표시: 하루면 "10월 30일 (금) 09:30 – 12:00", 여러 날이면 "10월 31일 (토) – 11월 3일 (화)" */
function whenText(it: Item) {
  if (!it.start) return null;
  const s = it.start;
  const e = it.end ?? it.start;
  const multi = s.slice(0, 10) !== e.slice(0, 10);
  if (multi) {
    return it.allDay
      ? `${fmt(s, "M월 d일 (EEE)")} – ${fmt(e, "M월 d일 (EEE)")}`
      : `${fmt(s, "M월 d일 (EEE) HH:mm")} – ${fmt(e, "M월 d일 (EEE) HH:mm")}`;
  }
  return it.allDay ? `${fmt(s, "M월 d일 (EEE)")} · 종일` : `${fmt(s, "M월 d일 (EEE)")} ${s.slice(11, 16)} – ${e.slice(11, 16)}`;
}

export default async function ItemPage(props: PageProps<"/items/[id]">) {
  const { id } = await props.params;
  const it = getItem(id);
  if (!it) notFound();

  const kind = displayKind(it);
  const isTodo = it.kind === "task";
  const tags = it.tags.map((t) => DEFAULT_TAGS.find((d) => d.id === t)).filter((t) => t !== undefined);
  const related = questions.filter((q) => q.itemId === it.id);
  const wikis = it.wikiRefs.map(getWikiPage).filter((p) => p !== undefined);
  const when = whenText(it);
  const tone = it.due && it.status !== "done" ? dueTone(it.due) : "muted";

  const infoCard = (
    <Card className="p-5">
      <dl className="grid grid-cols-[72px_1fr] gap-y-2.5 text-[13.5px]">
        <dt className="text-muted">유형</dt>
        <dd>
          <KindTag kind={kind} />
        </dd>
        {it.status && (
          <>
            <dt className="text-muted">상태</dt>
            <dd>{statusLabel[it.status]}</dd>
          </>
        )}
        {it.priority && (
          <>
            <dt className="text-muted">우선순위</dt>
            <dd>
              <PriorityBadge p={it.priority} />
            </dd>
          </>
        )}
        <dt className="text-muted">{isTodo ? "작업할 날" : "시간"}</dt>
        <dd className="tabular">
          {when ? (
            <Link href="/calendar" className="hover:underline">
              {when}
            </Link>
          ) : (
            <span className="text-faint">미배치</span>
          )}
        </dd>
        {it.due && (
          <>
            <dt className="text-muted">마감</dt>
            <dd className="tabular">{fmt(it.due, "yyyy. M. d (EEE)")}</dd>
          </>
        )}
        {it.location && (
          <>
            <dt className="text-muted">장소</dt>
            <dd>{it.location}</dd>
          </>
        )}
        {it.from && (
          <>
            <dt className="text-muted">받은 곳</dt>
            <dd>{it.from}</dd>
          </>
        )}
      </dl>
    </Card>
  );

  return (
    <>
      <header className="px-6 pt-7 pb-5 lg:px-10 lg:pt-9">
        <Link href="/" className="mb-3 inline-flex items-center gap-0.5 text-[13px] text-muted hover:text-ink">
          <ChevronLeft className="size-3.5" /> 오늘
        </Link>
        <div className="flex flex-wrap items-center gap-1.5">
          <KindTag kind={kind} />
          {it.priority && <PriorityBadge p={it.priority} />}
          {it.status && (
            <span className="inline-flex h-[20px] items-center gap-1.5 rounded-[5px] border border-line px-1.5 text-[11.5px] font-medium">
              <span className="size-1.5 rounded-full" style={{ background: statusColor[it.status] }} />
              {statusLabel[it.status]}
            </span>
          )}
          {tags.map((t) => (
            <ItemTagChip key={t.id} label={t.label} color={t.color} />
          ))}
        </div>
        <h1 className="mt-2 max-w-3xl text-[24px] leading-snug font-bold tracking-[-0.02em]">{it.title}</h1>
        <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-[13.5px] text-muted">
          {[
            when && <span key="w" className="tabular">{when}</span>,
            it.location && <span key="l">{it.location}</span>,
            it.due && (
              <span key="d">
                마감 {fmt(it.due, "M월 d일 (EEE)")}{" "}
                <span className={clsx("font-semibold", tone === "danger" && "text-danger", tone === "warn" && "text-warn")}>
                  {it.status === "done" ? "완료" : dueLabel(it.due)}
                </span>
              </span>
            ),
          ]
            .filter(Boolean)
            .flatMap((node, i) => (i === 0 ? [node] : [<span key={`sep${i}`} className="text-faint">·</span>, node]))}
        </p>
      </header>

      <PageBody>
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
          <div className="min-w-0 space-y-5">
            {!isTodo && infoCard}
            {it.waitingFor && (
              <div className="flex gap-3 rounded-xl border border-info/25 bg-info-soft px-4 py-3.5">
                <Hourglass className="mt-0.5 size-4.5 shrink-0 text-info" />
                <div>
                  <div className="text-[13px] font-semibold text-info">알아오는 중</div>
                  <div className="mt-0.5 text-[14px]">{it.waitingFor}</div>
                </div>
              </div>
            )}

            {it.description && (
              <Card className="p-5">
                <p className="text-[14.5px] leading-relaxed">{it.description}</p>
              </Card>
            )}

            {isTodo && (
              <TaskWork itemId={it.id} initialSubItems={it.subItems} initialDone={it.status === "done"} />
            )}

            {isTodo && <ClaudeBrief itemId={it.id} brief={it.brief} guidelines={it.wikiRefs} />}

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
          </div>

          <aside className="space-y-5">
            {isTodo && infoCard}

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
