import type { Conflict, PageContent, ReviewResult } from "@/lib/wikiTypes";
import { diffLines } from "@/lib/diff";

/**
 * 위키 변경 검토기 인터페이스. 운영에선 Claude(src/server/ai/wikiReview.ts)가 위키 전체와 원본 문서를 읽고 모순을 찾는다.
 * API 키가 없으면 아래 규칙 기반 검토기 (숫자·금액·기한만 비교).
 */
export interface WikiChange {
  slug: string;
  before: PageContent;
  after: PageContent;
}

/** 바뀐 페이지에 붙은 원본 문서 — 읽을 수 있는 형식만 내용이 들어 있다 */
export interface ReviewSource {
  title: string;
  content?: { kind: "text"; text: string } | { kind: "pdf"; base64: string } | { kind: "image"; mediaType: "image/png" | "image/jpeg"; base64: string };
}

export interface WikiReviewer {
  id: string;
  review(change: WikiChange, allPages: (PageContent & { slug: string })[], sources: ReviewSource[]): Promise<ReviewResult>;
}

/* ───────── 규칙 기반 검토기: 숫자·금액·기한 ───────── */

type FactKind = "money" | "time" | "deadline" | "percent";
interface Fact {
  kind: FactKind;
  norm: string;
}

const KIND_LABEL: Record<FactKind, string> = { money: "금액", time: "시간", deadline: "기한", percent: "비율" };

const plain = (s: string) =>
  s
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, "$1")
    .replace(/^\s*(#{1,6}\s|>\s?|-\s|\d+\.\s)/, "")
    .trim();

function facts(text: string): Fact[] {
  const out: Fact[] = [];
  for (const m of text.matchAll(/(\d[\d,]*)\s*(만\s*)?원(?!칙)/g))
    out.push({ kind: "money", norm: `${m[1].replace(/,/g, "")}${m[2] ? "만" : ""}원` });
  for (const m of text.matchAll(/(\d{1,2}):(\d{2})/g)) out.push({ kind: "time", norm: `${Number(m[1])}:${m[2]}` });
  for (const m of text.matchAll(/(\d{1,2})\s*시(?![간작대])/g)) out.push({ kind: "time", norm: `${Number(m[1])}:00` });
  for (const m of text.matchAll(/익월\s*(\d{1,2})\s*일/g)) out.push({ kind: "deadline", norm: `익월 ${Number(m[1])}일` });
  for (const m of text.matchAll(/(하루|\d+\s*일)\s*전/g))
    out.push({ kind: "deadline", norm: `${m[1] === "하루" ? 1 : parseInt(m[1])}일 전` });
  for (const m of text.matchAll(/(\d+)\s*%/g)) out.push({ kind: "percent", norm: `${m[1]}%` });
  return out;
}

const STOP = new Set(["필요", "초과", "이상", "이하", "경우", "기본", "그때", "하면", "있으면", "모든", "관련"]);
const JOSA = /(에서|까지|으로|이면|께서|에게|은|는|이|가|을|를|에|로|의|도|만|께|과|와|면)$/;

/** 숫자·단위(만원, 시, 익월 N일…)는 주제어에서 뺀다 — "만원" 같은 단위가 공통어로 잡히지 않게 */
const VALUE_RE = /\d[\d,]*\s*(만\s*)?원|\d+\s*%|\d{1,2}:\d{2}|\d{1,2}\s*시|익월\s*\d{1,2}\s*일|(하루|\d+\s*일)\s*전|\d+\s*(회|인당|장|일|개)/g;

function topics(text: string): Set<string> {
  const set = new Set<string>();
  for (const w of text.replace(VALUE_RE, " ").match(/[가-힣]{2,}/g) ?? []) {
    const t = w.length > 2 ? w.replace(JOSA, "") : w;
    if (t.length >= 2 && !STOP.has(t)) set.add(t);
  }
  return set;
}

const sentences = (c: PageContent) =>
  [c.title, ...c.summary.split(/(?<=[.。])\s+/), ...c.body.split("\n")].map(plain).filter(Boolean);

export class RuleReviewer implements WikiReviewer {
  id = "rule-reviewer@v1";

  async review(change: WikiChange, allPages: (PageContent & { slug: string })[], sources: ReviewSource[] = []): Promise<ReviewResult> {
    // 1) 바뀐(추가된) 문장
    const added: string[] = [];
    if (change.after.title !== change.before.title) added.push(plain(change.after.title));
    if (change.after.summary !== change.before.summary)
      added.push(...change.after.summary.split(/(?<=[.。])\s+/).map(plain));
    for (const l of diffLines(change.before.body, change.after.body)) if (l.type === "add") added.push(plain(l.text));
    const changed = added.filter((s) => s && facts(s).length > 0);

    // 2) 비교할 근거 문장: 같은 페이지의 안 바뀐 문장 + 다른 페이지 + 원본 문서
    const addedSet = new Set(added);
    const refs: { ref: Conflict["ref"]; text: string }[] = [];
    for (const s of sentences(change.after)) if (!addedSet.has(s)) refs.push({ ref: { kind: "self", title: change.after.title }, text: s });
    for (const p of allPages)
      if (p.slug !== change.slug)
        for (const s of sentences(p)) refs.push({ ref: { kind: "page", slug: p.slug, title: p.title }, text: s });
    // 원본 문서는 글자로 읽을 수 있는 것만 (PDF·이미지는 Claude 검토기에서)
    for (const src of sources)
      if (src.content?.kind === "text")
        for (const line of src.content.text.split(/\n+/).map(plain).filter(Boolean))
          refs.push({ ref: { kind: "source", title: src.title }, text: line });

    // 3) 같은 주제(공통 단어)인데 같은 종류의 값이 다르면 모순
    const conflicts: Conflict[] = [];
    const seen = new Set<string>();
    for (const c of changed) {
      const cFacts = facts(c);
      const cTopics = topics(c);
      for (const r of refs) {
        // 같은 주제 = 공통 단어 2개 이상 (단어 하나만 겹치면 우연일 수 있음)
        const shared = [...topics(r.text)].filter((t) => cTopics.has(t)).length;
        if (shared < 2) continue;
        const rFacts = facts(r.text);
        for (const cf of cFacts) {
          const same = rFacts.filter((rf) => rf.kind === cf.kind);
          if (same.length === 0 || same.some((rf) => rf.norm === cf.norm)) continue;
          const key = `${r.ref.title}|${r.text}|${cf.kind}`;
          if (seen.has(key)) continue;
          seen.add(key);
          conflicts.push({
            ref: r.ref,
            excerpt: r.text,
            changed: c,
            reason: `${KIND_LABEL[cf.kind]} 다름 · ${same[0].norm} ↔ ${cf.norm}`,
          });
        }
      }
    }

    return {
      conflicts,
      summary: conflicts.length ? `모순 ${conflicts.length}건` : "모순 없음",
      reviewerId: this.id,
    };
  }
}
