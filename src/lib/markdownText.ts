/**
 * 마크다운 글자 처리 (렌더와 무관한 순수 함수 — 서버·브라우저 공용).
 * [[위키링크]]는 titleOf로 페이지 제목을 찾고, 없으면 slug 그대로 둔다.
 */

export type TitleOf = (slug: string) => string | undefined;

/** ## 제목 앵커 id (본문 렌더와 '이 페이지에서' 목차가 같은 규칙을 쓴다) */
export const headingId = (n: number) => `sec-${n}`;

/** 마크다운 기호를 걷어낸 글자만 (목차 표시용) */
export function plainText(text: string, titleOf?: TitleOf) {
  return text
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/\[\[([^\]]+)\]\]/g, (_, slug: string) => titleOf?.(slug) ?? slug);
}

/** 마크다운 기호를 걷어낸 한 줄 (주석 위치 맞추기용) */
export function plainLine(line: string, titleOf?: TitleOf) {
  return plainText(line.replace(/^\s*(#{1,6}\s|>\s?|-\s|\d+\.\s)/, ""), titleOf);
}

/** 목차용: 본문의 ## 제목 목록 */
export function extractHeadings(source: string, titleOf?: TitleOf): { id: string; text: string }[] {
  return source
    .split("\n")
    .filter((l) => l.startsWith("## "))
    .map((l, n) => ({ id: headingId(n), text: plainText(l.slice(3), titleOf) }));
}
