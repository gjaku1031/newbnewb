import "server-only";
import { isNotNull } from "drizzle-orm";
import { sources, wikiPages } from "@/server/db/schema";
import type { Exec } from "@/server/db/types";

/**
 * 위키·원본 검색 (MCP 도구용) — 질문 낱말이 제목·요약·본문·원본 글자에 얼마나 나오는지로 점수.
 * 한국어 조사는 떼고 비교한다 ("법인카드는" → "법인카드").
 */

const JOSA = /(에서|까지|부터|으로|이면|에게|한테|이랑|하고|은|는|이|가|을|를|에|로|의|도|만|와|과|랑)$/;
const STOP = new Set(["어떻게", "언제", "어디", "무엇", "뭐야", "알려줘", "있어", "해야", "하나요", "인가요", "되나요", "방법"]);

export function terms(query: string) {
  const words = (query.match(/[가-힣A-Za-z0-9]{2,}/g) ?? []).map((w) => (/[가-힣]/.test(w) && w.length > 2 ? w.replace(JOSA, "") : w).toLowerCase());
  return [...new Set(words)].filter((w) => w.length >= 2 && !STOP.has(w));
}

const hits = (text: string, w: string) => {
  let n = 0;
  for (let i = text.indexOf(w); i !== -1 && n < 5; i = text.indexOf(w, i + w.length)) n++;
  return n;
};

export interface PageHit {
  slug: string;
  title: string;
  category: string;
  summary: string;
  body: string;
  score: number;
}

export async function searchPages(db: Exec, query: string, limit = 5): Promise<PageHit[]> {
  const ws = terms(query);
  if (ws.length === 0) return [];
  const pages = await db
    .select({ slug: wikiPages.slug, title: wikiPages.title, category: wikiPages.category, summary: wikiPages.summary, body: wikiPages.body })
    .from(wikiPages);
  return pages
    .map((p) => {
      const t = p.title.toLowerCase();
      const s = p.summary.toLowerCase();
      const b = p.body.toLowerCase();
      const score = ws.reduce((acc, w) => acc + (t.includes(w) ? 6 : 0) + (s.includes(w) ? 3 : 0) + hits(b, w), 0);
      return { ...p, score };
    })
    .filter((p) => p.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

export interface SourceHit {
  id: string;
  title: string;
  excerpts: string[];
  score: number;
}

/** 원본 글자에서 낱말 주변을 잘라 온다 (원본마다 최대 3군데) */
export async function searchSources(db: Exec, query: string, limit = 3): Promise<SourceHit[]> {
  const ws = terms(query);
  if (ws.length === 0) return [];
  const rows = await db.select({ id: sources.id, title: sources.title, text: sources.text }).from(sources).where(isNotNull(sources.text));
  return rows
    .map((r) => {
      const text = r.text!;
      const lower = text.toLowerCase();
      const score = ws.reduce((acc, w) => acc + hits(lower, w) + (r.title.toLowerCase().includes(w) ? 4 : 0), 0);
      const excerpts: string[] = [];
      for (const w of ws) {
        const i = lower.indexOf(w);
        if (i === -1 || excerpts.length >= 3) continue;
        const start = Math.max(0, i - 200);
        excerpts.push(`${start > 0 ? "…" : ""}${text.slice(start, i + 300).trim()}${i + 300 < text.length ? "…" : ""}`);
      }
      return { id: r.id, title: r.title, excerpts, score };
    })
    .filter((r) => r.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
