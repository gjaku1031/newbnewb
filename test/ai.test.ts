import { beforeEach, describe, expect, it, vi } from "vitest";
import { RuleMemoProcessor } from "@/lib/memoProcessor";
import { PatternEditor } from "@/lib/wikiEditor";
import { RuleReviewer } from "@/lib/wikiReview";
import type { WikiComment } from "@/lib/wikiTypes";

/** Claude 처리기: 실제 API 대신 가짜 응답을 넣고, 응답을 앱에 맞게 검증·정리하는지 본다 */

const { askClaude } = vi.hoisted(() => ({ askClaude: vi.fn() }));
vi.mock("@/server/ai/claude", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/ai/claude")>()),
  askClaude,
}));

const { ClaudeMemoProcessor, defaultMemoProcessor } = await import("@/server/ai/memo");
const { ClaudeEditor, defaultEditor } = await import("@/server/ai/wikiEdit");
const { ClaudeReviewer, defaultReviewer } = await import("@/server/ai/wikiReview");

beforeEach(() => askClaude.mockReset());

const pages = [
  { slug: "weekly-report", title: "주간보고", summary: "매주 금요일 제출" },
  { slug: "corporate-card", title: "법인카드", summary: "사용 규정" },
];

describe("API 키가 없으면", () => {
  it("규칙 처리기로 돌아간다", () => {
    expect(defaultMemoProcessor()).toBeInstanceOf(RuleMemoProcessor);
    expect(defaultEditor()).toBeInstanceOf(PatternEditor);
    expect(defaultReviewer()).toBeInstanceOf(RuleReviewer);
  });
});

describe("Claude 메모 처리기", () => {
  it("위키 목록과 메모를 넘기고, 없는 날짜·시각·페이지는 걸러낸다", async () => {
    askClaude.mockResolvedValue({
      cleaned: " 내일 3시 회의. ",
      events: [
        { title: "회의 (팀장님)", date: "2026-11-02", time: "15:00", location: null, from: "팀장님" },
        { title: "없는 날", date: "2026-02-31", time: "25:00", location: " ", from: null },
        { title: " ", date: "2026-11-02", time: null, location: null, from: null },
      ],
      tasks: [{ title: "자료 준비", due: "11/3", from: "팀장님 지시", waitingFor: "" }],
      asks: ["", "장소 확인"],
      wiki: [
        { slug: "weekly-report", line: "16:30까지 제출" },
        { slug: "made-up", line: "지어낸 페이지" },
      ],
      cautions: [{ point: "결재선 확인", by: "선임님", wikiSlug: "made-up" }],
    });
    const plan = await new ClaudeMemoProcessor().process("낼 3시 회의", "2026-11-01", pages);

    const prompt = askClaude.mock.calls[0][0].content as string;
    expect(prompt).toContain("weekly-report: 주간보고");
    expect(prompt).toContain("낼 3시 회의");
    expect(prompt).toContain("2026-11-01 (일요일)");

    expect(plan.cleaned).toBe("내일 3시 회의.");
    expect(plan.events).toEqual([
      { title: "회의 (팀장님)", date: "2026-11-02", time: "15:00", location: undefined, from: "팀장님" },
      { title: "없는 날", date: "2026-11-01", time: undefined, location: undefined, from: undefined },
    ]);
    expect(plan.tasks).toEqual([{ title: "자료 준비", due: "2026-11-01", from: "팀장님 지시", waitingFor: undefined }]);
    expect(plan.asks).toEqual(["장소 확인"]);
    expect(plan.wiki).toEqual([{ slug: "weekly-report", line: "16:30까지 제출" }]);
    expect(plan.cautions).toEqual([{ point: "결재선 확인", by: "선임님", wikiSlug: undefined }]);
  });
});

