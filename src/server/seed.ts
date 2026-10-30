import "server-only";
import { sql } from "drizzle-orm";
import { DEFAULT_TAGS } from "@/lib/items";
import { items as mockItems } from "@/mocks/items";
import { memos as mockMemos } from "@/mocks/memos";
import { questions as mockQuestions } from "@/mocks/questions";
import { rescheduleProposal } from "@/mocks/reschedule";
import { eveningBriefing, morningBriefing } from "@/mocks/briefing";
import { sources as mockSources, wikiPages as mockPages } from "@/mocks/wiki";
import { seedRevisions } from "@/mocks/wikiRevisions";
import { people as mockPeople, sourceAuthors, wikiInternalNotes } from "@/mocks/wikiInternal";
import * as s from "@/server/db/schema";
import { dtIn } from "@/server/db/convert";
import type { Db } from "@/server/db/types";
import { writeItem } from "@/server/services/items";

/** 시드가 지우고 다시 채우는 테이블 (FK 역순) */
const TABLES = [
  s.wikiComments,
  s.wikiRevisions,
  s.questions,
  s.rescheduleProposals,
  s.briefings,
  s.memos,
  s.itemWikiRefs,
  s.itemTags,
  s.itemSubItems,
  s.items,
  s.tags,
  s.wikiLinks,
  s.wikiPageSources,
  s.wikiPages,
  s.sources,
  s.people,
];

export async function isEmpty(db: Db) {
  const [{ n }] = await db.select({ n: sql<number>`count(*)` }).from(s.wikiPages);
  const [{ m }] = await db.select({ m: sql<number>`count(*)` }).from(s.items);
  return Number(n) === 0 && Number(m) === 0;
}

/**
 * 목데이터로 DB 채우기 (개발·데모용).
 * 비어 있을 때만 넣고, force면 모두 지우고 다시 넣는다. 운영 DB에서는 쓰지 않는다.
 */
export async function seedDemo(db: Db, { force = false } = {}) {
  if (!force && !(await isEmpty(db))) return { seeded: false as const, warnings: [] };
  const warnings: string[] = [];

  await db.transaction(async (tx) => {
    if (force) for (const t of TABLES) await tx.delete(t);

    await tx.insert(s.tags).values(DEFAULT_TAGS.map((t, sort) => ({ ...t, sort })));

    await tx.insert(s.sources).values(
      mockSources.map((x) => ({
        id: x.id,
        title: x.title,
        type: x.type,
        fileType: x.fileType,
        addedOn: x.addedAt,
        author: sourceAuthors[x.id] ?? null,
      })),
    );

    const slugs = new Set(mockPages.map((p) => p.slug));
    await tx.insert(s.wikiPages).values(
      mockPages.map((p) => ({
        slug: p.slug,
        title: p.title,
        category: p.category,
        summary: p.summary,
        body: p.body,
        createdOn: p.createdAt,
        updatedOn: p.updatedAt,
        nextReview: p.review.nextReview,
        intervalDays: p.review.intervalDays,
        reviewCount: p.review.reviewCount,
        issues: p.issues ?? null,
        internalNotes: wikiInternalNotes[p.slug] ?? null,
      })),
    );
    const pageSources = mockPages.flatMap((p) => p.sourceIds.map((sourceId, sort) => ({ slug: p.slug, sourceId, sort })));
    if (pageSources.length) await tx.insert(s.wikiPageSources).values(pageSources);
    const links = mockPages.flatMap((p) => p.links.map((toSlug, sort) => ({ fromSlug: p.slug, toSlug, sort })));
    if (links.length) await tx.insert(s.wikiLinks).values(links);

    const revisions = seedRevisions();
    await tx.insert(s.wikiRevisions).values(
      revisions.map((r) => ({
        id: r.id,
        slug: r.slug,
        version: r.version,
        at: dtIn(r.at)!,
        author: r.author,
        status: r.status,
        message: r.message,
        before: r.before,
        after: r.after,
        conflicts: r.conflicts,
      })),
    );

    const tagIds = new Set(DEFAULT_TAGS.map((t) => t.id));
    for (const it of mockItems) {
      const badRefs = it.wikiRefs.filter((w) => !slugs.has(w));
      if (badRefs.length) warnings.push(`${it.id}: 없는 위키 연결 ${badRefs.join(", ")}`);
      await writeItem(tx, {
        ...it,
        wikiRefs: it.wikiRefs.filter((w) => slugs.has(w)),
        tags: it.tags.filter((t) => tagIds.has(t)),
      });
    }

    await tx.insert(s.memos).values(
      mockMemos.map((m) => ({ id: m.id, text: m.text, at: dtIn(m.createdAt)!, status: m.status, result: m.result ?? null })),
    );

    const itemIds = new Set(mockItems.map((i) => i.id));
    await tx.insert(s.questions).values(
      mockQuestions.map((q) => {
        if (q.itemId && !itemIds.has(q.itemId)) warnings.push(`${q.id}: 없는 항목 연결 ${q.itemId}`);
        return {
          id: q.id,
          askedAt: dtIn(q.askedAt)!,
          question: q.question,
          verdict: q.verdict,
          confidence: q.confidence,
          signals: q.signals,
          rationale: q.rationale,
          answer: q.answer ?? null,
          citations: q.citations,
          missing: q.missing,
          status: q.status,
          itemId: q.itemId && itemIds.has(q.itemId) ? q.itemId : null,
          feedback: q.feedback ?? null,
          modelId: q.modelId,
        };
      }),
    );

    await tx.insert(s.rescheduleProposals).values({
      id: rescheduleProposal.id,
      at: dtIn(rescheduleProposal.createdAt)!,
      summary: rescheduleProposal.summary,
      items: rescheduleProposal.items,
    });

    await tx.insert(s.briefings).values([
      { kind: "morning", date: morningBriefing.date, generatedAt: dtIn(morningBriefing.generatedAt)!, payload: morningBriefing },
      { kind: "evening", date: eveningBriefing.date, generatedAt: dtIn(eveningBriefing.generatedAt)!, payload: eveningBriefing },
    ]);

    await tx.insert(s.people).values(mockPeople);
  });

  return { seeded: true as const, warnings };
}
