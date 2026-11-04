import "server-only";
import { addDays, format, getDay, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { and, asc, between, desc, eq, gte, lt, lte } from "drizzle-orm";
import type { EveningBriefing, MorningBriefing } from "@/lib/types";
import { progress } from "@/lib/items";
import { seoulNow, seoulToday } from "@/lib/today";
import { briefings, cautions, items, memos, questions, rescheduleProposals, scheduledRuns, userSettings, wikiPages } from "@/server/db/schema";
import { dtIn } from "@/server/db/convert";
import type { Db, Exec } from "@/server/db/types";
import { newId } from "@/server/ids";
import { defaultBriefingWriter, type BriefingInput, type BriefingWriter } from "@/server/ai/briefing";
import { ClaudeUnavailableError } from "@/server/ai/claude";
import { listItems } from "./items";

/**
 * 아침 브리핑·지난 정리·재배치 제안 만들기.
 * 설정한 요일·시각이 되면 예약 작업이 하루 한 번 만들고(scheduler.ts), 대시보드에서 바로 만들 수도 있다.
 */

export interface DashboardSettings {
  morningTime: string;
  /** 0=일 … 6=토 */
  days: number[];
}

export const DEFAULT_SETTINGS: DashboardSettings = { morningTime: "08:00", days: [1, 2, 3, 4, 5] };

export async function getSettings(db: Exec): Promise<DashboardSettings> {
  const [row] = await db.select().from(userSettings).where(eq(userSettings.id, 1));
  return row ? { morningTime: row.morningTime, days: row.days } : DEFAULT_SETTINGS;
}

export async function saveSettings(db: Exec, s: DashboardSettings) {
  const days = [...new Set(s.days)].filter((d) => Number.isInteger(d) && d >= 0 && d <= 6).sort();
  await db
    .insert(userSettings)
    .values({ id: 1, morningTime: s.morningTime, days })
    .onDuplicateKeyUpdate({ set: { morningTime: s.morningTime, days } });
}

const day = (d: string, n: number) => format(addDays(parseISO(d), n), "yyyy-MM-dd");
/** 한국 시간 그날 0시를 DB 기록 시각(UTC) 문자열로 */
const kstStartUtc = (d: string) => new Date(`${d}T00:00:00+09:00`).toISOString().replace("T", " ").replace("Z", "");

/** 지난 정리가 다룰 기간: 마지막 브리핑 다음 날 ~ 어제 (최대 7일) */
async function periodSinceLast(db: Exec, today: string) {
  const until = day(today, -1);
  const [last] = await db
    .select({ date: briefings.date })
    .from(briefings)
    .where(and(eq(briefings.kind, "morning"), lt(briefings.date, today)))
    .orderBy(desc(briefings.date))
    .limit(1);
  const earliest = day(today, -7);
  const since = last ? day(last.date, 1) : until;
  return { since: since < earliest ? earliest : since > until ? until : since, until };
}

async function collect(db: Exec, today: string): Promise<BriefingInput> {
  const { since, until } = await periodSinceLast(db, today);
  const all = await listItems(db);
  const openItems = all
    .filter((i) => i.status !== "done" && (i.kind === "task" || (i.start ?? "") >= today))
    .slice(0, 80)
    .map((i) => ({
      id: i.id,
      title: i.title,
      kind: i.kind,
      start: i.start,
      end: i.end,
      due: i.due,
      priority: i.priority,
      status: i.status,
      progress: progress(i),
      from: i.from,
      waitingFor: i.waitingFor,
      nextSubItem: i.subItems.find((s) => !s.done)?.title,
    }));
  const doneItems = await db
    .select({ id: items.id, title: items.title })
    .from(items)
    .where(and(eq(items.status, "done"), gte(items.updatedAt, kstStartUtc(since)), lt(items.updatedAt, kstStartUtc(today))));
  const pages = await db
    .select({ slug: wikiPages.slug, title: wikiPages.title, createdOn: wikiPages.createdOn, updatedOn: wikiPages.updatedOn, nextReview: wikiPages.nextReview, intervalDays: wikiPages.intervalDays })
    .from(wikiPages);
  const inPeriod = (d: string) => d >= since && d <= until;
  const cautionRows = await db
    .select({ point: cautions.point, by: cautions.byRole })
    .from(cautions)
    .where(between(cautions.createdOn, since, until));
  const memoRows = await db
    .select({ text: memos.text, result: memos.result })
    .from(memos)
    .where(and(gte(memos.at, `${since} 00:00:00`), lt(memos.at, `${today} 00:00:00`)))
    .orderBy(asc(memos.at))
    .limit(30);
  const openQuestions = await db
    .select({ id: questions.id, question: questions.question })
    .from(questions)
    .where(eq(questions.status, "open"))
    .orderBy(desc(questions.askedAt))
    .limit(10);
  return {
    today,
    weekday: format(parseISO(today), "EEEE", { locale: ko }),
    since,
    until,
    openItems,
    doneItems,
    wikiAdded: pages.filter((p) => inPeriod(p.createdOn)).map(({ slug, title }) => ({ slug, title })),
    wikiUpdated: pages.filter((p) => inPeriod(p.updatedOn) && !inPeriod(p.createdOn)).map(({ slug, title }) => ({ slug, title })),
    cautions: cautionRows.map((c) => ({ point: c.point, by: c.by ?? undefined })),
    memos: memoRows.map((m) => m.result?.cleaned ?? m.text).map((t) => t.slice(0, 300)),
    dueReviews: pages
      .filter((p) => p.nextReview <= today)
      .sort((a, b) => a.nextReview.localeCompare(b.nextReview) || a.intervalDays - b.intervalDays)
      .slice(0, 15)
      .map(({ slug, title, intervalDays, nextReview }) => ({ slug, title, intervalDays, nextReview })),
    openQuestions,
  };
}

/** 오늘 브리핑을 만든다 (이미 있으면 새로 덮어씀). 재배치가 필요하면 제안도 만든다 */
export async function generateBriefing(db: Db, writer: BriefingWriter = defaultBriefingWriter()) {
  const today = seoulToday();
  const now = seoulNow();
  const input = await collect(db, today);
  const plan = await writer.write(input);

  const morning: MorningBriefing = {
    date: today,
    generatedAt: now,
    greeting: plan.greeting,
    focus: plan.focus,
    reviews: plan.reviews,
    heads_up: plan.headsUp,
  };
  const evening: EveningBriefing = {
    date: input.until,
    generatedAt: now,
    done: input.doneItems.map((d) => d.id),
    progressed: [],
    wikiAdded: input.wikiAdded.map((w) => w.slug),
    wikiUpdated: input.wikiUpdated.map((w) => w.slug),
    learned: plan.learned,
    pendingInfo: input.openQuestions.map((q) => ({ questionId: q.id, what: q.question })),
    tomorrow: plan.focus,
    note: plan.note,
  };
  const byId = new Map(input.openItems.map((i) => [i.id, i]));
  await db.transaction(async (tx) => {
    for (const [kind, date, payload] of [
      ["morning", today, morning],
      ["evening", input.until, evening],
    ] as const) {
      await tx
        .insert(briefings)
        .values({ kind, date, generatedAt: dtIn(now)!, payload })
        .onDuplicateKeyUpdate({ set: { generatedAt: dtIn(now)!, payload } });
    }
    if (plan.reschedule) {
      await tx.insert(rescheduleProposals).values({
        id: newId("r"),
        at: dtIn(now)!,
        summary: plan.reschedule.summary,
        items: plan.reschedule.items.map((c) => {
          const it = byId.get(c.itemId)!;
          return {
            itemId: c.itemId,
            fromDate: it.start?.slice(0, 10) ?? it.due,
            toDate: c.toDate,
            fromPriority: it.priority ?? c.toPriority,
            toPriority: c.toPriority,
            reason: c.reason,
          };
        }),
      });
    }
  });
  return { morning, evening, rescheduled: !!plan.reschedule };
}

/* ───────── 예약 작업 ───────── */

/** 지금이 설정한 요일·시각 이후이고 오늘 아직 안 만들었으면 만든다 (여러 서버·요청이 겹쳐도 한 번) */
export async function runScheduledBriefing(db: Db, writer?: BriefingWriter, now = seoulNow()) {
  const today = now.slice(0, 10);
  const settings = await getSettings(db);
  if (!settings.days.includes(getDay(parseISO(today)))) return "not-today" as const;
  if (now.slice(11, 16) < settings.morningTime) return "too-early" as const;

  // (작업, 날짜)를 먼저 넣은 쪽만 실행
  const [claimed] = await db
    .insert(scheduledRuns)
    .ignore()
    .values({ job: "briefing", runDate: today });
  if (claimed.affectedRows !== 1) return "already" as const;

  try {
    await generateBriefing(db, writer);
    await db
      .update(scheduledRuns)
      .set({ finishedAt: dtIn(now) })
      .where(and(eq(scheduledRuns.job, "briefing"), eq(scheduledRuns.runDate, today)));
    return "done" as const;
  } catch (error) {
    const message = error instanceof ClaudeUnavailableError ? error.message : error instanceof Error ? error.message : String(error);
    console.error("[briefing] 예약 브리핑 실패", message);
    await db
      .update(scheduledRuns)
      .set({ error: message.slice(0, 500) })
      .where(and(eq(scheduledRuns.job, "briefing"), eq(scheduledRuns.runDate, today)));
    return "failed" as const;
  }
}

/** 오래된 실행 기록 정리 (30일) */
export async function pruneScheduledRuns(db: Exec) {
  await db.delete(scheduledRuns).where(lte(scheduledRuns.runDate, day(seoulToday(), -30)));
}
