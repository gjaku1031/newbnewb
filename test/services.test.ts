import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Item } from "@/lib/types";
import type { WikiReviewer } from "@/lib/wikiReview";
import { seedDemo } from "./fixtures/seed";
import { memos } from "@/server/db/schema";
import * as items from "@/server/services/items";
import * as wiki from "@/server/services/wiki";
import * as memosService from "@/server/services/memos";
import * as records from "@/server/services/records";
import * as cautions from "@/server/services/cautions";
import { ItemInput } from "@/server/validation";
import { testDb } from "./db";

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
const pageOf = async (slug: string) => (await wiki.listWiki(db)).pages.find((p) => p.slug === slug)!;

describe("항목", () => {
  it("하위 항목·태그·위키 연결까지 통째로 저장하고 다시 읽는다", async () => {
    const it0 = (await items.getItem(db, "i1"))!;
    const next: Item = {
      ...it0,
      title: "바뀐 제목",
      start: "2026-11-01T13:30",
      subItems: [{ id: "x1", title: "새 하위", done: true }],
      tags: ["report", "focus"],
      wikiRefs: ["weekly-report"],
      description: undefined,
    };
    await items.saveItem(db, next);
    expect(await items.getItem(db, "i1")).toEqual(next);
  });

  it("태그를 지우면 항목에서도 빠진다", async () => {
    await items.removeTag(db, "focus");
    const all = await items.listItems(db);
    expect(all.some((i) => i.tags.includes("focus"))).toBe(false);
    expect((await items.listTags(db)).map((t) => t.id)).not.toContain("focus");
  });

  it("검증: 잘못된 id·시간 형식은 거부", () => {
    const base = { id: "ok_1", title: "t", kind: "task", tags: [], subItems: [], wikiRefs: [], createdAt: "2026-10-30" };
    expect(ItemInput.safeParse(base).success).toBe(true);
    expect(ItemInput.safeParse({ ...base, id: "'; drop table items; --" }).success).toBe(false);
    expect(ItemInput.safeParse({ ...base, start: "2026-10-30 10:00" }).success).toBe(false);
    expect(ItemInput.safeParse({ ...base, title: "  " }).success).toBe(false);
  });
});

describe("위키 변경 흐름", () => {
  it("모순 없으면 바로 반영되고 페이지가 바뀐다", async () => {
    const cur = await pageOf("weekly-report");
    const r = await wiki.submitRevision(db, {
      slug: "weekly-report",
      after: { title: cur.title, summary: "새 요약", body: cur.body },
      message: "요약 수정",
    });
    expect(r.status).toBe("reviewing");
    expect(r.version).toBe(3);
    await wiki.runReview(db, r.id, noConflicts);
    const ws = await wiki.listWiki(db);
    expect(ws.revisions.find((x) => x.id === r.id)?.status).toBe("applied");
    expect(ws.pages.find((p) => p.slug === "weekly-report")?.summary).toBe("새 요약");
  });

  it("모순이 있으면 확인 대기 → 취소하면 주석이 다시 열린다", async () => {
    await wiki.addComment(db, { id: "c1", slug: "weekly-report", anchor: null, text: "17:00 → 16:00" });
    const r = await wiki.requestClaudeEdit(db, "weekly-report");
    expect(r?.author).toBe("claude");
    let ws = await wiki.listWiki(db);
    expect(ws.comments.find((c) => c.id === "c1")).toMatchObject({ status: "requested", revisionId: r!.id });

    await wiki.runReview(db, r!.id, oneConflict);
    ws = await wiki.listWiki(db);
    expect(ws.revisions.find((x) => x.id === r!.id)?.status).toBe("pending");
    expect((await pageOf("weekly-report")).body).toContain("17:00");

    await wiki.cancelRevision(db, r!.id);
    ws = await wiki.listWiki(db);
    expect(ws.revisions.find((x) => x.id === r!.id)?.status).toBe("cancelled");
    expect(ws.comments.find((c) => c.id === "c1")).toMatchObject({ status: "open" });
    expect(ws.comments.find((c) => c.id === "c1")?.revisionId).toBeUndefined();
  });

  it("확인 대기를 그래도 반영하면 페이지가 바뀌고 주석이 닫힌다", async () => {
    await wiki.addComment(db, { id: "c2", slug: "weekly-report", anchor: null, text: "17:00 → 16:00" });
    const r = (await wiki.requestClaudeEdit(db, "weekly-report"))!;
    await wiki.runReview(db, r.id, oneConflict);
    await wiki.applyRevision(db, r.id);
    expect((await pageOf("weekly-report")).body).toContain("16:00");
    expect((await wiki.listWiki(db)).comments.find((c) => c.id === "c2")?.status).toBe("applied");
  });

  it("고칠 수 없는 주석은 버전을 만들지 않고 메모만 남긴다", async () => {
    await wiki.addComment(db, { id: "c3", slug: "weekly-report", anchor: null, text: "존재하지않는문구 → 다른문구" });
    expect(await wiki.requestClaudeEdit(db, "weekly-report")).toBeNull();
    const c = (await wiki.listWiki(db)).comments.find((x) => x.id === "c3");
    expect(c?.status).toBe("open");
    expect(c?.note).toBeTruthy();
  });

  it("복습했음 → 간격 2배, 되돌리기", async () => {
    const before = (await pageOf("weekly-report")).review;
    const { prev, next } = await wiki.markReviewed(db, "weekly-report");
    expect(prev).toEqual(before);
    expect(next.intervalDays).toBe(before.intervalDays * 2);
    expect(next.reviewCount).toBe(before.reviewCount + 1);
    await wiki.setReview(db, "weekly-report", prev);
    expect((await pageOf("weekly-report")).review).toEqual(before);
  });
});

