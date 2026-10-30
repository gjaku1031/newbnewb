import Link from "next/link";
import clsx from "clsx";
import {
  ArrowRight,
  BookOpenCheck,
  BookPlus,
  CalendarClock,
  Check,
  CircleCheck,
  GraduationCap,
  Hourglass,
  Megaphone,
  MessageCircleQuestion,
  PencilLine,
  Target,
  TrendingUp,
} from "lucide-react";
import { parseISO, isWithinInterval, startOfWeek, endOfWeek } from "date-fns";
import { Card, CardTitle, ItemTagChip, KindTag, PageBody, PageHeader, PriorityBadge, ProgressBar, ProgressRing } from "@/components/ui";
import { ReviewDoneButton } from "@/components/ReviewDoneButton";
import { DEFAULT_TAGS, byPriority, displayKind, progress, startDay } from "@/lib/items";
import { dueLabel, dueTone, fmt, today } from "@/lib/date";
import { items, getItem } from "@/mocks/items";
import { TODAY, NOW } from "@/mocks/today";
import { questions } from "@/mocks/questions";
import { getWikiPage } from "@/mocks/wiki";
import { morningBriefing, eveningBriefing } from "@/mocks/briefing";
import type { Item } from "@/lib/types";

/** 오늘 할 일: 오늘 배치됐거나 마감이 오늘까지인 미완료 할 일 (기다리는 중 제외) */
function todayTasks(): Item[] {
  return items
    .filter(
      (i) =>
        i.kind === "task" &&
        i.status !== "done" &&
        i.status !== "waiting" &&
        (startDay(i) === TODAY || (i.due !== undefined && i.due <= TODAY)),
    )
    .sort(byPriority);
}

function weekStats() {
  const t = today();
  const range = { start: startOfWeek(t, { weekStartsOn: 1 }), end: endOfWeek(t, { weekStartsOn: 1 }) };
  const thisWeek = items.filter((i) => i.kind === "task" && i.due && isWithinInterval(parseISO(i.due), range));
  const avg = Math.round(thisWeek.reduce((s, i) => s + (progress(i) ?? 0), 0) / Math.max(1, thisWeek.length));
  const done = thisWeek.filter((i) => i.status === "done").length;
  return { avg, done, total: thisWeek.length };
}

/** 알아올 것: 열린 질문의 알아올 것 + 기다리는 중인 할 일 (같은 항목에 열린 질문이 있으면 질문 쪽만) */
function toFind() {
  const fromQuestions = questions.flatMap((q) =>
    q.status === "open"
      ? q.missing
          .filter((m) => !m.done)
          .map((m) => ({
            key: `${q.id}-${m.what}`,
            href: `/questions/${q.id}`,
            label: m.kind === "ask_person" ? `${m.target}께 묻기` : `${m.target ?? "문서"}에서 찾기`,
            text: m.what,
            waiting: false,
          }))
      : [],
  );
  const covered = new Set(questions.filter((q) => q.status === "open" && q.itemId).map((q) => q.itemId));
  const fromWaiting = items
    .filter((i) => i.status === "waiting" && i.waitingFor && !covered.has(i.id))
    .map((i) => ({ key: i.id, href: `/items/${i.id}`, label: "기다리는 중", text: `${i.title} — ${i.waitingFor}`, waiting: true }));
  return [...fromQuestions, ...fromWaiting];
}

