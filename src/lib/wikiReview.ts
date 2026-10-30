import type { Conflict, PageContent, ReviewResult } from "@/lib/wikiTypes";
import { diffLines } from "@/lib/diff";

/**
 * 위키 변경 검토기 — Decision model처럼 인터페이스로 분리.
 * 실제 서비스에선 Claude가 위키 전체를 읽고 모순을 찾는 구현체로 바꾼다.
 */
export interface WikiChange {
  slug: string;
  before: PageContent;
  after: PageContent;
}

export interface WikiReviewer {
  id: string;
  review(change: WikiChange, allPages: (PageContent & { slug: string })[]): Promise<ReviewResult>;
}

/* ───────── 목업 구현: 숫자·금액·기한 규칙 ───────── */

type FactKind = "money" | "time" | "deadline" | "percent";
interface Fact {
  kind: FactKind;
  norm: string;
}

const KIND_LABEL: Record<FactKind, string> = { money: "금액", time: "시간", deadline: "기한", percent: "비율" };

/** 원본 문서에서 뽑아 둔 사실 (목업) — 실제로는 원본 텍스트 검색 */
const SOURCE_FACTS: { title: string; text: string }[] = [
  { title: "법인카드 사용 규정 (2026 개정)", text: "1회 50만원 초과 사용 시 사전 품의 필요" },
  { title: "법인카드 사용 규정 (2026 개정)", text: "증빙은 익월 3일까지 ERP 입력 및 영수증 업로드" },
  { title: "법인카드 사용 규정 (2026 개정)", text: "접대비 1인당 10만원 초과 시 팀장 승인" },
  { title: "주간보고 양식", text: "매주 금요일 17:00까지 팀장에게 메일로 제출" },
  { title: "ERP 경비처리 가이드", text: "카드 사용분 경비청구는 익월 3일까지" },
  { title: "신입사원 업무 매뉴얼 v3.2", text: "외부 손님 미팅 회의실은 하루 전까지 예약" },
];

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

  async review(change: WikiChange, allPages: (PageContent & { slug: string })[]): Promise<ReviewResult> {
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
    for (const f of SOURCE_FACTS) refs.push({ ref: { kind: "source", title: f.title }, text: f.text });

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

/** 지금 쓰는 검토기 (구현체 교체 지점) */
export const wikiReviewer: WikiReviewer = new RuleReviewer();