describe("Claude 위키 편집기", () => {
  const content = { title: "주간보고", summary: "매주 금요일 제출", body: "## 마감\n- 17:00까지" };
  const comment = (id: string, text: string): WikiComment => ({
    id,
    slug: "weekly-report",
    anchor: { quote: "17:00까지", line: 1 },
    text,
    at: "2026-11-01T10:00",
    status: "open",
  });

  it("줄 번호를 붙여 넘기고, 결과가 없는 주석은 반영 못 함으로 남긴다", async () => {
    askClaude.mockResolvedValue({
      title: "주간보고",
      summary: "",
      body: "## 마감\n- 16:30까지",
      edits: [
        { commentId: "c1", applied: true, note: "'17:00' → '16:30'" },
        { commentId: "모르는-id", applied: true, note: "?" },
      ],
    });
    const { content: after, edits } = await new ClaudeEditor().apply(content, [comment("c1", "16:30으로"), comment("c2", "???")]);

    expect(askClaude.mock.calls[0][0].content).toContain("1| - 17:00까지");
    expect(after).toEqual({ title: "주간보고", summary: "매주 금요일 제출", body: "## 마감\n- 16:30까지" });
    expect(edits).toEqual([
      { commentId: "c1", applied: true, note: "'17:00' → '16:30'" },
      { commentId: "c2", applied: false, note: "반영하지 못함" },
    ]);
  });

  it("DB에 들어가지 않을 만큼 긴 제목이면 실패로 본다", async () => {
    askClaude.mockResolvedValue({ title: "가".repeat(300), summary: "", body: "", edits: [] });
    await expect(new ClaudeEditor().apply(content, [comment("c1", "제목 바꿔")])).rejects.toThrow("너무 길어요");
  });
});

describe("Claude 위키 검토기", () => {
  it("원본 문서를 블록으로 넘기고, 없는 페이지를 가리킨 모순은 링크 없이 남긴다", async () => {
    askClaude.mockResolvedValue({
      conflicts: [
        { refKind: "page", refSlug: "corporate-card", refTitle: "아무거나", excerpt: "a", changed: "b", reason: "금액 다름" },
        { refKind: "page", refSlug: "made-up", refTitle: "지어낸 페이지", excerpt: "c", changed: "d", reason: "기한 다름" },
      ],
    });
    const before = { title: "주간보고", summary: "", body: "- 17:00까지" };
    const after = { ...before, body: "- 16:30까지" };
    const res = await new ClaudeReviewer().review(
      { slug: "weekly-report", before, after },
      [
        { slug: "weekly-report", ...after },
        { slug: "corporate-card", title: "법인카드", summary: "", body: "50만원" },
      ],
      [
        { title: "규정.pdf", content: { kind: "pdf", base64: "JVBERi0=" } },
        { title: "양식", content: { kind: "text", text: "금요일 17:00" } },
        { title: "엑셀 자료" },
      ],
    );

    const blocks = askClaude.mock.calls[0][0].content as { type: string; text?: string; title?: string }[];
    expect(blocks.some((b) => b.type === "document" && b.title === "규정.pdf")).toBe(true);
    const text = blocks.map((b) => b.text ?? "").join("\n");
    expect(text).toContain("금요일 17:00");
    expect(text).toContain("제목만): 엑셀 자료");
    expect(text).toContain("-| - 17:00까지\n+| - 16:30까지");

    expect(res.conflicts.map((c) => c.ref)).toEqual([
      { kind: "page", slug: "corporate-card", title: "법인카드" },
      { kind: "source", title: "지어낸 페이지" },
    ]);
    expect(res.summary).toBe("모순 2건");
  });
});

describe("규칙 기반 처리기 (API 키 없을 때) — 목데이터 없이 실제 데이터만 본다", () => {
  it("메모는 실제 위키 페이지 제목으로만 연결하고, 페이지가 없으면 연결하지 않는다", async () => {
    const memo = "주간보고 마감이 16시로 바뀐대";
    const pages = [
      { slug: "weekly", title: "주간보고 작성법", summary: "" },
      { slug: "card", title: "법인카드 사용 규정", summary: "" },
    ];
    expect((await new RuleMemoProcessor().process(memo, "2026-11-04", pages)).wiki.map((w) => w.slug)).toEqual(["weekly"]);
    expect((await new RuleMemoProcessor().process(memo, "2026-11-04", [])).wiki).toEqual([]);
  });

  it("위키 검토는 실제로 올린 원본 문서(텍스트)와만 비교한다", async () => {
    const before = { title: "법인카드", summary: "", body: "- 증빙 제출" };
    const after = { title: "법인카드", summary: "", body: "- 증빙 제출\n- 법인카드 증빙은 익월 5일까지 ERP 입력" };
    const change = { slug: "card", before, after };
    // 원본이 없으면 비교할 근거도 없다 (예전처럼 지어낸 규정과 비교하지 않음)
    expect((await new RuleReviewer().review(change, [], [])).conflicts).toEqual([]);
    const sources = [{ title: "법인카드 규정.txt", content: { kind: "text" as const, text: "법인카드 증빙은 익월 3일까지 ERP 입력" } }];
    const { conflicts } = await new RuleReviewer().review(change, [], sources);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]).toMatchObject({ ref: { kind: "source", title: "법인카드 규정.txt" }, reason: "기한 다름 · 익월 3일 ↔ 익월 5일" });
  });
});
