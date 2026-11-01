import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { MemoProcessor } from "@/lib/memoProcessor";
import { RuleMemoProcessor } from "@/lib/memoProcessor";
import type { WikiReviewer } from "@/lib/wikiReview";
import type { WikiEditor } from "@/lib/wikiEditor";
import { seedDemo } from "./fixtures/seed";
import { memos, wikiRevisions } from "@/server/db/schema";
import * as items from "@/server/services/items";
import * as wiki from "@/server/services/wiki";
import * as memosService from "@/server/services/memos";
import * as records from "@/server/services/records";
import { ItemInput } from "@/server/validation";
import { testDb } from "./db";

/** 리뷰에서 찾은 버그들이 다시 생기지 않는지 (중복 처리·무한 재시도·덮어쓰기·없는 날짜) */

const { db, close } = testDb();
afterAll(close);
beforeEach(async () => {
  await seedDemo(db, { force: true });
});

const noConflicts: WikiReviewer = { id: "none", review: async () => ({ conflicts: [], summary: "", reviewerId: "none" }) };
const oneConflict: WikiReviewer = {
  id: "one",
  review: async () => ({
    conflicts: [{ ref: { kind: "self", title: "이 페이지" }, excerpt: "a", changed: "b", reason: "테스트" }],
    summary: "",
    reviewerId: "one",
  }),
};
const memoOf = async (id: string) => (await memosService.listMemos(db)).find((m) => m.id === id)!;
const stale = (table: typeof memos | typeof wikiRevisions, id: string) =>
  db.update(table).set({ updatedAt: "2020-01-01 00:00:00.000" }).where(eq(table.id, id));

describe("메모 처리 — 중복·실패", () => {
  it("같은 메모를 동시에 두 번 처리해도 항목은 한 번만 생긴다", async () => {
    await memosService.addMemo(db, { id: "dup1", text: "내일 3시 거래처 미팅" });
    const before = (await items.listItems(db)).length;
    // 처리기가 느린 상황(Claude 호출)에서 두 요청이 겹치는 경우
    const slow: MemoProcessor = {
      id: "slow",
      process: async (text, today) => {
        await new Promise((r) => setTimeout(r, 200));
        return new RuleMemoProcessor().process(text, today);
      },
    };
    await Promise.all([memosService.processMemo(db, "dup1", slow), memosService.processMemo(db, "dup1", slow)]);
    const created = (await memoOf("dup1")).result!.actions.filter((a) => a.kind === "create_event").length;
    expect(created).toBe(1);
    expect((await items.listItems(db)).length).toBe(before + 1);
  });

  it("멈춘 메모를 여러 요청이 동시에 재개해도 한 번만 처리한다", async () => {
    await memosService.addMemo(db, { id: "dup2", text: "모레 2시 교육" });
    await stale(memos, "dup2");
    const before = (await items.listItems(db)).length;
    const resumed = await Promise.all([
      memosService.resumeStalledMemos(db),
      memosService.resumeStalledMemos(db),
      memosService.resumeStalledMemos(db),
    ]);
    expect(resumed.reduce((a, b) => a + b, 0)).toBe(1);
    expect((await items.listItems(db)).length).toBe(before + 1);
  });

  it("처리기가 실패하면 '실패'로 남고 다시 돌지 않는다 → 다시 정리하면 처리된다", async () => {
    await memosService.addMemo(db, { id: "f1", text: "내일 회의" });
    const broken: MemoProcessor = {
      id: "broken",
      process: async () => {
        throw new Error("처리기 오류");
      },
    };
    await memosService.processMemo(db, "f1", broken);
    expect((await memoOf("f1")).status).toBe("failed");
    await stale(memos, "f1");
    expect(await memosService.resumeStalledMemos(db)).toBe(0);

    expect(await memosService.retryMemo(db, "f1")).toBe(true);
    expect(await memosService.retryMemo(db, "f1")).toBe(false); // 이미 처리 대기
    await memosService.processMemo(db, "f1");
    expect((await memoOf("f1")).status).toBe("done");
  });

  it("없는 날짜·시각(3/40, 오후 13시)이 섞인 메모도 처리된다", async () => {
    await memosService.addMemo(db, { id: "d1", text: "진행률 3/40 정리해서 오후 13시 회의 전에 보내야 함" });
    await memosService.processMemo(db, "d1");
    expect((await memoOf("d1")).status).toBe("done");
  });
});

