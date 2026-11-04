"use client";

import { useMemo } from "react";
import type { TitleOf } from "@/lib/markdownText";
import { useWorkspace } from "./store";

/** 작업공간에서 자주 찾는 것들 (전부 스냅샷 안의 값을 그대로 돌려준다) */

export const useWikiPages = () => useWorkspace((s) => s.wiki.pages);
export const useSources = () => useWorkspace((s) => s.wiki.sources);
export const useQuestions = () => useWorkspace((s) => s.questions);
export const useQuestion = (id: string) => useWorkspace((s) => s.questions.find((q) => q.id === id));
export const useBriefing = () => useWorkspace((s) => s.briefing);
export const useReschedule = () => useWorkspace((s) => s.reschedule);
/** Claude API 키가 있는지 (없으면 메모 정리·위키 반영이 돌지 않음) */
export const useClaudeEnabled = () => useWorkspace((s) => s.claude);

/** [[위키링크]] → 페이지 제목 */
export function useTitleOf(): TitleOf {
  const pages = useWikiPages();
  return useMemo(() => {
    const m = new Map(pages.map((p) => [p.slug, p.title]));
    return (slug: string) => m.get(slug);
  }, [pages]);
}
