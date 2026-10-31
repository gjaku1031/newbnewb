import "server-only";
import { addDays, parseISO, format } from "date-fns";
import { and, asc, eq, inArray, lt, sql } from "drizzle-orm";
import type { Source, SourceType, WikiPage, WikiReview } from "@/lib/types";
import type { Conflict, EditNote, PageContent, Revision, WikiComment } from "@/lib/wikiTypes";
import type { WikiData } from "@/lib/workspace";
import { nextInterval } from "@/lib/review";
import { seoulNow, seoulToday } from "@/lib/today";
import { wikiReviewer, type WikiReviewer } from "@/lib/wikiReview";
import { wikiEditor, type WikiEditor } from "@/lib/wikiEditor";
import { sources, wikiComments, wikiLinks, wikiPages, wikiPageSources, wikiRevisions } from "@/server/db/schema";
import { dOut, dtIn, dtOut, opt } from "@/server/db/convert";
import type { Db, Exec } from "@/server/db/types";
import { affectedRows, stalledBefore } from "./jobs";

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

/** lock: 트랜잭션 안에서 페이지 행을 잠가, 같은 페이지의 버전 번호 매기기·반영이 겹치지 않게 한다 */
export async function pageContent(db: Exec, slug: string, lock = false): Promise<PageContent | undefined> {
  const q = db
    .select({ title: wikiPages.title, summary: wikiPages.summary, body: wikiPages.body })
    .from(wikiPages)
    .where(eq(wikiPages.slug, slug));
  const [p] = lock ? await q.for("update") : await q;
  return p;
}

const sameContent = (a: PageContent, b: PageContent) => a.title === b.title && a.summary === b.summary && a.body === b.body;

async function allContents(db: Exec) {
  return db.select({ slug: wikiPages.slug, title: wikiPages.title, summary: wikiPages.summary, body: wikiPages.body }).from(wikiPages);
}

async function titleResolver(db: Exec) {
  const rows = await db.select({ slug: wikiPages.slug, title: wikiPages.title }).from(wikiPages);
  const m = new Map(rows.map((r) => [r.slug, r.title]));
  return (slug: string) => m.get(slug);
}

