import "server-only";
import { addDays, parseISO, format } from "date-fns";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import type { Source, SourceType, WikiPage, WikiReview } from "@/lib/types";
import type { EditNote, PageContent, Revision, WikiComment } from "@/lib/wikiTypes";
import type { WikiData } from "@/lib/workspace";
import { nextInterval } from "@/lib/review";
import { seoulNow, seoulToday } from "@/lib/today";
import { wikiReviewer, type WikiReviewer } from "@/lib/wikiReview";
import { wikiEditor, type WikiEditor } from "@/lib/wikiEditor";
import { sources, wikiComments, wikiLinks, wikiPages, wikiPageSources, wikiRevisions } from "@/server/db/schema";
import { dOut, dtIn, dtOut, opt } from "@/server/db/convert";
import type { Db, Exec } from "@/server/db/types";

/* ───────── 조회 ───────── */

export async function listWiki(db: Exec): Promise<WikiData> {
  const [pageRows, srcLinks, links, sourceRows, revRows, commentRows] = await Promise.all([
    db.select().from(wikiPages).orderBy(asc(wikiPages.createdOn), asc(wikiPages.slug)),
    db.select().from(wikiPageSources).orderBy(asc(wikiPageSources.sort)),
    db.select().from(wikiLinks).orderBy(asc(wikiLinks.sort)),
    db.select().from(sources).orderBy(asc(sources.addedOn), asc(sources.createdAt)),
    db.select().from(wikiRevisions).orderBy(asc(wikiRevisions.slug), asc(wikiRevisions.version)),
    db.select().from(wikiComments).orderBy(asc(wikiComments.at)),
  ]);

  const pages: WikiPage[] = pageRows.map((p) => ({
    slug: p.slug,
    title: p.title,
    category: p.category,
    summary: p.summary,
    body: p.body,
    sourceIds: srcLinks.filter((s) => s.slug === p.slug).map((s) => s.sourceId),
    links: links.filter((l) => l.fromSlug === p.slug).map((l) => l.toSlug),
    updatedAt: dOut(p.updatedOn)!,
    createdAt: dOut(p.createdOn)!,
    review: { nextReview: dOut(p.nextReview)!, intervalDays: p.intervalDays, reviewCount: p.reviewCount },
    issues: p.issues?.length ? p.issues : undefined,
  }));

  // 자료 제공자(author)는 서버 전용이라 빼고 보낸다
  const srcs = sourceRows.map(
    (s): Source & { hasFile: boolean } => ({
      id: s.id,
      title: s.title,
      type: s.type as SourceType,
      fileType: s.fileType as Source["fileType"],
      addedAt: dOut(s.addedOn)!,
      hasFile: !!s.objectKey,
    }),
  );

  return { pages, sources: srcs, revisions: revRows.map(toRevision), comments: commentRows.map(toComment) };
}

function toRevision(r: typeof wikiRevisions.$inferSelect): Revision {
  return {
    id: r.id,
    slug: r.slug,
    version: r.version,
    at: dtOut(r.at)!,
    author: r.author,
    status: r.status,
    message: r.message,
    before: r.before,
    after: r.after,
    conflicts: r.conflicts,
    commentIds: opt(r.commentIds),
    edits: opt(r.edits),
  };
}

function toComment(c: typeof wikiComments.$inferSelect): WikiComment {
  return {
    id: c.id,
    slug: c.slug,
    anchor: c.anchor ?? null,
    text: c.text,
    at: dtOut(c.at)!,
    status: c.status,
    revisionId: opt(c.revisionId),
    note: opt(c.note),
  };
}

export async function pageContent(db: Exec, slug: string): Promise<PageContent | undefined> {
  const [p] = await db
    .select({ title: wikiPages.title, summary: wikiPages.summary, body: wikiPages.body })
    .from(wikiPages)
    .where(eq(wikiPages.slug, slug));
  return p;
}

async function allContents(db: Exec) {
  return db.select({ slug: wikiPages.slug, title: wikiPages.title, summary: wikiPages.summary, body: wikiPages.body }).from(wikiPages);
}

async function titleResolver(db: Exec) {
  const rows = await db.select({ slug: wikiPages.slug, title: wikiPages.title }).from(wikiPages);
  const m = new Map(rows.map((r) => [r.slug, r.title]));
  return (slug: string) => m.get(slug);
}

