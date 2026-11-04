import "server-only";
import { addDays, format, parseISO } from "date-fns";
import { and, asc, count, eq, lt, sql } from "drizzle-orm";
import type { SourceType, SourceWikiResult } from "@/lib/types";
import { seoulToday } from "@/lib/today";
import { sources, wikiPages, wikiPageSources } from "@/server/db/schema";
import type { Db, Exec } from "@/server/db/types";
import { getObjectBytes } from "@/server/storage";
import { defaultOrganizer, type ExistingPage, type Organizer, type OrganizeSource } from "@/server/ai/organize";
import { ClaudeUnavailableError } from "@/server/ai/claude";
import { affectedRows, STALLED_MS, stalledBefore } from "./jobs";
import { runReview, submitRevisionTx, syncLinks } from "./wiki";

/**
 * 원본 → 위키 정리.
 * 올리면 'processing' → 응답 뒤 Claude가 정리 → 새 페이지는 바로 만들고, 기존 페이지 수정은 변경으로 올려 모순 검토를 거친다.
 * 실패하면 'failed'(다시 정리 가능). 서버가 재시작돼 멈춘 건 /api/workspace 요청 때 다시 돌린다.
 */

/** Claude가 파일을 직접 읽는 형식의 한도 (요청 한 번 32MB) */
const PDF_BYTES = 15 * 1024 * 1024;
const IMAGE_BYTES = 5 * 1024 * 1024;

async function loadSource(db: Exec, id: string): Promise<{ input?: OrganizeSource; unreadable?: string }> {
  const [s] = await db.select().from(sources).where(eq(sources.id, id));
  if (!s) return { unreadable: "원본을 찾을 수 없어요" };
  const type = s.type as SourceType;
  if (s.text) return { input: { title: s.title, type, content: { kind: "text", text: s.text } } };
  const size = s.sizeBytes ?? Infinity;
  if (s.objectKey && s.fileType === "pdf" && size <= PDF_BYTES) {
    const base64 = Buffer.from(await getObjectBytes(s.objectKey)).toString("base64");
    return { input: { title: s.title, type, content: { kind: "pdf", base64 } } };
  }
  if (s.objectKey && s.fileType === "image" && size <= IMAGE_BYTES) {
    const base64 = Buffer.from(await getObjectBytes(s.objectKey)).toString("base64");
    const mediaType = s.objectKey.toLowerCase().endsWith(".png") ? "image/png" : "image/jpeg";
    return { input: { title: s.title, type, content: { kind: "image", mediaType, base64 } } };
  }
  if (s.fileType === "pdf" || s.fileType === "image") return { unreadable: "파일이 너무 커서 읽지 못했어요" };
  return { unreadable: "글자를 읽지 못했어요 (암호·배포용 문서이거나 깨진 파일일 수 있어요)" };
}

async function finish(db: Exec, id: string, status: "done" | "failed", result: SourceWikiResult) {
  await db
    .update(sources)
    .set({ wikiStatus: status, wikiResult: result })
    .where(and(eq(sources.id, id), eq(sources.wikiStatus, "processing")));
}

