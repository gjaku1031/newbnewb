import "server-only";
import { eq } from "drizzle-orm";
import type { Caution, Item, QuestionRecord } from "@/lib/types";
import { progress, statusLabel } from "@/lib/items";
import { seoulNow, seoulToday } from "@/lib/today";
import { questions, sources, wikiPages } from "@/server/db/schema";
import { dtIn } from "@/server/db/convert";
import type { Db } from "@/server/db/types";
import { newId } from "@/server/ids";
import { CLAUDE_MODEL } from "@/server/ai/claude";
import { defaultAnswerer, type Answerer } from "@/server/ai/answer";
import { listCautions } from "@/server/services/cautions";
import { getItem, listItems } from "@/server/services/items";
import { organizeSource } from "@/server/services/sourceWiki";
import { searchPages, searchSources } from "@/server/services/search";
import type { Organizer } from "@/server/ai/organize";

/**
 * Claude Desktop(MCP) 도구의 실제 동작. 결과는 Claude가 읽을 한국어 텍스트(마크다운)로 돌려준다.
 * 화면 링크를 붙여 사용자가 newb에서 바로 열어 볼 수 있게 한다.
 */

const origin = () => (process.env.APP_ORIGIN ?? "").replace(/\/+$/, "");
const wikiUrl = (slug: string) => `${origin()}/wiki/${slug}`;

/** 항목·위키에 걸린 주의할 점 (cautionStore.cautionsFor와 같은 규칙, 서버용) */
const cautionsFor = (list: Caution[], item: Pick<Item, "wikiRefs" | "tags">) =>
  list.filter((c) => !c.archived && (c.wikiRefs.some((w) => item.wikiRefs.includes(w)) || c.tags.some((t) => item.tags.includes(t))));

/* ───────── ask_newb ───────── */

export async function askNewb(db: Db, input: { question: string; item_id?: string }, answerer: Answerer = defaultAnswerer()) {
  const question = input.question.trim().slice(0, 2000);
  const pages = await searchPages(db, question, 5);
  const found = await searchSources(db, question, 3);
  const cautions = (await listCautions(db)).filter((c) => !c.archived);
  const related = cautions.filter((c) => pages.some((p) => c.wikiRefs.includes(p.slug)) || question.split(/\s+/).some((w) => w.length >= 2 && c.point.includes(w)));

  const plan = await answerer.answer({
    question,
    today: seoulToday(),
    pages: pages.map(({ slug, title, summary, body }) => ({ slug, title, summary, body })),
    sourceExcerpts: found.map(({ title, excerpts }) => ({ title, excerpts })),
    cautions: related.slice(0, 8).map((c) => (c.by ? `${c.point} (${c.by})` : c.point)),
  });

  const itemId = input.item_id && (await getItem(db, input.item_id)) ? input.item_id : undefined;
  const record: QuestionRecord = {
    id: newId("q"),
    askedAt: seoulNow(),
    question,
    verdict: plan.verdict,
    confidence: plan.confidence,
    rationale: plan.rationale,
    answer: plan.answer,
    citations: plan.citations,
    missing: plan.missing,
    status: plan.missing.length > 0 ? "open" : "resolved",
    itemId,
    modelId: CLAUDE_MODEL,
  };
  await db.insert(questions).values({
    id: record.id,
    askedAt: dtIn(record.askedAt)!,
    question: record.question,
    verdict: record.verdict,
    confidence: record.confidence,
    rationale: record.rationale,
    answer: record.answer ?? null,
    citations: record.citations,
    missing: record.missing,
    status: record.status,
    itemId: record.itemId ?? null,
    modelId: record.modelId,
  });

  const titleOf = new Map(pages.map((p) => [p.slug, p.title]));
  const label = { ANSWER: "답할 수 있어요", ANSWER_WITH_CAVEAT: "답은 되지만 확인할 게 있어요", NEED_INFO: "근거가 모자라요" }[plan.verdict];
  const out = [`## ${label} (확신도 ${Math.round(plan.confidence * 100)}%)`];
  if (plan.answer) out.push("", plan.answer);
  if (plan.citations.length) {
    out.push("", "### 근거 (newb 위키)");
    for (const c of plan.citations) out.push(`- [${titleOf.get(c.wikiSlug) ?? c.wikiSlug}](${wikiUrl(c.wikiSlug)}): "${c.excerpt}"`);
  }
  if (plan.missing.length) {
    out.push("", "### 더 알아와야 할 것");
    for (const m of plan.missing) {
      out.push(`- ${m.target ? `${m.target}: ` : ""}${m.what}`);
      if (m.suggestedScript) out.push(`  - 이렇게 물어보세요: "${m.suggestedScript}"`);
    }
  }
  out.push("", `판단 이유: ${plan.rationale}`, `질문 기록: ${origin()}/questions/${record.id}`);
  return { record, text: out.join("\n") };
}

/* ───────── get_task_brief ───────── */

const itemLine = (i: Item) =>
  [`- \`${i.id}\` ${i.title}`, i.due ? `마감 ${i.due}` : "", i.start ? `${i.start.replace("T", " ")}` : "", i.priority ?? "", i.status ? statusLabel[i.status] : ""]
    .filter(Boolean)
    .join(" · ");

