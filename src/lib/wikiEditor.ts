import type { EditNote, PageContent, WikiComment } from "@/lib/wikiTypes";
import type { TitleOf } from "@/lib/markdownText";

/**
 * 주석대로 문서를 고치는 편집기 인터페이스. 운영에선 Claude(src/server/ai/wikiEdit.ts)가 주석을 읽고 문서를 고친다.
 * API 키가 없으면 고치지 않는다 (주석은 열린 채로 이유만 남음).
 */
export interface WikiEditor {
  id: string;
  apply(
    content: PageContent,
    comments: WikiComment[],
    titleOf?: TitleOf,
  ): Promise<{ content: PageContent; edits: EditNote[] }>;
}