describe("위키 변경 — 덮어쓰기·버전", () => {
  const slug = "weekly-report";
  const content = async () => (await wiki.pageContent(db, slug))!;

  it("만든 뒤 다른 변경이 먼저 반영됐으면 덮어쓰지 않고 확인 대기로 돌린다", async () => {
    const cur = await content();
    const a = await wiki.submitRevision(db, { slug, after: { ...cur, summary: "A" }, message: "A" });
    const b = await wiki.submitRevision(db, { slug, after: { ...cur, summary: "B" }, message: "B" });
    await wiki.runReview(db, a.id, noConflicts);
    expect((await content()).summary).toBe("A");

    await wiki.runReview(db, b.id, noConflicts);
    expect((await content()).summary).toBe("A");
    const rb = (await wiki.listWiki(db)).revisions.find((r) => r.id === b.id)!;
    expect(rb.status).toBe("pending");
    expect(rb.conflicts[0].ref.title).toBe("문서가 바뀜");
    // '그래도 반영'을 눌러도 덮어쓰지 않는다
    expect(await wiki.applyRevision(db, b.id)).toBe(false);
    expect((await content()).summary).toBe("A");
  });

  it("검토기가 실패하면 확인 대기로 남고 다시 돌지 않는다", async () => {
    const cur = await content();
    const r = await wiki.submitRevision(db, { slug, after: { ...cur, summary: "X" }, message: "X" });
    const broken: WikiReviewer = {
      id: "broken",
      review: async () => {
        throw new Error("검토기 오류");
      },
    };
    await wiki.runReview(db, r.id, broken);
    const saved = (await wiki.listWiki(db)).revisions.find((x) => x.id === r.id)!;
    expect(saved.status).toBe("pending");
    expect(saved.conflicts[0].ref.title).toBe("자동 검토 실패");
  });

  it("같은 페이지에 동시에 제출해도 버전 번호가 겹치지 않는다", async () => {
    const cur = await content();
    const revs = await Promise.all(
      [1, 2, 3].map((n) => wiki.submitRevision(db, { slug, after: { ...cur, summary: `동시 ${n}` }, message: `${n}` })),
    );
    expect(new Set(revs.map((r) => r.version)).size).toBe(3);
  });

  it("멈춘 검토를 여러 요청이 동시에 재개해도 한 번만 돈다", async () => {
    const cur = await content();
    const r = await wiki.submitRevision(db, { slug, after: { ...cur, summary: "재개" }, message: "재개" });
    await stale(wikiRevisions, r.id);
    const resumed = await Promise.all([wiki.resumeStalledReviews(db), wiki.resumeStalledReviews(db)]);
    expect(resumed.reduce((a, b) => a + b, 0)).toBe(1);
  });

  it("확인 대기(모순) → 그래도 반영은 문서가 그대로면 된다", async () => {
    const cur = await content();
    const r = await wiki.submitRevision(db, { slug, after: { ...cur, summary: "모순" }, message: "모순" });
    await wiki.runReview(db, r.id, oneConflict);
    expect(await wiki.applyRevision(db, r.id)).toBe(true);
    expect((await content()).summary).toBe("모순");
  });

  it("Claude 편집이 실패하면 버전을 만들지 않고 주석은 열린 채 이유만 남긴다", async () => {
    await wiki.addComment(db, { id: "cf1", slug, anchor: null, text: "17:00 → 16:00" });
    const failing: WikiEditor = {
      id: "fail",
      apply: async () => {
        throw new Error("API 장애");
      },
    };
    const before = await content();
    expect(await wiki.requestClaudeEdit(db, slug, failing)).toBeNull();
    expect(await content()).toEqual(before);
    const c = (await wiki.listWiki(db)).comments.find((x) => x.id === "cf1")!;
    expect(c.status).toBe("open");
    expect(c.note).toContain("다시 요청");
  });

  it("메모 처리기에 위키 페이지 목록을 넘긴다", async () => {
    await memosService.addMemo(db, { id: "pg1", text: "메모" });
    let seen: string[] = [];
    const spy: MemoProcessor = {
      id: "spy",
      process: async (text, today, pages) => {
        seen = pages.map((p) => p.slug);
        return { cleaned: text, events: [], tasks: [], asks: [], wiki: [], cautions: [] };
      },
    };
    await memosService.processMemo(db, "pg1", spy);
    expect(seen).toContain(slug);
  });
});

describe("재배치·항목 저장", () => {
  it("재배치를 동시에 두 번 눌러도 날짜는 한 번만 밀린다", async () => {
    const p = (await records.latestReschedule(db))!;
    const ids = p.items.map((c) => c.itemId);
    const counts = await Promise.all([records.applyReschedule(db, p.id, ids), records.applyReschedule(db, p.id, ids)]);
    expect(counts.filter((n) => n > 0)).toHaveLength(1);
    const first = p.items[0];
    expect((await items.getItem(db, first.itemId))!.start?.slice(0, 10)).toBe(first.toDate);
  });

  it("그 사이 지워진 태그·위키를 가리켜도 항목 저장은 성공한다", async () => {
    const it0 = (await items.getItem(db, "i1"))!;
    await items.removeTag(db, "focus");
    await items.saveItem(db, { ...it0, tags: ["focus", "report"], wikiRefs: ["no-such-page", "weekly-report"] });
    const saved = (await items.getItem(db, "i1"))!;
    expect(saved.tags).toEqual(["report"]);
    expect(saved.wikiRefs).toEqual(["weekly-report"]);
  });

  it("검증: 없는 날짜·시각, 겹치는 하위 항목 id는 거부", () => {
    const base = { id: "ok_1", title: "t", kind: "task", tags: [], subItems: [], wikiRefs: [], createdAt: "2026-10-30" };
    expect(ItemInput.safeParse({ ...base, due: "2026-02-31" }).success).toBe(false);
    expect(ItemInput.safeParse({ ...base, start: "2026-10-30T24:00" }).success).toBe(false);
    expect(ItemInput.safeParse({ ...base, due: "2028-02-29" }).success).toBe(true);
    const dup = [
      { id: "s1", title: "a", done: false },
      { id: "s1", title: "b", done: false },
    ];
    expect(ItemInput.safeParse({ ...base, subItems: dup }).success).toBe(false);
  });
});
