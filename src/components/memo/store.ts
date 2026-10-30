"use client";

import type { Memo } from "@/lib/memoTypes";
import { NOW } from "@/lib/today";
import { mutate, newClientId, useWorkspace } from "@/components/workspace/store";
import * as actions from "@/server/actions";

/**
 * 빠른 메모 스토어 — 작업공간 스토어 위의 얇은 층.
 * 저장하면 서버가 메모를 읽고 → 일정·할 일·알아올 것·위키를 갱신 → 한 일을 메모에 기록한다.
 * 화면은 처리 중인 메모가 있는 동안 서버 값을 다시 불러와 결과를 보여준다.
 */

export function useMemos(): Memo[] {
  return useWorkspace((s) => s.memos);
}

/** 메모 저장 → 서버에서 처리 시작 */
export function addMemo(text: string): string {
  const memo: Memo = { id: newClientId("m"), text, createdAt: NOW, status: "processing" };
  void mutate(
    (s) => ({ ...s, memos: [memo, ...s.memos] }),
    () => actions.addMemo({ id: memo.id, text }),
  );
  return memo.id;
}

export function deleteMemo(id: string) {
  void mutate(
    (s) => ({ ...s, memos: s.memos.filter((m) => m.id !== id) }),
    () => actions.deleteMemo(id),
  );
}