describe("메모 처리", () => {
  it("메모를 읽고 일정·할 일을 만들고 한 일을 기록한다", async () => {
    await memosService.addMemo(db, { id: "mt1", text: "팀장 월욜 한빛물산 미팅 10시래 회의실 예약 내가 해야됨" });
    await memosService.processMemo(db, "mt1");
    const memo = (await memosService.listMemos(db)).find((m) => m.id === "mt1")!;
    expect(memo.status).toBe("done");
    const ids = memo.result!.actions.filter((a) => a.href?.startsWith("/items/")).map((a) => a.href!.slice(7));
    expect(ids.length).toBeGreaterThan(0);
    const all = await items.listItems(db);
    for (const id of ids) expect(all.find((i) => i.id === id)).toBeDefined();
  });

  it("처리 중에 멈춘 메모는 다시 처리한다", async () => {
    await memosService.addMemo(db, { id: "mt2", text: "내일 3시 거래처 통화" });
    await db.update(memos).set({ updatedAt: "2020-01-01 00:00:00.000" }).where(eq(memos.id, "mt2"));
    expect(await memosService.resumeStalledMemos(db)).toBe(1);
    expect((await memosService.listMemos(db)).find((m) => m.id === "mt2")?.status).toBe("done");
  });
});

describe("주의할 점", () => {
  it("추가·수정(위키·태그 갈아끼우기)·삭제", async () => {
    const c = cautions.newCaution({ point: "보고서 첫 줄은 결론", source: { kind: "manual" }, wikiRefs: ["weekly-report"], tags: ["report"] });
    await cautions.saveCaution(db, c);
    expect(await cautions.getCaution(db, c.id)).toEqual(c);

    const edited = { ...c, point: "결론 먼저", wikiRefs: ["report-conclusion-first", "없는-페이지"], tags: [] };
    await cautions.saveCaution(db, edited);
    expect(await cautions.getCaution(db, c.id)).toMatchObject({ point: "결론 먼저", wikiRefs: ["report-conclusion-first"], tags: [] });

    await cautions.deleteCaution(db, c.id);
    expect(await cautions.getCaution(db, c.id)).toBeUndefined();
  });

  it("다시 봤어요 → 간격 2배, 익혔어요 → 보관", async () => {
    const before = (await cautions.getCaution(db, "c1"))!;
    const review = await cautions.reviewCaution(db, "c1");
    expect(review?.intervalDays).toBe(before.review.intervalDays * 2);
    await cautions.setCautionArchived(db, "c1", true);
    expect((await cautions.getCaution(db, "c1"))?.archived).toBe(true);
  });

  it("지적받은 메모는 주의할 점이 된다", async () => {
    await memosService.addMemo(db, { id: "mt3", text: "팀장 주간보고 시간순으로 써서 반려됨 결론부터 쓰라고함" });
    await memosService.processMemo(db, "mt3");
    const memo = (await memosService.listMemos(db)).find((m) => m.id === "mt3")!;
    const action = memo.result!.actions.find((a) => a.kind === "add_caution");
    expect(action).toBeDefined();
    const id = action!.href!.split("#")[1];
    const c = await cautions.getCaution(db, id);
    expect(c).toMatchObject({ source: { kind: "memo", id: "mt3" }, by: "팀장님" });
  });
});

describe("질문 · 재배치", () => {
  it("알아올 것을 모두 채우면 질문이 해결된다", async () => {
    const q = (await records.listQuestions(db)).find((x) => x.status === "open" && x.missing.length > 0)!;
    for (let i = 0; i < q.missing.length; i++) await records.answerMissing(db, q.id, i, `답 ${i}`);
    const after = await records.getQuestion(db, q.id);
    expect(after?.status).toBe("resolved");
    expect(after?.missing.every((m) => m.done && m.answer)).toBe(true);
  });

  it("재배치는 수락한 것만 한 번 반영한다", async () => {
    const p = (await records.latestReschedule(db))!;
    const [first, ...rest] = p.items;
    const before = await items.listItems(db);
    expect(await records.applyReschedule(db, p.id, [first.itemId])).toBe(1);
    expect(await records.applyReschedule(db, p.id, [first.itemId])).toBe(0);

    const moved = (await items.getItem(db, first.itemId))!;
    expect(moved.start?.slice(0, 10)).toBe(first.toDate);
    expect(moved.priority).toBe(first.toPriority);
    for (const r of rest) {
      expect(await items.getItem(db, r.itemId)).toEqual(before.find((i) => i.id === r.itemId));
    }
    const applied = (await records.latestReschedule(db))!;
    expect(applied.appliedAt).toBeTruthy();
    expect(applied.items.find((x) => x.itemId === first.itemId)?.accepted).toBe(true);
  });
});
