import http from "node:http";
import type { AddressInfo } from "node:net";
import type { WikiComment } from "../src/lib/wikiTypes";
import { RuleMemoProcessor } from "./fixtures/rules/memo";
import { PatternEditor } from "./fixtures/rules/wikiEditor";
import { RuleReviewer } from "./fixtures/rules/wikiReview";

/**
 * 테스트 전용 가짜 Claude API (POST /v1/messages).
 * 앱은 키가 있는 것처럼 실제 Claude 호출 코드(SDK·구조화 출력 파싱)를 그대로 타고, 응답만 여기서 규칙 처리기로 만든다.
 * 어떤 일인지는 시스템 프롬프트로, 입력은 프롬프트의 <태그>에서 다시 읽는다.
 * ANTHROPIC_BASE_URL을 이 주소로, ANTHROPIC_API_KEY를 아무 값으로 두면 된다.
 */

type Block = { type: string; text?: string };
interface MessagesRequest {
  model: string;
  system?: string;
  messages: { role: string; content: string | Block[] }[];
}

/** <name attr="…">\n본문\n</name> 들을 순서대로 */
function tags(text: string, name: string) {
  const out: { attrs: Record<string, string>; body: string }[] = [];
  const re = new RegExp(`<${name}((?:\\s+[a-z_]+="[^"]*")*)>\\n([\\s\\S]*?)\\n</${name}>`, "g");
  for (const m of text.matchAll(re)) {
    const attrs: Record<string, string> = {};
    for (const a of m[1].matchAll(/([a-z_]+)="([^"]*)"/g)) attrs[a[1]] = a[2].replace(/&quot;/g, '"');
    out.push({ attrs, body: m[2] });
  }
  return out;
}
const one = (text: string, name: string) => tags(text, name)[0]?.body ?? "";

async function memo(text: string) {
  const today = one(text, "today").slice(0, 10);
  const pages = one(text, "wiki_pages")
    .split("\n")
    .map((l) => l.match(/^- ([^:]+): (.*?) — (.*)$/))
    .filter((m): m is RegExpMatchArray => !!m)
    .map((m) => ({ slug: m[1], title: m[2], summary: m[3] }));
  const plan = await new RuleMemoProcessor().process(one(text, "memo"), today, pages);
  const n = (v: string | undefined) => v ?? null;
  return {
    cleaned: plan.cleaned,
    events: plan.events.map((e) => ({ title: e.title, date: e.date, time: n(e.time), location: n(e.location), from: n(e.from) })),
    tasks: plan.tasks.map((t) => ({ title: t.title, due: t.due, from: n(t.from), waitingFor: n(t.waitingFor) })),
    asks: plan.asks,
    wiki: plan.wiki,
    cautions: plan.cautions.map((c) => ({ point: c.point, by: n(c.by), wikiSlug: n(c.wikiSlug) })),
  };
}

async function edit(text: string) {
  const content = {
    title: one(text, "title"),
    summary: one(text, "summary"),
    body: one(text, "body_with_line_numbers")
      .split("\n")
      .map((l) => l.replace(/^\d+\| /, ""))
      .join("\n"),
  };
  const comments = tags(one(text, "comments"), "comment").map(
    (c) =>
      ({
        id: c.attrs.id,
        text: c.body,
        anchor: c.attrs.quote ? { quote: c.attrs.quote, line: Number(c.attrs.line ?? 0) } : null,
      }) as unknown as WikiComment,
  );
  const res = await new PatternEditor().apply(content, comments);
  return { ...res.content, edits: res.edits.map((e) => ({ commentId: e.commentId, applied: e.applied, note: e.note })) };
}

