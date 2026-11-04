import type { PageContent, ReviewResult } from "@/lib/wikiTypes";

/**
 * 위키 변경 검토기 인터페이스. 운영에선 Claude(src/server/ai/wikiReview.ts)가 위키 전체와 원본 문서를 읽고 모순을 찾는다.
 * API 키가 없으면 검토하지 않는다 (변경은 '확인 필요'로 남음).
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