async function getRevision(db: Exec, id: string) {
  const [r] = await db.select().from(wikiRevisions).where(eq(wikiRevisions.id, id));
  return r ? toRevision(r) : undefined;
}

/* ───────── 변경 요청 ───────── */

export interface RevisionInput {
  id?: string;
  slug: string;
  after: PageContent;
  message: string;
  author?: Revision["author"];
  commentIds?: string[];
  edits?: EditNote[];
}

export class WikiError extends Error {}

/** 변경 제출 → 검토 중 상태의 새 버전 (검토는 runReview로 따로 돌린다) */
export async function submitRevisionTx(tx: Exec, input: RevisionInput): Promise<Revision> {
  const before = await pageContent(tx, input.slug);
  if (!before) throw new WikiError(`없는 위키 페이지: ${input.slug}`);
  const versions = await tx.select({ v: wikiRevisions.version }).from(wikiRevisions).where(eq(wikiRevisions.slug, input.slug));
  const version = versions.reduce((m, r) => Math.max(m, r.v), 0) + 1;
  const at = seoulNow();
  const r: Revision = {
    id: input.id ?? `${input.slug}-v${version}-${Date.now().toString(36)}`,
    slug: input.slug,
    version,
    at,
    author: input.author ?? "me",
    status: "reviewing",
    message: input.message.trim() || "내용 수정",
    before,
    after: input.after,
    conflicts: [],
    commentIds: input.commentIds,
    edits: input.edits,
  };
  await tx.insert(wikiRevisions).values({
    id: r.id,
    slug: r.slug,
    version: r.version,
    at: dtIn(r.at)!,
    author: r.author,
    status: r.status,
    message: r.message,
    before: r.before,
    after: r.after,
    conflicts: [],
    commentIds: r.commentIds ?? null,
    edits: r.edits ?? null,
  });
  // 이 버전을 만든 주석은 '반영 요청됨'으로
  if (input.commentIds?.length) {
    await tx
      .update(wikiComments)
      .set({ status: "requested", revisionId: r.id, note: null })
      .where(and(eq(wikiComments.slug, input.slug), inArray(wikiComments.id, input.commentIds)));
  }
  return r;
}

export async function submitRevision(db: Db, input: RevisionInput) {
  return db.transaction((tx) => submitRevisionTx(tx, input));
}

/** 검토 실행: 모순 없으면 바로 반영, 있으면 확인 대기 */
export async function runReview(db: Db, id: string, reviewer: WikiReviewer = wikiReviewer) {
  const r = await getRevision(db, id);
  if (!r || r.status !== "reviewing") return;
  const pages = (await allContents(db)).map((p) => (p.slug === r.slug ? { slug: p.slug, ...r.after } : p));
  const result = await reviewer.review({ slug: r.slug, before: r.before, after: r.after }, pages);
  if (result.conflicts.length === 0) {
    await applyRevision(db, id);
  } else {
    await db
      .update(wikiRevisions)
      .set({ status: "pending", conflicts: result.conflicts })
      .where(and(eq(wikiRevisions.id, id), eq(wikiRevisions.status, "reviewing")));
  }
}

export async function applyRevision(db: Db, id: string) {
  await db.transaction(async (tx) => {
    const r = await getRevision(tx, id);
    if (!r || (r.status !== "reviewing" && r.status !== "pending")) return;
    await tx
      .update(wikiPages)
      .set({ title: r.after.title, summary: r.after.summary, body: r.after.body, updatedOn: seoulToday() })
      .where(eq(wikiPages.slug, r.slug));
    await tx.update(wikiRevisions).set({ status: "applied" }).where(eq(wikiRevisions.id, id));
    // 반영되면 주석은 닫힘
    await tx.update(wikiComments).set({ status: "applied" }).where(eq(wikiComments.revisionId, id));
  });
}

export async function cancelRevision(db: Db, id: string) {
  await db.transaction(async (tx) => {
    const r = await getRevision(tx, id);
    if (!r || (r.status !== "reviewing" && r.status !== "pending")) return;
    await tx.update(wikiRevisions).set({ status: "cancelled" }).where(eq(wikiRevisions.id, id));
    // 취소되면 주석은 다시 열림
    await tx.update(wikiComments).set({ status: "open", revisionId: null }).where(eq(wikiComments.revisionId, id));
  });
}

