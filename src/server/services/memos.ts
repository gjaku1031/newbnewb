import "server-only";
import { and, desc, eq, inArray, lt, sql } from "drizzle-orm";
import type { Item } from "@/lib/types";
import type { Memo, MemoAction } from "@/lib/memoTypes";
import { fmt } from "@/lib/date";
import { memoProcessor, type MemoPlan, type MemoProcessor } from "@/lib/memoProcessor";
import { seoulNow, seoulToday } from "@/lib/today";
import { memos, tags, wikiPages } from "@/server/db/schema";
import { dtIn, dtOut, opt } from "@/server/db/convert";
import type { Db, Exec } from "@/server/db/types";
import { newId } from "@/server/ids";
import { writeItem } from "./items";
import { pageContent, runReview, submitRevisionTx } from "./wiki";

export async function listMemos(db: Exec): Promise<Memo[]> {
  const rows = await db.select().from(memos).orderBy(desc(memos.at), desc(memos.createdAt));
  return rows.map((m) => ({ id: m.id, text: m.text, createdAt: dtOut(m.at)!, status: m.status, result: opt(m.result) }));
}

/** 메모 저장 (처리는 processMemo로 따로) */
export async function addMemo(db: Exec, memo: { id: string; text: string }) {
  await db.insert(memos).values({ id: memo.id, text: memo.text, at: dtIn(seoulNow())!, status: "processing" });
}

export async function deleteMemo(db: Exec, id: string) {
  await db.delete(memos).where(eq(memos.id, id));
}

const day = (d: string) => fmt(d, "M/d (EEE)");

/**
 * 메모 처리: 처리기(지금은 규칙, 나중엔 Claude)가 만든 계획을 항목·위키에 반영하고 한 일을 기록.
 * 위키 갱신은 변경 요청으로 만들고, 커밋 뒤 검토를 돌린다.
 */
export async function processMemo(db: Db, id: string, processor: MemoProcessor = memoProcessor) {
  const [memo] = await db.select().from(memos).where(eq(memos.id, id));
  if (!memo || memo.status !== "processing") return;
  const today = seoulToday();
  const plan = await processor.process(memo.text, today);

  const revisionIds = await db.transaction(async (tx) => {
    const { actions, revisionIds } = await applyPlan(tx, plan, today);
    await tx
      .update(memos)
      .set({ status: "done", result: { cleaned: plan.cleaned, actions } })
      .where(and(eq(memos.id, id), eq(memos.status, "processing")));
    return revisionIds;
  });
  for (const rid of revisionIds) await runReview(db, rid);
}

async function applyPlan(tx: Exec, plan: MemoPlan, today: string) {
  const actions: MemoAction[] = [];
  const revisionIds: string[] = [];
  const tagIds = new Set((await tx.select({ id: tags.id }).from(tags)).map((t) => t.id));
  const base = { subItems: [], wikiRefs: [], createdAt: today } satisfies Partial<Item>;

  for (const e of plan.events) {
    const start = e.time ? `${e.date}T${e.time}` : `${e.date}T00:00`;
    const [h, m] = (e.time ?? "00:00").split(":").map(Number);
    const end = e.time
      ? `${e.date}T${String(Math.min(23, h + 1)).padStart(2, "0")}:${String(m).padStart(2, "0")}`
      : `${e.date}T23:59`;
    const item: Item = {
      ...base,
      id: newId("i"),
      title: e.title,
      kind: "event",
      start,
      end,
      allDay: !e.time || undefined,
      tags: tagIds.has("meeting") ? ["meeting"] : [],
      location: e.location,
      from: e.from,
    };
    await writeItem(tx, item);
    actions.push({
      kind: "create_event",
      label: `일정 추가 · ${day(e.date)}${e.time ? ` ${e.time}` : ""} ${e.title}${e.location ? ` · ${e.location}` : ""}`,
      href: `/items/${item.id}`,
    });
  }

  for (const t of plan.tasks) {
    const item: Item = {
      ...base,
      id: newId("i"),
      title: t.title,
      kind: "task",
      due: t.due,
      priority: "P2",
      status: t.waitingFor ? "waiting" : "todo",
      waitingFor: t.waitingFor,
      tags: [],
      from: t.from,
    };
    await writeItem(tx, item);
    actions.push({ kind: "create_task", label: `할 일 추가 · ${t.title} (마감 ${day(t.due)})`, href: `/items/${item.id}` });
    if (t.waitingFor) actions.push({ kind: "ask", label: `알아올 것 · ${t.waitingFor}`, href: `/items/${item.id}` });
  }

  // 할 일에 붙지 않은 알아올 것 → 확인용 할 일로
  for (const a of plan.asks) {
    const item: Item = {
      ...base,
      id: newId("i"),
      title: `확인: ${a}`,
      kind: "task",
      due: today,
      priority: "P2",
      status: "waiting",
      waitingFor: a,
      tags: [],
      from: "메모",
    };
    await writeItem(tx, item);
    actions.push({ kind: "ask", label: `알아올 것 · ${a}`, href: `/items/${item.id}` });
  }

  const slugs = plan.wiki.map((w) => w.slug);
  const titles = new Map(
    slugs.length
      ? (await tx.select({ slug: wikiPages.slug, title: wikiPages.title }).from(wikiPages).where(inArray(wikiPages.slug, slugs))).map(
          (p) => [p.slug, p.title],
        )
      : [],
  );
  for (const w of plan.wiki) {
    if (!titles.has(w.slug)) continue;
    const cur = (await pageContent(tx, w.slug))!;
    const heading = "## 메모에서 추가";
    const body = cur.body.includes(heading) ? `${cur.body}\n- ${w.line}` : `${cur.body}\n\n${heading}\n- ${w.line}`;
    const rev = await submitRevisionTx(tx, { slug: w.slug, after: { ...cur, body }, message: "메모 내용 반영", author: "claude" });
    revisionIds.push(rev.id);
    actions.push({ kind: "update_wiki", label: `위키 갱신 · ${titles.get(w.slug)}`, href: `/wiki/${w.slug}`, revisionId: rev.id });
  }
  return { actions, revisionIds };
}

/** 끊긴 메모 처리 다시 돌리기 */
export async function resumeStalledMemos(db: Db, olderThanMs = 30_000) {
  const cutoff = sql`NOW(3) - INTERVAL ${olderThanMs * 1000} MICROSECOND`;
  const stalled = await db
    .select({ id: memos.id })
    .from(memos)
    .where(and(eq(memos.status, "processing"), lt(memos.updatedAt, cutoff)));
  for (const { id } of stalled) await processMemo(db, id);
  return stalled.length;
}
