import "server-only";
import { addDays, format, parseISO } from "date-fns";
import { asc, desc, eq } from "drizzle-orm";
import type { Caution } from "@/lib/types";
import { nextInterval } from "@/lib/review";
import { seoulToday } from "@/lib/today";
import { cautions, cautionTags, cautionWiki, tags, wikiPages } from "@/server/db/schema";
import { existing } from "@/server/db/existing";
import { dOut, opt } from "@/server/db/convert";
import type { Db, Exec } from "@/server/db/types";
import { newId } from "@/server/ids";

/* ───────── 조회 ───────── */

export async function listCautions(db: Exec): Promise<Caution[]> {
  const [rows, wiki, tagRows] = await Promise.all([
    db.select().from(cautions).orderBy(desc(cautions.createdOn), desc(cautions.createdAt)),
    db.select().from(cautionWiki).orderBy(asc(cautionWiki.sort)),
    db.select().from(cautionTags).orderBy(asc(cautionTags.sort)),
  ]);
  return rows.map((c) => ({
    id: c.id,
    point: c.point,
    wrong: opt(c.wrong),
    by: opt(c.byRole),
    source: c.sourceId ? { kind: c.sourceKind, id: c.sourceId } : { kind: c.sourceKind },
    wikiRefs: wiki.filter((w) => w.cautionId === c.id).map((w) => w.slug),
    tags: tagRows.filter((t) => t.cautionId === c.id).map((t) => t.tagId),
    createdAt: dOut(c.createdOn)!,
    review: { nextReview: dOut(c.nextReview)!, intervalDays: c.intervalDays },
    archived: c.archived || undefined,
  }));
}

export async function getCaution(db: Exec, id: string) {
  return (await listCautions(db)).find((c) => c.id === id);
}

/* ───────── 저장 ───────── */

/** 주의할 점 하나를 통째로 저장 (위키·태그 연결은 갈아끼움, 없는 위키·태그는 건너뜀) */
export async function writeCaution(tx: Exec, c: Caution) {
  const row = {
    id: c.id,
    point: c.point,
    wrong: c.wrong ?? null,
    byRole: c.by ?? null,
    sourceKind: c.source.kind,
    sourceId: c.source.id ?? null,
    createdOn: c.createdAt,
    nextReview: c.review.nextReview,
    intervalDays: c.review.intervalDays,
    archived: c.archived ?? false,
  };
  const { id: _id, createdOn: _created, sourceKind: _sk, sourceId: _sid, ...update } = row;
  void _id;
  void _created;
  void _sk;
  void _sid;
  await tx.insert(cautions).values(row).onDuplicateKeyUpdate({ set: update });

  await tx.delete(cautionWiki).where(eq(cautionWiki.cautionId, c.id));
  await tx.delete(cautionTags).where(eq(cautionTags.cautionId, c.id));
  const refs = await existing(tx, wikiPages, wikiPages.slug, c.wikiRefs);
  const tagList = await existing(tx, tags, tags.id, c.tags);
  if (refs.length) await tx.insert(cautionWiki).values(refs.map((slug, sort) => ({ cautionId: c.id, slug, sort })));
  if (tagList.length) await tx.insert(cautionTags).values(tagList.map((tagId, sort) => ({ cautionId: c.id, tagId, sort })));
}

export async function saveCaution(db: Db, c: Caution) {
  await db.transaction((tx) => writeCaution(tx, c));
}

/** 새 주의할 점 — 내일 한 번 더 보여준다 */
export function newCaution(input: Omit<Caution, "id" | "createdAt" | "review">, id = newId("c")): Caution {
  const today = seoulToday();
  return {
    ...input,
    id,
    createdAt: today,
    review: { nextReview: format(addDays(parseISO(today), 1), "yyyy-MM-dd"), intervalDays: 1 },
  };
}

export async function deleteCaution(db: Exec, id: string) {
  await db.delete(cautions).where(eq(cautions.id, id));
}

/** 다시 봤어요 → 다음에 보여줄 날을 뒤로 (간격 2배, 최대 60일) */
export async function reviewCaution(db: Exec, id: string) {
  const [c] = await db.select({ intervalDays: cautions.intervalDays }).from(cautions).where(eq(cautions.id, id));
  if (!c) return undefined;
  const intervalDays = nextInterval(c.intervalDays);
  const review = { intervalDays, nextReview: format(addDays(parseISO(seoulToday()), intervalDays), "yyyy-MM-dd") };
  await db.update(cautions).set(review).where(eq(cautions.id, id));
  return review;
}

/** 익혔어요 / 다시 알리기 */
export async function setCautionArchived(db: Exec, id: string, archived: boolean) {
  await db.update(cautions).set({ archived }).where(eq(cautions.id, id));
}
