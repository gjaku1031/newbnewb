import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { items as mockItems } from "./fixtures/mocks/items";
import { memos as mockMemos } from "./fixtures/mocks/memos";
import { cautions as mockCautions } from "./fixtures/mocks/cautions";
import { questions as mockQuestions } from "./fixtures/mocks/questions";
import { rescheduleProposal } from "./fixtures/mocks/reschedule";
import { eveningBriefing, morningBriefing } from "./fixtures/mocks/briefing";
import { wikiPages as mockPages, sources as mockSources } from "./fixtures/mocks/wiki";
import { seedRevisions } from "./fixtures/mocks/wikiRevisions";
import { seedDemo } from "./fixtures/seed";
import { loadWorkspace } from "@/server/services/workspace";
import { testDb } from "./db";

/** undefined 필드·false allDay 차이를 없애고 비교 */
const norm = <T,>(v: T): T => JSON.parse(JSON.stringify(v, (k, x) => (k === "allDay" && x === false ? undefined : x)));
const byId = <T extends { id: string }>(list: T[]) => Object.fromEntries(norm(list).map((x) => [x.id, x]));

const { db, close } = testDb();
afterAll(close);

describe("시드 → 작업공간 스냅샷", () => {
  beforeAll(async () => {
    await seedDemo(db, { force: true });
  });

  it("목데이터를 그대로 돌려준다", async () => {
    const ws = await loadWorkspace(db);
    expect(byId(ws.items)).toEqual(byId(mockItems));
    expect(norm(ws.wiki.pages)).toEqual(expect.arrayContaining(norm(mockPages)));
    expect(ws.wiki.pages).toHaveLength(mockPages.length);
    expect(byId(ws.wiki.revisions)).toEqual(byId(seedRevisions()));
    expect(byId(ws.questions)).toEqual(byId(mockQuestions));
    expect(byId(ws.memos)).toEqual(byId(mockMemos));
    expect(byId(ws.cautions)).toEqual(byId(mockCautions));
    expect(norm(ws.reschedule)).toEqual(norm(rescheduleProposal));
    expect(ws.briefing).toEqual({ morning: morningBriefing, evening: eveningBriefing });
    expect(ws.wiki.sources.map((s) => s.id).sort()).toEqual(mockSources.map((s) => s.id).sort());
  });

  it("서버 전용 정보(사람 이름·내부 메모)는 스냅샷에 없다", async () => {
    const ws = await loadWorkspace(db);
    const json = JSON.stringify(ws);
    for (const name of ["박지훈", "김서연", "이민호", "최유진"]) expect(json).not.toContain(name);
    expect(json).not.toContain("internalNotes");
    for (const s of ws.wiki.sources) expect(s).not.toHaveProperty("author");
  });

  it("데이터가 있으면 다시 넣지 않는다", async () => {
    expect((await seedDemo(db)).seeded).toBe(false);
  });
});