export async function taskBrief(db: Db, input: { item_id?: string }) {
  if (!input.item_id) {
    const today = seoulToday();
    const open = (await listItems(db)).filter((i) => i.kind === "task" && i.status !== "done");
    const soon = open.sort((a, b) => (a.due ?? "9999").localeCompare(b.due ?? "9999")).slice(0, 20);
    return [
      `## 아직 안 끝난 할 일 (${today} 기준, ${open.length}개 중 ${soon.length}개)`,
      ...soon.map(itemLine),
      "",
      "item_id를 넣어 다시 부르면 그 일의 작업 지침과 관련 위키·주의할 점을 줄게요.",
    ].join("\n");
  }
  const item = await getItem(db, input.item_id);
  if (!item) return `항목을 찾지 못했어요: ${input.item_id}. item_id 없이 부르면 할 일 목록을 볼 수 있어요.`;

  const pages = item.wikiRefs.length
    ? await db.select({ slug: wikiPages.slug, title: wikiPages.title, body: wikiPages.body }).from(wikiPages)
    : [];
  const refs = pages.filter((p) => item.wikiRefs.includes(p.slug));
  const cautions = cautionsFor(await listCautions(db), item);
  const pct = progress(item);

  const out = [`# ${item.title}`, "", `링크: ${origin()}/?item=${item.id}`];
  const meta = [
    item.kind === "event" ? "일정" : "할 일",
    item.due ? `마감 ${item.due}` : "",
    item.start ? `시간 ${item.start.replace("T", " ")}${item.end ? ` ~ ${item.end.slice(11)}` : ""}` : "",
    item.priority ?? "",
    item.status ? statusLabel[item.status] : "",
    pct != null ? `진행 ${pct}%` : "",
    item.from ? `받은 곳: ${item.from}` : "",
    item.location ? `장소: ${item.location}` : "",
  ].filter(Boolean);
  out.push(meta.join(" · "));
  if (item.description) out.push("", "## 설명", item.description);
  if (item.brief) out.push("", "## 작업 지침 (이대로 작업해 주세요)", item.brief);
  if (item.subItems.length) out.push("", "## 하위 항목", ...item.subItems.map((s) => `- [${s.done ? "x" : " "}] ${s.title}`));
  if (item.waitingFor) out.push("", `## 기다리는 것\n${item.waitingFor}`);
  if (cautions.length) out.push("", "## 주의할 점 (예전에 지적받은 것)", ...cautions.map((c) => `- ${c.point}${c.by ? ` — ${c.by}` : ""}`));
  for (const p of refs) out.push("", `## 관련 위키: ${p.title}`, `(${wikiUrl(p.slug)})`, "", p.body);
  return out.join("\n");
}

/* ───────── get_guidelines ───────── */

export async function guidelines(db: Db, input: { query: string }) {
  const pages = await searchPages(db, input.query, 4);
  const found = await searchSources(db, input.query, 2);
  if (pages.length === 0 && found.length === 0)
    return `"${input.query}"에 맞는 위키·원본을 찾지 못했어요. 다른 낱말로 찾아보거나, ask_newb로 물어보세요.`;
  const out: string[] = [];
  for (const p of pages) out.push(`# ${p.title}`, `(${wikiUrl(p.slug)} · ${p.category})`, "", p.summary, "", p.body, "");
  if (found.length) {
    out.push("# 원본 문서에서 찾은 부분");
    for (const s of found) out.push(`## ${s.title}`, ...s.excerpts.map((e) => `> ${e.replace(/\n/g, "\n> ")}`), "");
  }
  return out.join("\n").slice(0, 60_000);
}

/* ───────── add_to_wiki ───────── */

/** 알게 된 내용을 '메모' 원본으로 남기고, 원본 정리(Claude)가 알맞은 페이지에 넣거나 새로 만든다 */
export async function addToWiki(db: Db, input: { title: string; content: string }, organizer?: Organizer) {
  const id = newId("s");
  const title = input.title.trim().slice(0, 200) || "Claude Desktop에서 추가";
  await db.insert(sources).values({
    id,
    title,
    type: "note",
    fileType: "text",
    addedOn: seoulToday(),
    text: input.content.trim().slice(0, 100_000),
    wikiStatus: "processing",
  });
  await organizeSource(db, id, organizer);
  const [s] = await db.select({ status: sources.wikiStatus, result: sources.wikiResult }).from(sources).where(eq(sources.id, id));
  if (s?.status !== "done") return `위키에 넣지 못했어요: ${s?.result?.note ?? "알 수 없는 오류"} (원본으로는 남겨 두었어요)`;
  const r = s.result!;
  const titles = new Map(
    (await db.select({ slug: wikiPages.slug, title: wikiPages.title }).from(wikiPages)).map((p) => [p.slug, p.title]),
  );
  const line = (slug: string) => `- [${titles.get(slug) ?? slug}](${wikiUrl(slug)})`;
  const out = [r.note ?? "위키에 정리했어요."];
  if (r.created.length) out.push("", "새 페이지:", ...r.created.map(line));
  if (r.updated.length) out.push("", "고친 페이지 (모순 검토 뒤 반영 — 모순이 있으면 newb에서 확인 필요):", ...r.updated.map(line));
  if (!r.created.length && !r.updated.length) out.push("", "위키에 남길 내용이 없다고 판단했어요.");
  return out.join("\n");
}
