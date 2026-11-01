import "server-only";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { desc, eq } from "drizzle-orm";
import type { EveningBriefing, Item, MorningBriefing, QuestionRecord, RescheduleProposal } from "@/lib/types";
import { seoulNow } from "@/lib/today";
import { briefings, questions, rescheduleProposals } from "@/server/db/schema";
import { dtIn, dtOut, opt } from "@/server/db/convert";
import type { Db, Exec } from "@/server/db/types";
import { getItem, writeItem } from "./items";

/* ───────── 질문 기록 ───────── */

function toQuestion(q: typeof questions.$inferSelect): QuestionRecord {
  return {
    id: q.id,
    askedAt: dtOut(q.askedAt)!,
    question: q.question,
    verdict: q.verdict,
    confidence: q.confidence,
    rationale: q.rationale,
    answer: opt(q.answer),
    citations: q.citations,
    missing: q.missing,
    status: q.status,
    itemId: opt(q.itemId),
    feedback: opt(q.feedback),
    modelId: q.modelId,
  };
}

export async function listQuestions(db: Exec): Promise<QuestionRecord[]> {
  const rows = await db.select().from(questions).orderBy(desc(questions.askedAt));
  return rows.map(toQuestion);
}

export async function getQuestion(db: Exec, id: string, lock = false) {
  const query = db.select().from(questions).where(eq(questions.id, id));
  const [q] = lock ? await query.for("update") : await query;
  return q ? toQuestion(q) : undefined;
}

export async function setQuestionFeedback(db: Exec, id: string, feedback: "up" | "down" | null) {
  await db.update(questions).set({ feedback }).where(eq(questions.id, id));
}

/** 알아온 답 기록 → 그 항목은 완료. 알아올 것이 모두 끝나면 질문도 해결됨 */
export async function answerMissing(db: Db, id: string, index: number, answer: string) {
  return db.transaction(async (tx) => {
    // 행을 잠가 다른 기기에서 동시에 적은 답이 서로 덮어쓰지 않게
    const q = await getQuestion(tx, id, true);
    if (!q || !q.missing[index]) return undefined;
    const missing = q.missing.map((m, i) => (i === index ? { ...m, done: true, answer: answer.trim() } : m));
    const status = missing.every((m) => m.done) ? "resolved" : q.status;
    await tx.update(questions).set({ missing, status }).where(eq(questions.id, id));
    return { ...q, missing, status };
  });
}

/* ───────── 재배치 제안 ───────── */

export async function latestReschedule(db: Exec): Promise<RescheduleProposal | null> {
  const [p] = await db.select().from(rescheduleProposals).orderBy(desc(rescheduleProposals.at)).limit(1);
  return p ? { id: p.id, createdAt: dtOut(p.at)!, summary: p.summary, items: p.items, appliedAt: dtOut(p.appliedAt) } : null;
}

/** 날짜를 옮기면 시작·끝을 같은 만큼 민다. 날짜가 없던 할 일은 그날 하루로 놓는다 */
function moveTo(item: Item, from: string | undefined, to: string): Item {
  if (!item.start) return { ...item, start: `${to}T00:00`, end: `${to}T23:59`, allDay: true };
  const base = from ?? item.start.slice(0, 10);
  const diff = differenceInCalendarDays(parseISO(to), parseISO(base));
  const shift = (v?: string) => (v ? `${format(addDays(parseISO(v.slice(0, 10)), diff), "yyyy-MM-dd")}${v.slice(10)}` : v);
  return { ...item, start: shift(item.start), end: shift(item.end) };
}

/** 수락한 변경만 항목에 반영 (한 번만) */
export async function applyReschedule(db: Db, id: string, acceptedItemIds: string[]) {
  return db.transaction(async (tx) => {
    // 행을 잠가 두 탭에서 동시에 눌러도 날짜가 두 번 밀리지 않게
    const [p] = await tx.select().from(rescheduleProposals).where(eq(rescheduleProposals.id, id)).for("update");
    if (!p || p.appliedAt) return 0;
    const accepted = new Set(acceptedItemIds);
    let count = 0;
    for (const change of p.items) {
      if (!accepted.has(change.itemId)) continue;
      const item = await getItem(tx, change.itemId);
      if (!item) continue;
      await writeItem(tx, { ...moveTo(item, change.fromDate, change.toDate), priority: change.toPriority });
      count++;
    }
    await tx
      .update(rescheduleProposals)
      .set({
        appliedAt: dtIn(seoulNow()),
        items: p.items.map((c) => ({ ...c, accepted: accepted.has(c.itemId) })),
      })
      .where(eq(rescheduleProposals.id, id));
    return count;
  });
}

/* ───────── 브리핑 ───────── */

export async function latestBriefings(db: Exec) {
  const latest = async (kind: "morning" | "evening") => {
    const [b] = await db.select().from(briefings).where(eq(briefings.kind, kind)).orderBy(desc(briefings.date)).limit(1);
    return b?.payload ?? null;
  };
  const [morning, evening] = await Promise.all([latest("morning"), latest("evening")]);
  return { morning: morning as MorningBriefing | null, evening: evening as EveningBriefing | null };
}