async function getRevision(db: Exec, id: string, lock = false) {
  const q = db.select().from(wikiRevisions).where(eq(wikiRevisions.id, id));
  const [r] = lock ? await q.for("update") : await q;
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
  const before = await pageContent(tx, input.slug, true);
  if (!before) throw new WikiError(`없는 위키 페이지: ${input.slug}`);
  const versions = await tx.select({ v: wikiRevisions.version }).from(wikiRevisions).where(eq(wikiRevisions.slug, input.slug));
  const version = versions.reduce((m, r) => Math.max(m, r.v), 0) + 1;
  const at = seoulNow();
  const r: Revision = {
    // id 컬럼(128자)을 넘지 않게 slug는 앞부분만
    id: input.id ?? `${input.slug.slice(0, 96)}-v${version}-${Date.now().toString(36)}`,
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

/** 검토기가 실패했을 때 남기는 표시 — 무한 재시도 대신 사용자가 직접 반영·취소를 고르게 한다 */
const REVIEW_FAILED: Conflict = {
  ref: { kind: "self", title: "자동 검토 실패" },
  excerpt: "",
  changed: "",
  reason: "모순 검토를 끝내지 못했어요. 바뀐 내용을 직접 확인하고 반영하거나 취소하세요.",
};

/** 검토하는 사이 다른 변경이 먼저 반영된 경우 — 덮어쓰면 그 변경이 사라진다 */
const STALE: Conflict = {
  ref: { kind: "self", title: "문서가 바뀜" },
  excerpt: "",
  changed: "",
  reason: "이 변경을 만든 뒤 다른 변경이 먼저 반영됐어요. 덮어쓰지 않도록 취소하고 다시 고쳐 주세요.",
};

/** 검토 실행: 모순 없으면 바로 반영, 있으면 확인 대기 */
export async function runReview(db: Db, id: string, reviewer: WikiReviewer = wikiReviewer) {
  const r = await getRevision(db, id);
  if (!r || r.status !== "reviewing") return;
  let conflicts: Conflict[];
  try {
    const pages = (await allContents(db)).map((p) => (p.slug === r.slug ? { slug: p.slug, ...r.after } : p));
    conflicts = (await reviewer.review({ slug: r.slug, before: r.before, after: r.after }, pages)).conflicts;
  } catch (error) {
    console.error("[wiki] 검토 실패", id, error);
    conflicts = [REVIEW_FAILED];
  }
  if (conflicts.length === 0) {
    await applyRevision(db, id);
  } else {
    await db
      .update(wikiRevisions)
      .set({ status: "pending", conflicts })
      .where(and(eq(wikiRevisions.id, id), eq(wikiRevisions.status, "reviewing")));
  }
}

/**
 * 변경 반영. 만든 뒤 문서가 바뀌었으면(다른 변경이 먼저 반영) 덮어쓰지 않고 확인 대기로 돌린다.
 * 반영했으면 true.
 */
export async function applyRevision(db: Db, id: string): Promise<boolean> {
  return db.transaction(async (tx) => {
    const r = await getRevision(tx, id, true);
    if (!r || (r.status !== "reviewing" && r.status !== "pending")) return false;
    const current = await pageContent(tx, r.slug, true);
    if (!current) return false;
    if (!sameContent(current, r.before)) {
      const conflicts = [STALE, ...r.conflicts.filter((c) => c.reason !== STALE.reason)];
      await tx.update(wikiRevisions).set({ status: "pending", conflicts }).where(eq(wikiRevisions.id, id));
      return false;
    }
    await tx
      .update(wikiPages)
      .set({ title: r.after.title, summary: r.after.summary, body: r.after.body, updatedOn: seoulToday() })
      .where(eq(wikiPages.slug, r.slug));
    await tx.update(wikiRevisions).set({ status: "applied" }).where(eq(wikiRevisions.id, id));
    // 반영되면 주석은 닫힘
    await tx.update(wikiComments).set({ status: "applied" }).where(eq(wikiComments.revisionId, id));
    return true;
  });
}

export async function cancelRevision(db: Db, id: string) {
  await db.transaction(async (tx) => {
    const r = await getRevision(tx, id, true);
    if (!r || (r.status !== "reviewing" && r.status !== "pending")) return;
    await tx.update(wikiRevisions).set({ status: "cancelled" }).where(eq(wikiRevisions.id, id));
    // 취소되면 주석은 다시 열림
    await tx.update(wikiComments).set({ status: "open", revisionId: null }).where(eq(wikiComments.revisionId, id));
  });
}

/** 끊긴 검토 다시 돌리기 (서버 재시작 등으로 '검토 중'에 멈춘 변경) */
export async function resumeStalledReviews(db: Db, olderThanMs = 30_000) {
  const isStalled = (id?: string) =>
    and(
      id ? eq(wikiRevisions.id, id) : undefined,
      eq(wikiRevisions.status, "reviewing"),
      lt(wikiRevisions.updatedAt, stalledBefore(olderThanMs)),
    );
  const stalled = await db.select({ id: wikiRevisions.id }).from(wikiRevisions).where(isStalled());
  let resumed = 0;
  for (const { id } of stalled) {
    // 먼저 점유(updated_at을 지금으로) — 동시에 들어온 다른 요청은 같은 변경을 또 돌리지 않는다
    const claim = await db.update(wikiRevisions).set({ updatedAt: sql`CURRENT_TIMESTAMP(3)` }).where(isStalled(id));
    if (affectedRows(claim) !== 1) continue;
    await runReview(db, id);
    resumed++;
  }
  return resumed;
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