export default function DashboardPage() {
  const tasks = todayTasks();
  const stats = weekStats();
  const findList = toFind();
  const todaysEvents = items
    .filter((i) => i.kind === "event" && startDay(i) === TODAY && !i.allDay)
    .sort((a, b) => (a.start ?? "").localeCompare(b.start ?? ""));
  const reviews = morningBriefing.reviews.flatMap((r) => {
    const page = getWikiPage(r.slug);
    return page ? [{ ...r, page }] : [];
  });
  const nowHHMM = NOW.slice(11, 16);
  const y = eveningBriefing;

  return (
    <>
      <PageHeader title={fmt(TODAY, "M월 d일 EEEE")} />

      <PageBody>
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
          {/* ── 왼쪽 ── */}
          <div className="space-y-5">
            <Card>
              <CardTitle
                icon={<Target className="size-4" />}
                right={<span className="text-[12.5px] text-muted tabular">{tasks.length}</span>}
              >
                오늘 할 일
              </CardTitle>
              <ol className="divide-y divide-line border-t border-line">
                {tasks.map((it, idx) => {
                  const kind = displayKind(it);
                  const pct = progress(it) ?? 0;
                  const doneSubs = it.subItems.filter((s) => s.done).length;
                  const next = it.subItems.find((s) => !s.done);
                  const tone = it.due ? dueTone(it.due) : "muted";
                  return (
                    <li key={it.id}>
                      <Link
                        href={`/items/${it.id}`}
                        className="group flex items-center gap-4 px-5 py-4 transition-colors hover:bg-sunken/60"
                      >
                        <span className="w-5 shrink-0 text-center text-[13px] font-semibold text-faint tabular">
                          {idx + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {it.priority && <PriorityBadge p={it.priority} />}
                            <KindTag kind={kind} />
                            {it.tags.map((t) => {
                              const tag = DEFAULT_TAGS.find((d) => d.id === t);
                              return tag ? <ItemTagChip key={t} label={tag.label} color={tag.color} /> : null;
                            })}
                          </div>
                          <div className="mt-1.5 truncate text-[15px] font-medium group-hover:text-accent-ink">
                            {it.title}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[12.5px] text-muted">
                            {it.start && startDay(it) === TODAY && !it.allDay && (
                              <span className="tabular">
                                {it.start.slice(11, 16)} – {(it.end ?? it.start).slice(11, 16)}
                              </span>
                            )}
                            {it.due && (
                              <span
                                className={clsx(
                                  "font-medium",
                                  tone === "danger" && "text-danger",
                                  tone === "warn" && "text-warn",
                                )}
                              >
                                마감 {dueLabel(it.due)}
                              </span>
                            )}
                            {it.from && <span>{it.from}</span>}
                            {next && (
                              <span className="truncate">
                                다음 · <span className="text-ink">{next.title}</span>
                              </span>
                            )}
                          </div>
                          {kind === "task" && (
                            <div className="mt-2.5 flex items-center gap-3">
                              <ProgressBar value={pct} className="max-w-[320px]" />
                              <span className="text-[12px] text-muted tabular">
                                {doneSubs}/{it.subItems.length}
                              </span>
                            </div>
                          )}
                        </div>
                        {kind === "task" ? (
                          <ProgressRing value={pct} size={48} />
                        ) : (
                          <span className="grid size-[48px] shrink-0 place-items-center rounded-full border-2 border-line-strong text-faint transition-colors group-hover:border-ok group-hover:text-ok">
                            <Check className="size-5" strokeWidth={2.4} />
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ol>
            </Card>

            <Card>
              <CardTitle
                icon={<CalendarClock className="size-4" />}
                right={
                  <Link href="/tasks" className="flex items-center gap-1 text-[13px] text-muted hover:text-ink">
                    작업 <ArrowRight className="size-3.5" />
                  </Link>
                }
              >
                오늘 일정
              </CardTitle>
              <ul className="space-y-1.5 px-5 pb-5">
                {todaysEvents.length === 0 && <li className="text-[13px] text-muted">없음</li>}
                {todaysEvents.map((e) => {
                  const start = (e.start ?? "").slice(11, 16);
                  const end = (e.end ?? e.start ?? "").slice(11, 16);
                  const isNow = start <= nowHHMM && nowHHMM < end;
                  const isPast = end <= nowHHMM;
                  return (
                    <li key={e.id}>
                      <Link
                        href={`/items/${e.id}`}
                        style={{ "--tone": "var(--kind-event)" } as React.CSSProperties}
                        className={clsx(
                          "tone-bar flex items-center gap-4 rounded-r-lg px-3.5 py-2.5 hover:brightness-[0.98]",
                          isPast && "opacity-55",
                        )}
                      >
                        <span className="w-[92px] shrink-0 text-[12.5px] text-muted tabular">
                          {start} – {end}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{e.title}</span>
                        {e.location && <span className="hidden text-[12.5px] text-muted md:inline">{e.location}</span>}
                        {isNow && (
                          <span className="rounded-full bg-accent px-2 py-0.5 text-[11px] font-semibold text-white">
                            지금
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </Card>

            {/* 어제 정리 = 전날 저녁 브리핑 */}
            <Card>
              <CardTitle icon={<PencilLine className="size-4" />}>
                어제 정리{" "}
                <span className="ml-1 text-[12.5px] font-normal text-muted">{fmt(y.date, "M월 d일 (EEE)")}</span>
              </CardTitle>
              <div className="grid gap-6 border-t border-line px-5 py-5 md:grid-cols-2">
                <section className="space-y-5">
                  <div>
                    <SubLabel icon={<CircleCheck className="size-3.5" />}>완료한 일</SubLabel>
                    <ul className="space-y-1.5">
                      {y.done.map((id) => {
                        const it = getItem(id);
                        if (!it) return null;
                        return (
                          <li key={id} className="flex items-center gap-2 text-[14px]">
                            <CircleCheck className="size-4 shrink-0 text-ok" />
                            <Link href={`/items/${id}`} className="truncate hover:text-accent-ink">
                              {it.title}
                            </Link>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                  <div>
                    <SubLabel icon={<TrendingUp className="size-3.5" />}>진척</SubLabel>
                    <ul className="space-y-3">
                      {y.progressed.map((p) => {
                        const it = getItem(p.itemId);
                        if (!it) return null;
                        return (
                          <li key={p.itemId}>
                            <Link href={`/items/${p.itemId}`} className="block truncate text-[14px] hover:text-accent-ink">
                              {it.title}
                            </Link>
                            <div className="mt-1.5 flex items-center gap-3">
                              <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
                                <div className="absolute inset-y-0 left-0 rounded-full bg-accent" style={{ width: `${p.to}%` }} />
                                <div
                                  className="absolute inset-y-0 left-0 rounded-full bg-line-strong"
                                  style={{ width: `${p.from}%` }}
                                />
                              </div>
                              <span className="flex items-center gap-1 text-[12.5px] text-muted tabular">
                                {p.from}% <ArrowRight className="size-3" />
                                <span className="font-semibold text-accent-ink">{p.to}%</span>
                              </span>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </section>
                <section className="space-y-5">
                  <div>
                    <SubLabel icon={<GraduationCap className="size-3.5" />}>배운 것</SubLabel>
                    <ul className="space-y-1.5">
                      {y.learned.map((l, i) => (
                        <li key={i} className="flex gap-2.5 text-[14px] leading-relaxed">
                          <span className="mt-[9px] size-1.5 shrink-0 rounded-full bg-accent" />
                          {l}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <SubLabel icon={<BookPlus className="size-3.5" />}>위키</SubLabel>
                    <div className="flex flex-wrap gap-1.5">
                      {y.wikiAdded.map((slug) => {
                        const w = getWikiPage(slug);
                        return w ? (
                          <Link
                            key={slug}
                            href={`/wiki/${slug}`}
                            className="inline-flex items-center rounded-md bg-ok-soft px-2 py-1 text-[12.5px] text-ok hover:brightness-95"
                          >
                            + {w.title}
                          </Link>
                        ) : null;
                      })}
                      {y.wikiUpdated.map((slug) => {
                        const w = getWikiPage(slug);
                        return w ? (
                          <Link
                            key={slug}
                            href={`/wiki/${slug}`}
                            className="inline-flex items-center rounded-md bg-sunken px-2 py-1 text-[12.5px] text-muted hover:text-ink"
                          >
                            ↻ {w.title}
                          </Link>
                        ) : null;
                      })}
                    </div>
                  </div>
                </section>
              </div>
            </Card>
          </div>

          {/* ── 오른쪽 ── */}
          <div className="space-y-5">
            <Card className="p-5">
              <div className="text-[13px] text-muted">이번 주 성취율</div>
              <div className="mt-3 flex items-center gap-4">
                <ProgressRing value={stats.avg} size={72} stroke={6} />
                <div className="text-[22px] font-bold tabular">
                  {stats.done}
                  <span className="text-[15px] font-medium text-muted"> / {stats.total} 완료</span>
                </div>
              </div>
            </Card>

            <Card>
              <CardTitle icon={<Megaphone className="size-4" />}>미리 알아두기</CardTitle>
              <ul className="space-y-2.5 px-5 pb-5">
                {morningBriefing.heads_up.map((h, i) => (
                  <li key={i} className="flex gap-2.5 text-[13.5px] leading-relaxed">
                    <span className="mt-[8px] size-1.5 shrink-0 rounded-full bg-accent" />
                    {h}
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardTitle
                icon={<MessageCircleQuestion className="size-4" />}
                right={<span className="text-[12px] font-semibold text-info">{findList.length}</span>}
              >
                알아올 것
              </CardTitle>
              <ul className="space-y-2 px-5 pb-5">
                {findList.map((f) => (
                  <li key={f.key}>
                    <Link href={f.href} className="block rounded-lg bg-info-soft/60 px-3.5 py-3 hover:bg-info-soft">
                      <div className="flex items-center gap-1.5 text-[12px] font-semibold text-info">
                        {f.waiting && <Hourglass className="size-3.5" />}
                        {f.label}
                      </div>
                      <div className="mt-0.5 text-[13.5px] leading-snug">{f.text}</div>
                    </Link>
                  </li>
                ))}
              </ul>
            </Card>

            <Card>
              <CardTitle icon={<BookOpenCheck className="size-4" />}>오늘 복습할 위키</CardTitle>
              <ul className="space-y-1 px-3 pb-4">
                {reviews.map((r) => (
                  <li key={r.slug} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-sunken">
                    <Link href={`/wiki/${r.slug}`} className="min-w-0 flex-1 py-0.5">
                      <div className="truncate text-[13.5px] font-medium">{r.page.title}</div>
                      <div className="truncate text-[12px] text-muted">
                        {r.page.review.intervalDays}일마다 · {r.reason}
                      </div>
                    </Link>
                    <ReviewDoneButton intervalDays={r.page.review.intervalDays} size="sm" />
                  </li>
                ))}
              </ul>
            </Card>
          </div>
        </div>
      </PageBody>
    </>
  );
}

function SubLabel({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
      {icon}
      {children}
    </div>
  );
}
