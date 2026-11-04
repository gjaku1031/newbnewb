import "server-only";
import { z } from "zod";
import { isRealDate } from "@/lib/date";
import { PRIORITY_ORDER } from "@/lib/items";
import type { Priority } from "@/lib/types";
import { askClaude, CLAUDE_MODEL, tag } from "./claude";

/**
 * 아침 브리핑 + 지난 정리 + (필요하면) 재배치 제안을 Claude 한 번으로.
 * 숫자로 셀 수 있는 것(끝낸 일, 새 위키, 알아올 것)은 서버가 채우고, Claude는 고르고·설명하고·제안만 한다.
 */

export interface BriefingInput {
  today: string;
  weekday: string;
  /** 지난 정리가 다루는 기간 (보통 어제) */
  since: string;
  until: string;
  openItems: {
    id: string;
    title: string;
    kind: "event" | "task";
    start?: string;
    end?: string;
    due?: string;
    priority?: Priority;
    status?: string;
    progress?: number | null;
    from?: string;
    waitingFor?: string;
    nextSubItem?: string;
  }[];
  doneItems: { id: string; title: string }[];
  wikiAdded: { slug: string; title: string }[];
  wikiUpdated: { slug: string; title: string }[];
  cautions: { point: string; by?: string }[];
  memos: string[];
  dueReviews: { slug: string; title: string; intervalDays: number; nextReview: string }[];
  openQuestions: { id: string; question: string }[];
}

export interface BriefingPlan {
  greeting: string;
  focus: string[];
  reviews: { slug: string; reason: string }[];
  headsUp: string[];
  learned: string[];
  note: string;
  reschedule: { summary: string; items: { itemId: string; toDate: string; toPriority: Priority; reason: string }[] } | null;
}

export interface BriefingWriter {
  id: string;
  write(input: BriefingInput): Promise<BriefingPlan>;
}

const Schema = z.object({
  greeting: z.string(),
  focus: z.array(z.string()),
  reviews: z.array(z.object({ slug: z.string(), reason: z.string() })),
  heads_up: z.array(z.string()),
  learned: z.array(z.string()),
  note: z.string(),
  reschedule: z
    .object({
      summary: z.string(),
      items: z.array(z.object({ itemId: z.string(), toDate: z.string(), toPriority: z.string(), reason: z.string() })),
    })
    .nullable(),
});

const SYSTEM = `당신은 회사에 막 들어온 신입사원의 업무 비서 "newb"입니다. 매일 아침 대시보드에 보여줄 브리핑을 씁니다.
입력: 오늘 날짜, 아직 안 끝난 일정·할 일, 지난 기간에 끝낸 일·새로 쓴 위키·지적받은 것·메모, 오늘 복습할 위키, 아직 답을 못 찾은 질문.

쓸 것:
- greeting: 오늘 무엇이 제일 중요한지 담은 짧은 인사 한 문장.
- focus: 오늘 먼저 할 일 id 최대 3개 (open_items에 있는 id만). 마감·우선순위·이미 잡힌 일정을 보고 고른다.
- reviews: 오늘 복습할 위키 최대 3개 (due_reviews에 있는 slug만). reason은 왜 오늘 다시 보면 좋은지 한 줄 (예: 오늘 할 일과 관련, 처음 배운 지 1일).
- heads_up: "미리 알아두기" 최대 4개. 오늘·내일 일정에서 챙길 것, 다가오는 마감, 지적받은 것 중 오늘 일과 관련된 것. 각 한 문장.
- learned: 지난 기간에 새로 배운 것 최대 4개 (새 위키·지적받은 것·메모에서). 각 한 문장.
- note: 지난 기간을 돌아보는 격려 한 문장. 지난 기간에 한 일이 없으면 빈 문자열.
- reschedule: 앞으로 7일 안에 일이 한 날에 몰리거나 마감을 지키기 어려워 보일 때만, 옮기거나 우선순위를 바꿀 할 일을 제안한다(최대 5개, toDate는 YYYY-MM-DD로 오늘 이후, toPriority는 P0~P5, reason은 한 줄, summary는 무엇이 문제인지 한 문장). 일정(kind=event)은 옮기지 않는다. 문제가 없으면 null.

규칙:
- 입력에 없는 일·사실을 지어내지 않는다. 해당 없는 목록은 빈 배열.
- 사람 이름은 쓰지 않고 직책으로 쓴다.
- 모든 글은 한국어로, 짧고 구체적으로.`;

