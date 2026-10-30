import { wikiPages } from "@/mocks/wiki";
import type { WikiPage } from "@/lib/types";

/** 장(카테고리) 순서. 목록에 없는 카테고리는 뒤에 가나다순 */
const CHAPTER_ORDER = ["보고·문서", "업무 시스템", "재무·경비", "커뮤니케이션", "거래처", "보안"];

export interface WikiChapter {
  no: number;
  category: string;
  pages: WikiPage[];
}

export function wikiChapters(): WikiChapter[] {
  const byCat = new Map<string, WikiPage[]>();
  for (const p of wikiPages) {
    const list = byCat.get(p.category) ?? [];
    list.push(p);
    byCat.set(p.category, list);
  }
  const rank = (c: string) => {
    const i = CHAPTER_ORDER.indexOf(c);
    return i === -1 ? Number.MAX_SAFE_INTEGER : i;
  };
  const cats = [...byCat.keys()].sort((a, b) => rank(a) - rank(b) || a.localeCompare(b, "ko"));
  return cats.map((category, i) => ({
    no: i + 1,
    category,
    pages: [...byCat.get(category)!].sort((a, b) => a.title.localeCompare(b.title, "ko")),
  }));
}

/** 장·절 순서대로 펼친 페이지 목록 (이전/다음 이동용) */
export function orderedPages() {
  return wikiChapters().flatMap((c) =>
    c.pages.map((p, i) => ({ page: p, number: `${c.no}.${i + 1}`, chapter: c })),
  );
}

/** 왼쪽 내비게이션에 넘길 가벼운 데이터 (클라이언트 컴포넌트용) */
export interface NavChapter {
  no: number;
  category: string;
  pages: { slug: string; title: string; number: string; hasIssue: boolean }[];
}

export function navData(): NavChapter[] {
  return wikiChapters().map((c) => ({
    no: c.no,
    category: c.category,
    pages: c.pages.map((p, i) => ({
      slug: p.slug,
      title: p.title,
      number: `${c.no}.${i + 1}`,
      hasIssue: !!p.issues?.length,
    })),
  }));
}