async function review(text: string) {
  const parsePage = (s: string) => {
    const [head, ...rest] = s.split("\n\n");
    const [title, summary = ""] = head.split("\n");
    return { title: title.replace(/^# /, ""), summary, body: rest.join("\n\n") };
  };
  const changed = tags(text, "changed_page_after")[0];
  const after = parsePage(changed.body);
  // diff(+| 더한 줄, -| 뺀 줄)와 제목·요약 변경으로 바꾸기 전 내용을 되돌린다 — 규칙 검토기는 더한 줄만 본다
  const diff = one(text, "diff").split("\n");
  const added = new Set(diff.filter((l) => l.startsWith("+| ")).map((l) => l.slice(3)));
  const removed = diff.filter((l) => l.startsWith("-| ")).map((l) => l.slice(3));
  const was = (label: string, now: string) => diff.find((l) => l.startsWith(`${label}: `))?.slice(label.length + 2).split(" → ")[0] ?? now;
  const before = {
    title: was("제목", after.title),
    summary: was("요약", after.summary),
    body: [...after.body.split("\n").filter((l) => !added.has(l)), ...removed].join("\n"),
  };
  const pages = tags(text, "wiki_page").map((p) => ({ slug: p.attrs.slug, ...parsePage(p.body) }));
  const sources = tags(text, "source").map((s) => ({ title: s.attrs.title, content: { kind: "text" as const, text: s.body } }));
  const res = await new RuleReviewer().review({ slug: changed.attrs.slug, before, after }, pages, sources);
  return {
    conflicts: res.conflicts.map((c) => ({
      refKind: c.ref.kind,
      refSlug: c.ref.kind === "page" ? c.ref.slug : null,
      refTitle: c.ref.title,
      excerpt: c.excerpt,
      changed: c.changed,
      reason: c.reason,
    })),
  };
}

/** 원본 정리: 원본 하나 → 같은 제목의 페이지가 있으면 고치고(내용 덧붙임), 없으면 새로 만든다 */
function organize(text: string) {
  const src = tags(text, "source")[0];
  if (!src) return { note: "글자로 읽을 수 없는 원본이라 정리하지 않았어요 (가짜 Claude)", pages: [] };
  const title = src.attrs.title;
  const pages = tags(one(text, "existing_wiki"), "wiki_page").map((p) => ({ slug: p.attrs.slug, category: p.attrs.category, body: p.body }));
  const same = pages.find((p) => p.body.startsWith(`# ${title}\n`));
  const firstLine = src.body.split("\n").find((l) => l.trim()) ?? title;
  if (same) {
    const oldBody = same.body.split("\n\n").slice(2).join("\n\n");
    return {
      note: `기존 페이지에 «${title}» 내용을 더했어요`,
      pages: [{ action: "update", slug: same.slug, title, category: same.category, summary: firstLine.slice(0, 100), body: `${oldBody}\n\n${src.body}` }],
    };
  }
  const slug = `doc-${[...title].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7).toString(36)}`;
  return {
    note: `«${title}»를 새 페이지로 정리했어요`,
    pages: [{ action: "create", slug, title, category: "일반", summary: firstLine.slice(0, 100), body: src.body }],
  };
}

/** 아침 브리핑: 안 끝난 일 앞의 3개를 오늘 할 일로, 복습할 위키 앞의 3개를 복습으로 */
function briefing(text: string) {
  const ids = (name: string) =>
    one(text, name)
      .split("\n")
      .map((l) => l.match(/^- ([^ |]+) \|/)?.[1])
      .filter((x): x is string => !!x);
  const added = one(text, "since_last").split("새 위키:\n")[1]?.split("\n\n")[0] ?? "";
  return {
    greeting: "좋은 아침이에요 (가짜 Claude)",
    focus: ids("open_items").slice(0, 3),
    reviews: ids("due_reviews").slice(0, 3).map((slug) => ({ slug, reason: "다시 볼 때예요" })),
    heads_up: [],
    learned: added === "(없음)" ? [] : added.split("\n").map((l) => l.replace(/^- /, "")),
    note: "",
    reschedule: null,
  };
}

/** ask_newb: 위키 근거가 있으면 첫 페이지 첫 문장으로 답, 없으면 팀장님께 물어보라고 */
function ask(text: string) {
  const page = tags(one(text, "wiki_pages"), "wiki_page")[0];
  if (!page)
    return {
      verdict: "NEED_INFO",
      confidence: 0.2,
      rationale: "관련 위키가 없어요",
      answer: "",
      citations: [],
      missing: [{ kind: "ask_person", target: "팀장님", what: one(text, "question"), suggestedScript: "팀장님, 여쭤봐도 될까요?" }],
    };
  const line = page.body.split("\n").find((l) => l.trim() && !l.startsWith("#")) ?? page.body;
  return { verdict: "ANSWER", confidence: 0.9, rationale: "위키에 있어요", answer: line, citations: [{ wikiSlug: page.attrs.slug, excerpt: line }], missing: [] };
}

async function answer(req: MessagesRequest) {
  const system = req.system ?? "";
  const content = req.messages[0]?.content ?? "";
  const text = typeof content === "string" ? content : content.map((b) => b.text ?? "").join("\n\n");
  // 브리핑 시스템 프롬프트도 "업무 비서"로 시작하니 먼저 본다
  if (system.includes("브리핑을 씁니다")) return briefing(text);
  if (system.includes("업무 중에 물은 질문에 답합니다")) return ask(text);
  if (system.includes("업무 비서")) return memo(text);
  if (system.includes("원본 문서(사내 규정")) return organize(text);
  if (system.includes("위키의 편집자")) return edit(text);
  if (system.includes("위키의 검토자")) return review(text);
  throw new Error("가짜 Claude: 모르는 요청");
}

export async function startFakeClaude() {
  const calls: string[] = [];
  const server = http.createServer((req, res) => {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", async () => {
      if (req.method !== "POST" || !req.url?.startsWith("/v1/messages")) {
        res.writeHead(404).end();
        return;
      }
      try {
        const body = JSON.parse(raw) as MessagesRequest;
        const out = await answer(body);
        calls.push(body.system?.split("\n")[0] ?? "");
        res.writeHead(200, { "content-type": "application/json" }).end(
          JSON.stringify({
            id: `msg_fake_${calls.length}`,
            type: "message",
            role: "assistant",
            model: body.model,
            content: [{ type: "text", text: JSON.stringify(out) }],
            stop_reason: "end_turn",
            stop_sequence: null,
            usage: { input_tokens: 1, output_tokens: 1 },
          }),
        );
      } catch (error) {
        res
          .writeHead(400, { "content-type": "application/json" })
          .end(JSON.stringify({ type: "error", error: { type: "invalid_request_error", message: String(error) } }));
      }
    });
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, calls, close: () => new Promise<void>((r) => server.close(() => r())) };
}