const lines = (rows: string[]) => rows.join("\n") || "(없음)";

export class ClaudeBriefingWriter implements BriefingWriter {
  id = `claude-briefing@${CLAUDE_MODEL}`;

  async write(input: BriefingInput): Promise<BriefingPlan> {
    const item = (i: BriefingInput["openItems"][number]) =>
      [
        `- ${i.id} | ${i.kind === "event" ? "일정" : "할 일"} | ${i.title}`,
        i.start ? `시작 ${i.start}` : "",
        i.due ? `마감 ${i.due}` : "",
        i.priority ?? "",
        i.status ? `상태 ${i.status}` : "",
        i.progress != null ? `진행 ${i.progress}%` : "",
        i.nextSubItem ? `다음 단계: ${i.nextSubItem}` : "",
        i.waitingFor ? `기다리는 것: ${i.waitingFor}` : "",
        i.from ? `받은 곳: ${i.from}` : "",
      ]
        .filter(Boolean)
        .join(" | ");
    const raw = await askClaude({
      system: SYSTEM,
      content: [
        tag("today", `${input.today} (${input.weekday})`),
        tag("open_items", lines(input.openItems.map(item))),
        tag(
          "since_last",
          [
            `기간: ${input.since} ~ ${input.until}`,
            `끝낸 일:\n${lines(input.doneItems.map((d) => `- ${d.title}`))}`,
            `새 위키:\n${lines(input.wikiAdded.map((w) => `- ${w.title}`))}`,
            `고친 위키:\n${lines(input.wikiUpdated.map((w) => `- ${w.title}`))}`,
            `지적받은 것:\n${lines(input.cautions.map((c) => `- ${c.point}${c.by ? ` (${c.by})` : ""}`))}`,
            `메모:\n${lines(input.memos.map((m) => `- ${m}`))}`,
          ].join("\n\n"),
        ),
        tag("due_reviews", lines(input.dueReviews.map((r) => `- ${r.slug} | ${r.title} | ${r.intervalDays}일마다 | 복습일 ${r.nextReview}`))),
        tag("open_questions", lines(input.openQuestions.map((q) => `- ${q.question}`))),
        "오늘 아침 브리핑을 써 주세요.",
      ].join("\n\n"),
      schema: Schema,
      effort: "medium",
    });
    return sanitizeBriefing(raw, input);
  }
}

/** 없는 id·slug, 지난 날짜, 잘못된 우선순위는 버린다 */
export function sanitizeBriefing(raw: z.infer<typeof Schema>, input: BriefingInput): BriefingPlan {
  const open = new Map(input.openItems.map((i) => [i.id, i]));
  const due = new Set(input.dueReviews.map((r) => r.slug));
  const text = (s: string) => s.trim();
  const list = (xs: string[], n: number) => xs.map(text).filter(Boolean).slice(0, n);
  const reschedule = raw.reschedule
    ? raw.reschedule.items
        .filter((c) => {
          const it = open.get(c.itemId);
          return (
            it &&
            it.kind === "task" &&
            /^\d{4}-\d{2}-\d{2}$/.test(c.toDate) &&
            isRealDate(c.toDate) &&
            c.toDate >= input.today &&
            (PRIORITY_ORDER as string[]).includes(c.toPriority)
          );
        })
        .slice(0, 5)
        .map((c) => ({ itemId: c.itemId, toDate: c.toDate, toPriority: c.toPriority as Priority, reason: text(c.reason) }))
    : [];
  return {
    greeting: text(raw.greeting),
    focus: [...new Set(raw.focus)].filter((id) => open.has(id)).slice(0, 3),
    reviews: raw.reviews.filter((r) => due.has(r.slug)).slice(0, 3).map((r) => ({ slug: r.slug, reason: text(r.reason) })),
    headsUp: list(raw.heads_up, 4),
    learned: list(raw.learned, 4),
    note: text(raw.note),
    reschedule: raw.reschedule && reschedule.length ? { summary: text(raw.reschedule.summary), items: reschedule } : null,
  };
}

/** 브리핑 작성기 — Claude (키가 없으면 ClaudeUnavailableError) */
export const defaultBriefingWriter = (): BriefingWriter => new ClaudeBriefingWriter();
