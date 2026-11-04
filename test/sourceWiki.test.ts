import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { sources, wikiLinks, wikiPages, wikiPageSources, wikiRevisions } from "@/server/db/schema";
import * as sourceWiki from "@/server/services/sourceWiki";
import * as wiki from "@/server/services/wiki";
import { loadWorkspace } from "@/server/services/workspace";
import type { Organizer } from "@/server/ai/organize";
import { sanitizePages } from "@/server/ai/organize";
import { testDb } from "./db";

/** 원본 → 위키 정리 (가짜 Claude 서버가 원본 하나를 페이지 하나로 정리) */

const { db, close } = testDb();
afterAll(close);
beforeEach(async () => {
  await db.delete(wikiRevisions);
  await db.delete(wikiPages);
  await db.delete(sources);
});

async function addSource(id: string, title: string, text: string | null, fileType = "docx") {
  await db.insert(sources).values({ id, title, type: "guideline", fileType, addedOn: "2026-11-04", text, wikiStatus: "processing" });
}
const statusOf = async (id: string) => (await db.select().from(sources).where(eq(sources.id, id)))[0];

describe("원본 → 위키 정리", () => {
  it("새 주제면 페이지를 만들고 원본을 근거로 붙인다", async () => {
    await addSource("s1", "법인카드 사용 규정", "법인카드는 1회 50만원 초과 시 사전 품의\n증빙은 익월 3일까지");
    await sourceWiki.organizeSource(db, "s1");

    const s = await statusOf("s1");
    expect(s.wikiStatus).toBe("done");
    expect(s.wikiResult?.created).toHaveLength(1);
    const slug = s.wikiResult!.created[0];
    const [page] = await db.select().from(wikiPages).where(eq(wikiPages.slug, slug));
    expect(page).toMatchObject({ title: "법인카드 사용 규정", category: "일반" });
    expect(page.body).toContain("익월 3일까지");
    expect(await db.select().from(wikiPageSources).where(eq(wikiPageSources.slug, slug))).toEqual([{ slug, sourceId: "s1", sort: 0 }]);
    // 화면 스냅샷: 원본 글자는 보내지 않고, 정리 결과만
    const ws = await loadWorkspace(db);
    const src = ws.wiki.sources.find((x) => x.id === "s1")!;
    expect(src.wiki).toMatchObject({ status: "done", created: [slug] });
    expect(JSON.stringify(ws)).not.toContain("1회 50만원 초과 시 사전 품의\n");
  });

  it("같은 주제의 페이지가 있으면 고치는 변경을 올리고, 모순 검토를 거쳐 반영한다", async () => {
    await addSource("s1", "주간보고 양식", "매주 금요일 17:00까지 제출");
    await sourceWiki.organizeSource(db, "s1");
    const slug = (await statusOf("s1")).wikiResult!.created[0];

    await addSource("s2", "주간보고 양식", "첨부는 PDF로");
    await sourceWiki.organizeSource(db, "s2");
    const s2 = await statusOf("s2");
    expect(s2.wikiResult).toMatchObject({ created: [], updated: [slug] });
    const [rev] = await db.select().from(wikiRevisions).where(eq(wikiRevisions.slug, slug));
    expect(rev).toMatchObject({ author: "claude", status: "applied" });
    expect((await wiki.pageContent(db, slug))!.body).toContain("첨부는 PDF로");
    // 근거 원본이 둘 다 붙는다
    expect((await db.select().from(wikiPageSources).where(eq(wikiPageSources.slug, slug))).map((r) => r.sourceId).sort()).toEqual(["s1", "s2"]);
  });

  it("글자를 못 읽은 원본(암호·배포용 등)은 Claude를 부르지 않고 이유와 함께 실패", async () => {
    await addSource("s1", "배포용 문서", null, "hwp");
    let called = false;
    const spy: Organizer = { id: "spy", organize: async () => ((called = true), { pages: [], note: "" }) };
    await sourceWiki.organizeSource(db, "s1", spy);
    expect(called).toBe(false);
    expect(await statusOf("s1")).toMatchObject({ wikiStatus: "failed", wikiResult: { note: expect.stringContaining("글자를 읽지 못했어요") } });
  });

  it("Claude 키가 없으면 정리하지 않고 이유를 남기며, 다시 정리할 수 있다", async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await addSource("s1", "규정", "내용");
      await sourceWiki.organizeSource(db, "s1");
      expect(await statusOf("s1")).toMatchObject({ wikiStatus: "failed", wikiResult: { note: expect.stringContaining("Claude API 키가 없어") } });
    } finally {
      process.env.ANTHROPIC_API_KEY = key;
    }
    expect(await sourceWiki.retryOrganize(db, "s1")).toBe(true);
    expect(await sourceWiki.retryOrganize(db, "s1")).toBe(false); // 이미 대기 중
    await sourceWiki.organizeSource(db, "s1");
    expect((await statusOf("s1")).wikiStatus).toBe("done");
  });

  it("멈춘 정리는 한 번만 다시 돈다 (동시에 여러 요청이 와도)", async () => {
    await addSource("s1", "회의실 예약", "하루 전까지 예약");
    await db.update(sources).set({ updatedAt: "2020-01-01 00:00:00.000" }).where(eq(sources.id, "s1"));
    const resumed = await Promise.all([sourceWiki.resumeStalledOrganize(db), sourceWiki.resumeStalledOrganize(db)]);
    expect(resumed.reduce((a, b) => a + b, 0)).toBe(1);
    expect((await statusOf("s1")).wikiStatus).toBe("done");
  });

  it("본문의 [[링크]]로 페이지 연결을 만든다", async () => {
    const organizer: Organizer = {
      id: "links",
      organize: async () => ({
        note: "",
        pages: [
          { action: "create", slug: "a-page", title: "A", category: "일반", summary: "", body: "[[b-page]] 참고, 자기 자신 [[a-page]]" },
          { action: "create", slug: "b-page", title: "B", category: "일반", summary: "", body: "[[a-page]]" },
        ],
      }),
    };
    await addSource("s1", "묶음", "내용");
    await sourceWiki.organizeSource(db, "s1", organizer);
    const links = await db.select().from(wikiLinks).orderBy(sql`from_slug`);
    expect(links.map((l) => `${l.fromSlug}->${l.toSlug}`)).toEqual(["a-page->b-page", "b-page->a-page"]);
  });
});

describe("Claude 응답 정리 (sanitizePages)", () => {
  it("slug를 규칙에 맞추고, 없는 페이지 '고치기'는 새로 만들기로, 빈 페이지·중복은 버린다", () => {
    const pages = sanitizePages(
      [
        { action: "update", slug: "Corporate Card!!", title: " 법인카드 ", category: "", summary: "요약", body: "본문" },
        { action: "create", slug: "weekly", title: "주간보고", category: "보고·문서", summary: "", body: "본문" },
        { action: "create", slug: "weekly", title: "중복", category: "", summary: "", body: "본문" },
        { action: "create", slug: "empty", title: "빈 본문", category: "", summary: "", body: "  " },
      ],
      [{ slug: "weekly", title: "주간보고", category: "보고·문서", summary: "" }],
    );
    expect(pages).toEqual([
      { action: "create", slug: "corporate-card", title: "법인카드", category: "일반", summary: "요약", body: "본문" },
      { action: "update", slug: "weekly", title: "주간보고", category: "보고·문서", summary: "", body: "본문" },
    ]);
  });
});