/** 끊긴 검토 다시 돌리기 (서버 재시작 등으로 '검토 중'에 멈춘 변경) */
export async function resumeStalledReviews(db: Db, olderThanMs = 30_000) {
  // DB 시계 기준으로 비교 (앱 서버와 DB 서버의 시간대가 달라도 안전)
  const cutoff = sql`NOW(3) - INTERVAL ${olderThanMs * 1000} MICROSECOND`;
  const stalled = await db
    .select({ id: wikiRevisions.id })
    .from(wikiRevisions)
    .where(and(eq(wikiRevisions.status, "reviewing"), lt(wikiRevisions.updatedAt, cutoff)));
  for (const { id } of stalled) await runReview(db, id);
  return stalled.length;
}

/* ───────── 주석 ───────── */

export async function addComment(db: Exec, c: { id: string; slug: string; anchor: WikiComment["anchor"]; text: string }) {
  const at = seoulNow();
  await db.insert(wikiComments).values({
    id: c.id,
    slug: c.slug,
    anchor: c.anchor,
    text: c.text.trim(),
    at: dtIn(at)!,
    status: "open",
  });
}

export async function updateComment(db: Exec, id: string, text: string) {
  await db.update(wikiComments).set({ text: text.trim(), note: null }).where(eq(wikiComments.id, id));
}

export async function deleteComment(db: Exec, id: string) {
  await db.delete(wikiComments).where(eq(wikiComments.id, id));
}

/**
 * 열린 주석을 한 번에 편집기(Claude)에게 넘김 → 고친 새 버전(작성자 Claude) → 모순 검토.
 * 바뀐 게 없으면 버전을 만들지 않고 주석에 메모만 남긴다.
 */
export async function requestClaudeEdit(db: Db, slug: string, editor: WikiEditor = wikiEditor): Promise<Revision | null> {
  const rows = await db
    .select()
    .from(wikiComments)
    .where(and(eq(wikiComments.slug, slug), eq(wikiComments.status, "open")))
    .orderBy(asc(wikiComments.at));
  const comments = rows.map(toComment);
  if (comments.length === 0) return null;
  const before = await pageContent(db, slug);
  if (!before) throw new WikiError(`없는 위키 페이지: ${slug}`);

  const { content, edits } = await editor.apply(before, comments, await titleResolver(db));
  const changed = content.body !== before.body || content.title !== before.title || content.summary !== before.summary;
  const ok = edits.filter((e) => e.applied);
  const failed = changed && ok.length > 0 ? edits.filter((e) => !e.applied) : edits;

  return db.transaction(async (tx) => {
    let r: Revision | null = null;
    if (changed && ok.length > 0) {
      r = await submitRevisionTx(tx, {
        slug,
        after: content,
        message: `주석 ${ok.length}개 반영`,
        author: "claude",
        commentIds: ok.map((e) => e.commentId),
        edits,
      });
    }
    // 반영 못 한 주석은 열린 채로 메모만
    for (const e of failed) {
      await tx.update(wikiComments).set({ note: e.note.slice(0, 500) }).where(eq(wikiComments.id, e.commentId));
    }
    return r;
  });
}

/* ───────── 복습 ───────── */

async function getReview(db: Exec, slug: string): Promise<WikiReview | undefined> {
  const [p] = await db
    .select({ nextReview: wikiPages.nextReview, intervalDays: wikiPages.intervalDays, reviewCount: wikiPages.reviewCount })
    .from(wikiPages)
    .where(eq(wikiPages.slug, slug));
  return p ? { nextReview: dOut(p.nextReview)!, intervalDays: p.intervalDays, reviewCount: p.reviewCount } : undefined;
}

/** 복습했음 → 다음 복습일을 뒤로 민다. 되돌리기용으로 이전 값을 함께 돌려준다 */
export async function markReviewed(db: Exec, slug: string) {
  const prev = await getReview(db, slug);
  if (!prev) throw new WikiError(`없는 위키 페이지: ${slug}`);
  const intervalDays = nextInterval(prev.intervalDays);
  const next: WikiReview = {
    intervalDays,
    nextReview: format(addDays(parseISO(seoulToday()), intervalDays), "yyyy-MM-dd"),
    reviewCount: prev.reviewCount + 1,
  };
  await setReview(db, slug, next);
  return { prev, next };
}

export async function setReview(db: Exec, slug: string, review: WikiReview) {
  await db
    .update(wikiPages)
    .set({ nextReview: review.nextReview, intervalDays: review.intervalDays, reviewCount: review.reviewCount })
    .where(eq(wikiPages.slug, slug));
}
