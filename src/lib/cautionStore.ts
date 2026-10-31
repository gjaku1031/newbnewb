"use client";

import type { Caution, Item } from "@/lib/types";
import type { WorkspaceSnapshot } from "@/lib/workspace";
import { addDays, format, parseISO } from "date-fns";
import { TODAY } from "@/lib/today";
import { applyLocal, getWorkspace, mutate, newClientId, useWorkspace } from "@/components/workspace/store";
import * as actions from "@/server/actions";

/**
 * 주의할 점 스토어 — 작업공간 스토어 위의 얇은 층 (DB cautions 테이블).
 * 메모·질문 기록·위키에서 모이고, 항목 패널·Claude 작업 지침·대시보드·위키에서 먼저 알려준다.
 */

export function useCautions(): Caution[] {
  return useWorkspace((s) => s.cautions);
}

const patch =
  (id: string, fn: (c: Caution) => Caution) =>
  (s: WorkspaceSnapshot): WorkspaceSnapshot => ({
    ...s,
    cautions: s.cautions.map((c) => (c.id === id ? fn(c) : c)),
  });

export function addCaution(c: Omit<Caution, "id" | "createdAt" | "review">): string {
  // 새로 생긴 주의할 점은 내일 한 번 더 보여준다
  const next: Caution = {
    ...c,
    id: newClientId("c"),
    createdAt: TODAY,
    review: { nextReview: format(addDays(parseISO(TODAY), 1), "yyyy-MM-dd"), intervalDays: 1 },
  };
  void mutate(
    (s) => ({ ...s, cautions: [next, ...s.cautions] }),
    () => actions.saveCaution(next),
  );
  return next.id;
}

export function updateCaution(id: string, fn: (c: Caution) => Caution) {
  const cur = getWorkspace().cautions.find((c) => c.id === id);
  if (!cur) return;
  const next = fn(cur);
  // 익혔어요·다시 알리기만 바뀐 경우는 가벼운 액션으로
  const onlyArchived = JSON.stringify({ ...cur, archived: undefined }) === JSON.stringify({ ...next, archived: undefined });
  void mutate(patch(id, () => next), () =>
    onlyArchived ? actions.setCautionArchived(id, !!next.archived) : actions.saveCaution(next),
  );
}

export function deleteCaution(id: string) {
  void mutate(
    (s) => ({ ...s, cautions: s.cautions.filter((c) => c.id !== id) }),
    () => actions.deleteCaution(id),
  );
}

const reviewing = new Set<string>();

/** 다시 봤음 → 다음에 보여줄 날을 뒤로 (날짜는 서버가 정한 값으로 맞춘다). 연달아 눌러도 한 번만 */
export async function reviewCaution(id: string) {
  if (reviewing.has(id)) return;
  reviewing.add(id);
  try {
    const review = await mutate(null, () => actions.reviewCaution(id));
    if (review) applyLocal(patch(id, (c) => ({ ...c, review })));
  } finally {
    reviewing.delete(id);
  }
}

/** 이 항목을 할 때 알려줄 주의할 점: 같은 위키를 쓰거나 같은 태그가 붙은 것 */
export function cautionsFor(list: Caution[], item: Pick<Item, "wikiRefs" | "tags">): Caution[] {
  return list.filter(
    (c) => !c.archived && (c.wikiRefs.some((w) => item.wikiRefs.includes(w)) || c.tags.some((t) => item.tags.includes(t))),
  );
}

/** 이 위키 페이지에 걸린 주의할 점 */
export function cautionsForWiki(list: Caution[], slug: string): Caution[] {
  return list.filter((c) => !c.archived && c.wikiRefs.includes(slug));
}

export const isDue = (c: Caution) => !c.archived && c.review.nextReview <= TODAY;
