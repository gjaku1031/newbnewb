import { addDays, format, nextDay, parseISO, type Day } from "date-fns";
import { isRealDate } from "@/lib/date";
import type { MemoPlan, MemoProcessor, WikiPageRef } from "@/lib/memoProcessor";

/**
 * 테스트 전용 규칙 기반 메모 처리기 — 결과가 매번 같아야 하는 테스트에서 Claude 대신 쓴다.
 * 앱은 쓰지 않는다 (e2e는 가짜 Claude 서버가 이걸로 응답).
 */

/* ───────── 규칙 기반 처리기 (API 키가 없을 때) ───────── */

/** 자주 나는 오타·줄임말 */
const FIXES: [RegExp, string][] = [
  [/회의싱/g, "회의실"],
  [/햬/g, "해"],
  [/모르겟/g, "모르겠"],
  [/됬/g, "됐"],
  [/낼(?=\s|$)/g, "내일"],
  [/월욜/g, "월요일"],
  [/화욜/g, "화요일"],
  [/수욜/g, "수요일"],
  [/목욜/g, "목요일"],
  [/금욜/g, "금요일"],
  [/법카/g, "법인카드"],
  [/팀장(?!님)/g, "팀장님"],
  [/선임(?!님)/g, "선임님"],
  [/책임(?!님)/g, "책임님"],
  [/(한다고|하라고|해오라고|라고|하래|한대|해야)(함|됨)/g, "$1 $2"],
  [/잘\s?모르겠음/g, "잘 모르겠음"],
  [/\s+/g, " "],
];

/** 정리본: 접속어 앞에서 문장을 끊고 끝에 마침표 */
function toSentences(t: string) {
  const s = t
    .replace(/\s*(근데|그리고|그래서|아 그리고)\s+/g, ". $1 ")
    .replace(/(함|됨|음|래|대|요)\s+(?=[가-힣0-9])/g, "$1. ")
    .replace(/\.\s*\./g, ".")
    .trim();
  return /[.?!]$/.test(s) ? s : `${s}.`;
}

const ROLE = /(팀장님|선임님|책임님|과장님|부장님|대리님|사수)/;
const EVENT_WORD = /(회의|미팅|면담|교육|발표|1:1|워크숍)/;
const TASK_VERB = /(해\s?오라|해와|준비|제출|보내|작성|정리|챙겨|만들어|올려)/;
const UNSURE = /(모르겠|모름|헷갈|뭔지|뭘|뭐뭐|확실하지|애매)/;
const WEEKDAY: Record<string, Day> = { 일: 0, 월: 1, 화: 2, 수: 3, 목: 4, 금: 5, 토: 6 };

/** 페이지 제목에 흔히 붙는 말 — 이것만 겹쳐서는 같은 주제로 보지 않는다 */
const GENERIC_TITLE_WORDS = new Set(["사용", "규정", "가이드", "양식", "방법", "안내", "정리", "기본", "관련", "업무", "개정"]);

/** 메모에 위키 페이지 제목의 낱말이 들어 있으면 그 페이지 (가장 많이 겹치는 것). 없으면 undefined */
function matchPage(text: string, pages: WikiPageRef[]): string | undefined {
  let best: string | undefined;
  let bestScore = 0;
  for (const p of pages) {
    const words = (p.title.match(/[가-힣A-Za-z0-9]{2,}/g) ?? []).filter((w) => !GENERIC_TITLE_WORDS.has(w));
    const score = words.filter((w) => text.includes(w)).length;
    if (score > bestScore) {
      best = p.slug;
      bestScore = score;
    }
  }
  return best;
}
const MISTAKE = /(지적|혼났|혼남|실수|틀렸|틀림|반려|다시 (써|해|하)|주의하래|하지 말래|하지 말라|빠뜨|까먹)/;
const FACT = /(래|한대|라고 함|해야 ?(함|돼|된대)|이래|바뀐)/;

function fixTypos(text: string) {
  let t = text.trim();
  for (const [re, to] of FIXES) t = t.replace(re, to);
  return t;
}

