import type { WikiPage } from "@/lib/types";
import type { PageContent, Revision } from "@/lib/wikiTypes";
import { wikiPages } from "@/mocks/wiki";

/** 위키 과거 변경 이력 목데이터 (시드용) */
const content = (p: WikiPage): PageContent => ({ title: p.title, summary: p.summary, body: p.body });
const EMPTY: PageContent = { title: "", summary: "", body: "" };

/** 목데이터 과거 이력 */
export function seedRevisions(): Revision[] {
  const out: Revision[] = [];
  for (const p of wikiPages) {
    const cur = content(p);
    if (p.slug === "corporate-card") {
      const v1: PageContent = {
        ...cur,
        summary: cur.summary.replace("50만원", "30만원"),
        body: cur.body.replace("50만원", "30만원").replace(/\n## 접대비[\s\S]*?(?=\n## 증빙)/, ""),
      };
      const v2: PageContent = { ...cur, body: cur.body.replace(/\n## 접대비[\s\S]*?(?=\n## 증빙)/, "") };
      out.push(rev(p.slug, 1, "2026-10-22T09:10", "claude", "원본 문서로 생성", EMPTY, v1));
      out.push(rev(p.slug, 2, "2026-10-22T09:12", "claude", "2026 개정판 병합", v1, v2));
      out.push(rev(p.slug, 3, "2026-10-29T15:40", "me", "접대비 항목 추가", v2, cur));
    } else if (p.slug === "weekly-report") {
      const v1: PageContent = { ...cur, body: cur.body.replace(/\n\n## 자주 하는 실수[\s\S]*$/, "") };
      out.push(rev(p.slug, 1, "2026-10-24T10:05", "claude", "원본 문서로 생성", EMPTY, v1));
      out.push(rev(p.slug, 2, "2026-10-28T18:20", "me", "자주 하는 실수 추가", v1, cur));
    } else {
      out.push(rev(p.slug, 1, `${p.createdAt}T09:00`, "claude", "원본 문서로 생성", EMPTY, cur));
    }
  }
  return out;
}

function rev(
  slug: string,
  version: number,
  at: string,
  author: Revision["author"],
  message: string,
  before: PageContent,
  after: PageContent,
): Revision {
  return {
    id: `${slug}-v${version}`,
    slug,
    version,
    at,
    author,
    status: "applied",
    message,
    before,
    after,
    conflicts: [],
  };
}