export async function organizeSource(db: Db, id: string, organizer: Organizer = defaultOrganizer()) {
  const [row] = await db.select({ status: sources.wikiStatus, title: sources.title }).from(sources).where(eq(sources.id, id));
  if (row?.status !== "processing") return;

  const { input, unreadable } = await loadSource(db, id);
  if (!input) {
    await finish(db, id, "failed", { created: [], updated: [], note: unreadable });
    return;
  }

  let revisionIds: string[] = [];
  try {
    const existing: ExistingPage[] = await db
      .select({ slug: wikiPages.slug, title: wikiPages.title, category: wikiPages.category, summary: wikiPages.summary, body: wikiPages.body })
      .from(wikiPages)
      .orderBy(asc(wikiPages.createdOn));
    const today = seoulToday();
    const plan = await organizer.organize(input, existing, today);

    revisionIds = await db.transaction(async (tx) => {
      const [cur] = await tx.select({ status: sources.wikiStatus }).from(sources).where(eq(sources.id, id)).for("update");
      if (cur?.status !== "processing") return [];
      const created: string[] = [];
      const updated: string[] = [];
      const ids: string[] = [];
      for (const p of plan.pages) {
        const [has] = await tx.select({ slug: wikiPages.slug }).from(wikiPages).where(eq(wikiPages.slug, p.slug)).for("update");
        if (!has) {
          await tx.insert(wikiPages).values({
            slug: p.slug,
            title: p.title,
            category: p.category,
            summary: p.summary,
            body: p.body,
            createdOn: today,
            updatedOn: today,
            // 새로 배운 내용은 다음 날 한 번 다시 보여준다
            nextReview: format(addDays(parseISO(today), 1), "yyyy-MM-dd"),
            intervalDays: 1,
          });
          await syncLinks(tx, p.slug, p.body);
          created.push(p.slug);
        } else {
          const r = await submitRevisionTx(tx, {
            slug: p.slug,
            after: { title: p.title, summary: p.summary, body: p.body },
            message: `원본 «${row.title.slice(0, 60)}» 반영`,
            author: "claude",
          });
          ids.push(r.id);
          updated.push(p.slug);
        }
        await linkSource(tx, p.slug, id);
      }
      await tx
        .update(sources)
        .set({ wikiStatus: "done", wikiResult: { created, updated, note: plan.note || undefined } })
        .where(eq(sources.id, id));
      return ids;
    });
  } catch (error) {
    console.error("[source-wiki] 정리 실패", id, error instanceof ClaudeUnavailableError ? error.message : error);
    const note = error instanceof ClaudeUnavailableError ? error.message : "위키로 정리하지 못했어요. 다시 정리를 눌러 주세요.";
    await finish(db, id, "failed", { created: [], updated: [], note });
    return;
  }
  // 기존 페이지 수정은 모순 검토를 거쳐 반영
  for (const rid of revisionIds) await runReview(db, rid);
}

/** 페이지에 근거 원본으로 붙인다 (이미 있으면 그대로) */
async function linkSource(tx: Exec, slug: string, sourceId: string) {
  const [{ n }] = await tx.select({ n: count() }).from(wikiPageSources).where(eq(wikiPageSources.slug, slug));
  await tx
    .insert(wikiPageSources)
    .values({ slug, sourceId, sort: n })
    .onDuplicateKeyUpdate({ set: { sort: sql`sort` } });
}

/** 올린 원본을 정리 대기로 (처리는 organizeSource로 따로) */
export async function queueOrganize(db: Exec, id: string) {
  await db.update(sources).set({ wikiStatus: "processing", wikiResult: null }).where(eq(sources.id, id));
}

/** 실패한 정리를 다시 대기로. 바뀌었으면 true */
export async function retryOrganize(db: Exec, id: string) {
  const res = await db
    .update(sources)
    .set({ wikiStatus: "processing", wikiResult: null })
    .where(and(eq(sources.id, id), eq(sources.wikiStatus, "failed")));
  return affectedRows(res) === 1;
}

/** 서버가 재시작돼 멈춘 정리를 다시 (먼저 점유한 요청만) */
export async function resumeStalledOrganize(db: Db, olderThanMs = STALLED_MS) {
  const isStalled = (id?: string) =>
    and(id ? eq(sources.id, id) : undefined, eq(sources.wikiStatus, "processing"), lt(sources.updatedAt, stalledBefore(olderThanMs)));
  const stalled = await db.select({ id: sources.id }).from(sources).where(isStalled());
  let resumed = 0;
  for (const { id } of stalled) {
    const claim = await db.update(sources).set({ updatedAt: sql`CURRENT_TIMESTAMP(3)` }).where(isStalled(id));
    if (affectedRows(claim) !== 1) continue;
    await organizeSource(db, id);
    resumed++;
  }
  return resumed;
}
