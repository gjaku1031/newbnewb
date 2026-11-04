import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { addDays, format, parseISO } from "date-fns";
import { eq } from "drizzle-orm";
import { seoulToday } from "@/lib/today";
import { briefings, rescheduleProposals, scheduledRuns, userSettings, wikiPages } from "@/server/db/schema";
import * as briefing from "@/server/services/briefing";
import { loadWorkspace } from "@/server/services/workspace";
import type { BriefingWriter } from "@/server/ai/briefing";
import { sanitizeBriefing } from "@/server/ai/briefing";
import { seedDemo } from "./fixtures/seed";
import { testDb } from "./db";

/** 아침 브리핑·지난 정리·재배치 제안·예약 실행 (가짜 Claude 서버) */

const { db, close } = testDb();
afterAll(close);
beforeEach(async () => {
  await seedDemo(db, { force: true });
  await db.delete(briefings);
  await db.delete(rescheduleProposals);
  await db.delete(scheduledRuns);
  await db.delete(userSettings);
});

const today = seoulToday();
const shift = (n: number) => format(addDays(parseISO(today), n), "yyyy-MM-dd");

describe("브리핑 만들기", () => {
  it("오늘 아침 브리핑과 어제 정리를 저장하고, 어제 만든 위키는 서버가 직접 센다", async () => {
    await db.update(wikiPages).set({ createdOn: shift(-1), updatedOn: shift(-1) }).where(eq(wikiPages.slug, "weekly-report"));
    await db.update(wikiPages).set({ nextReview: shift(5) });
    await db.update(wikiPages).set({ nextReview: shift(-2) }).where(eq(wikiPages.slug, "corporate-card"));
    const r = await briefing.generateBriefing(db);

    expect(r.morning).toMatchObject({ date: today, greeting: expect.stringContaining("좋은 아침") });
    expect(r.morning.focus.length).toBeGreaterThan(0);
    expect(r.morning.reviews.map((x) => x.slug)).toContain("corporate-card");
    expect(r.evening).toMatchObject({ date: shift(-1) });
    expect(r.evening.wikiAdded).toContain("weekly-report");

    const ws = await loadWorkspace(db);
    expect(ws.briefing.morning?.date).toBe(today);
    expect(ws.briefing.evening?.date).toBe(shift(-1));
  });

  it("다시 만들면 같은 날 브리핑을 덮어쓴다 (두 줄이 되지 않음)", async () => {
    await briefing.generateBriefing(db);
    await briefing.generateBriefing(db);
    expect(await db.select().from(briefings).where(eq(briefings.kind, "morning"))).toHaveLength(1);
  });

  it("재배치가 필요하다고 하면 제안을 만들고, 원래 날짜·우선순위를 함께 남긴다", async () => {
    const ws = await loadWorkspace(db);
    const task = ws.items.find((i) => i.kind === "task" && i.status !== "done")!;
    const writer: BriefingWriter = {
      id: "re",
      write: async () => ({
        greeting: "",
        focus: [],
        reviews: [],
        headsUp: [],
        learned: [],
        note: "",
        reschedule: { summary: "금요일에 몰려 있어요", items: [{ itemId: task.id, toDate: shift(3), toPriority: "P2", reason: "여유 있는 날로" }] },
      }),
    };
    expect((await briefing.generateBriefing(db, writer)).rescheduled).toBe(true);
    const p = (await loadWorkspace(db)).reschedule!;
    expect(p.summary).toBe("금요일에 몰려 있어요");
    expect(p.items[0]).toMatchObject({ itemId: task.id, toDate: shift(3), toPriority: "P2", fromPriority: task.priority ?? "P2" });
  });
});

