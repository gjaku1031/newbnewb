import "server-only";
import { format, parseISO } from "date-fns";
import { ko } from "date-fns/locale";
import { z } from "zod";
import { isRealDate } from "@/lib/date";
import type { MemoPlan, MemoProcessor, WikiPageRef } from "@/lib/memoProcessor";
import { askClaude, CLAUDE_MODEL, tag } from "./claude";

const opt = z.string().nullable();

const PlanSchema = z.object({
  cleaned: z.string(),
  events: z.array(z.object({ title: z.string(), date: z.string(), time: opt, location: opt, from: opt })),
  tasks: z.array(z.object({ title: z.string(), due: z.string(), from: opt, waitingFor: opt })),
  asks: z.array(z.string()),
  wiki: z.array(z.object({ slug: z.string(), line: z.string() })),
  cautions: z.array(z.object({ point: z.string(), by: opt, wikiSlug: opt })),
});

const SYSTEM = `당신은 회사에 막 들어온 신입사원의 업무 비서 "newb"입니다.
신입이 급하게 적은 메모(오타·줄임말·구어체 섞임)를 받아, 깔끔한 정리본과 앱에 반영할 계획을 만듭니다.

각 항목의 뜻:
- cleaned: 메모를 바르게 고쳐 쓴 정리본. 오타·줄임말을 고치고 문장을 다듬되 내용을 더하거나 빼지 않는다.
- events: 정해진 시각·날짜에 열리는 일(회의, 미팅, 면담, 교육 등). date는 YYYY-MM-DD, time은 HH:mm(24시간, 모르면 null).
- tasks: 신입이 해야 하는 일. due는 마감 YYYY-MM-DD(언급이 없으면 오늘). 무엇을 해야 하는지 불확실하면 waitingFor에 누구에게 무엇을 확인할지 적는다.
- asks: 할 일에 붙이기 어려운, 따로 알아와야 할 것.
- wiki: 앞으로도 계속 쓰일 회사 규칙·사실(예: 마감 시각, 결재 기준). 아래 위키 목록에 맞는 페이지가 있을 때만, 그 slug와 위키에 덧붙일 한 문장을 적는다. 맞는 페이지가 없으면 비워 둔다.
- cautions: 지적받은 것·실수한 것. point는 "다음엔 이렇게 한다" 형태의 올바른 방법 한 문장. 관련 위키 페이지가 있으면 wikiSlug.

규칙:
- 화면에 사람 이름을 보이지 않는다. from·by·title에는 이름 대신 직책(팀장님, 선임님, 책임님, 사수 등)을 쓴다.
- "내일", "다음 주 화요일" 같은 상대 날짜는 오늘 날짜를 기준으로 실제 날짜로 바꾼다. 존재하지 않는 날짜·시각은 쓰지 않는다.
- 메모에 없는 일정·할 일을 지어내지 않는다. 해당 없는 목록은 빈 배열로 둔다.
- 모든 글은 한국어로 쓴다.`;

/** 날짜·시각·slug를 검증하고, 형식이 틀린 값은 버리거나 안전한 값으로 바꾼다 */
export function sanitizePlan(raw: z.infer<typeof PlanSchema>, today: string, pages: WikiPageRef[]): MemoPlan {
  const slugs = new Set(pages.map((p) => p.slug));
  const date = (d: string) => (/^\d{4}-\d{2}-\d{2}$/.test(d) && isRealDate(d) ? d : today);
  const time = (t: string | null) => (t && /^([01]\d|2[0-3]):[0-5]\d$/.test(t) ? t : undefined);
  const text = (s: string | null) => s?.trim() || undefined;
  return {
    cleaned: raw.cleaned.trim(),
    events: raw.events
      .filter((e) => e.title.trim())
      .map((e) => ({ title: e.title.trim(), date: date(e.date), time: time(e.time), location: text(e.location), from: text(e.from) })),
    tasks: raw.tasks
      .filter((t) => t.title.trim())
      .map((t) => ({ title: t.title.trim(), due: date(t.due), from: text(t.from), waitingFor: text(t.waitingFor) })),
    asks: raw.asks.map((a) => a.trim()).filter(Boolean),
    wiki: raw.wiki.filter((w) => slugs.has(w.slug) && w.line.trim()).map((w) => ({ slug: w.slug, line: w.line.trim() })),
    cautions: raw.cautions
      .filter((c) => c.point.trim())
      .map((c) => ({ point: c.point.trim(), by: text(c.by), wikiSlug: c.wikiSlug && slugs.has(c.wikiSlug) ? c.wikiSlug : undefined })),
  };
}

export class ClaudeMemoProcessor implements MemoProcessor {
  id = `claude-memo@${CLAUDE_MODEL}`;

  async process(text: string, today: string, pages: WikiPageRef[]): Promise<MemoPlan> {
    const wikiList = pages.map((p) => `- ${p.slug}: ${p.title} — ${p.summary}`).join("\n") || "(위키 페이지 없음)";
    const raw = await askClaude({
      system: SYSTEM,
      content: [
        tag("today", format(parseISO(today), "yyyy-MM-dd (EEEE)", { locale: ko })),
        tag("wiki_pages", wikiList),
        tag("memo", text),
        "위 메모를 정리하고 계획을 만들어 주세요.",
      ].join("\n\n"),
      schema: PlanSchema,
      effort: "medium",
    });
    return sanitizePlan(raw, today, pages);
  }
}

/** 메모 처리기 — Claude (키가 없으면 처리 때 ClaudeUnavailableError) */
export const defaultMemoProcessor = (): MemoProcessor => new ClaudeMemoProcessor();