function findDate(t: string, today: string): string {
  const base = parseISO(today);
  if (/모레/.test(t)) return format(addDays(base, 2), "yyyy-MM-dd");
  if (/내일/.test(t)) return format(addDays(base, 1), "yyyy-MM-dd");
  const md = t.match(/(\d{1,2})\s*[월/]\s*(\d{1,2})\s*일?/);
  if (md) {
    // "3/40", "13월 2일"처럼 없는 날짜는 날짜로 보지 않는다
    const d = `${today.slice(0, 4)}-${md[1].padStart(2, "0")}-${md[2].padStart(2, "0")}`;
    if (isRealDate(d)) return d;
  }
  const wd = t.match(/(다음\s?주\s?)?([일월화수목금토])요일/);
  if (wd) {
    const d = nextDay(base, WEEKDAY[wd[2]]);
    return format(wd[1] && d.getTime() - base.getTime() < 7 * 864e5 ? addDays(d, 7) : d, "yyyy-MM-dd");
  }
  return today;
}

function findTime(t: string): string | undefined {
  const m = t.match(/(오전|오후|아침|저녁|밤)?\s*(\d{1,2})\s*시(\s*(\d{1,2})\s*분|\s*반)?/);
  if (!m) return undefined;
  let h = Number(m[2]);
  const pm = m[1] === "오후" || m[1] === "저녁" || m[1] === "밤";
  if (pm && h < 12) h += 12;
  if (!m[1] && h >= 1 && h <= 6) h += 12; // "3시 회의" → 오후 3시
  const min = m[4] ? Number(m[4]) : m[3]?.includes("반") ? 30 : 0;
  if (h > 23 || min > 59) return undefined; // "오후 13시", "25시" 같은 없는 시각
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function findLocation(t: string): string | undefined {
  const m = t.match(/([가-힣A-Za-z0-9]+\s?(?:층\s?)?[가-힣A-Za-z0-9]*(?:회의실|교육장|라운지|카페|팀장실|대회의실|소회의실|실|층))\s*에서/);
  return m ? m[1].trim() : undefined;
}

export class RuleMemoProcessor implements MemoProcessor {
  id = "rule-memo@v0";

  async process(text: string, today: string, pages: WikiPageRef[] = []): Promise<MemoPlan> {
    const cleaned = toSentences(fixTypos(text));
    const plan: MemoPlan = { cleaned, events: [], tasks: [], asks: [], wiki: [], cautions: [] };
    const role = cleaned.match(ROLE)?.[1];
    const date = findDate(cleaned, today);
    const time = findTime(cleaned);
    const location = findLocation(cleaned);
    const ev = cleaned.match(EVENT_WORD)?.[1];

    if (ev) {
      plan.events.push({ title: role ? `${ev} (${role})` : ev, date, time, location, from: role });
      if (!location && /어디서|장소/.test(cleaned)) plan.asks.push(`${ev} 장소 확인`);
    }

    if (TASK_VERB.test(cleaned)) {
      const unsure = UNSURE.test(cleaned);
      const what = ev ? `${ev} 준비` : "요청받은 일";
      plan.tasks.push({
        title: unsure ? `${what} (내용 확인 필요)` : what,
        due: date,
        from: role ? `${role} 지시` : "메모",
        waitingFor: unsure ? `무엇을 준비해야 하는지 ${role ?? "담당자"}께 확인` : undefined,
      });
    } else if (UNSURE.test(cleaned)) {
      plan.asks.push(`${ev ?? "메모 내용"} 관련해서 모르는 부분 ${role ?? "담당자"}께 확인`);
    }

    // 지적·실수 → 주의할 점 (실제로는 Claude가 '맞는 방법' 한 줄로 요약)
    if (MISTAKE.test(cleaned)) {
      const wikiSlug = matchPage(cleaned, pages);
      plan.cautions.push({ point: cleaned, by: role, wikiSlug });
      return plan;
    }

    if (FACT.test(cleaned)) {
      const slug = matchPage(cleaned, pages);
      if (slug) plan.wiki.push({ slug, line: cleaned });
    }
    return plan;
  }
}