describe("Claude 응답 정리 (sanitizeBriefing)", () => {
  const input = {
    today: "2026-11-04",
    weekday: "수요일",
    since: "2026-11-03",
    until: "2026-11-03",
    openItems: [
      { id: "t1", title: "보고서", kind: "task" as const },
      { id: "e1", title: "회의", kind: "event" as const, start: "2026-11-05T10:00" },
    ],
    doneItems: [],
    wikiAdded: [],
    wikiUpdated: [],
    cautions: [],
    memos: [],
    dueReviews: [{ slug: "w1", title: "위키", intervalDays: 1, nextReview: "2026-11-04" }],
    openQuestions: [],
  };
  it("없는 id·slug, 일정 옮기기, 지난 날짜·없는 날짜, 잘못된 우선순위는 버린다", () => {
    const plan = sanitizeBriefing(
      {
        greeting: " 안녕 ",
        focus: ["t1", "nope", "t1"],
        reviews: [{ slug: "w1", reason: "r" }, { slug: "ghost", reason: "r" }],
        heads_up: ["a", " ", "b", "c", "d", "e"],
        learned: [],
        note: "",
        reschedule: {
          summary: "몰림",
          items: [
            { itemId: "t1", toDate: "2026-11-06", toPriority: "P1", reason: "ok" },
            { itemId: "e1", toDate: "2026-11-06", toPriority: "P1", reason: "일정은 안 옮김" },
            { itemId: "t1", toDate: "2026-11-01", toPriority: "P1", reason: "지난 날짜" },
            { itemId: "t1", toDate: "2026-02-31", toPriority: "P1", reason: "없는 날짜" },
            { itemId: "t1", toDate: "2026-11-07", toPriority: "P9", reason: "우선순위" },
          ],
        },
      },
      input,
    );
    expect(plan.greeting).toBe("안녕");
    expect(plan.focus).toEqual(["t1"]);
    expect(plan.reviews).toEqual([{ slug: "w1", reason: "r" }]);
    expect(plan.headsUp).toEqual(["a", "b", "c", "d"]);
    expect(plan.reschedule?.items).toEqual([{ itemId: "t1", toDate: "2026-11-06", toPriority: "P1", reason: "ok" }]);
  });
});

describe("예약 실행", () => {
  it("설정한 요일·시각 전에는 안 만들고, 그 뒤엔 하루 한 번만 만든다 (동시에 불려도)", async () => {
    const weekday = parseISO(today).getDay();
    await briefing.saveSettings(db, { morningTime: "08:30", days: [weekday] });
    expect(await briefing.runScheduledBriefing(db, undefined, `${today}T08:29`)).toBe("too-early");
    const results = await Promise.all([
      briefing.runScheduledBriefing(db, undefined, `${today}T08:31`),
      briefing.runScheduledBriefing(db, undefined, `${today}T08:31`),
    ]);
    expect(results.sort()).toEqual(["already", "done"]);
    expect(await briefing.runScheduledBriefing(db, undefined, `${today}T09:00`)).toBe("already");
    const [run] = await db.select().from(scheduledRuns);
    expect(run.finishedAt).toBeTruthy();
  });

  it("고르지 않은 요일엔 만들지 않는다", async () => {
    const weekday = parseISO(today).getDay();
    await briefing.saveSettings(db, { morningTime: "00:00", days: [(weekday + 1) % 7] });
    expect(await briefing.runScheduledBriefing(db, undefined, `${today}T12:00`)).toBe("not-today");
  });

  it("Claude 키가 없으면 실패로 기록한다 (그날은 다시 돌지 않음 — 대시보드에서 직접 만들 수 있음)", async () => {
    const key = process.env.ANTHROPIC_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    try {
      await briefing.saveSettings(db, { morningTime: "00:00", days: [0, 1, 2, 3, 4, 5, 6] });
      expect(await briefing.runScheduledBriefing(db, undefined, `${today}T12:00`)).toBe("failed");
      const [run] = await db.select().from(scheduledRuns);
      expect(run.error).toContain("Claude API 키가 없어");
    } finally {
      process.env.ANTHROPIC_API_KEY = key;
    }
  });

  it("설정은 저장하고 스냅샷에 실린다 (요일은 정렬·중복 제거)", async () => {
    expect((await loadWorkspace(db)).settings).toEqual(briefing.DEFAULT_SETTINGS);
    await briefing.saveSettings(db, { morningTime: "07:40", days: [5, 1, 1, 3] });
    expect((await loadWorkspace(db)).settings).toEqual({ morningTime: "07:40", days: [1, 3, 5] });
  });
});
