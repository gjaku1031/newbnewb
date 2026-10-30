"use client";

import type { Item } from "@/lib/types";
import type { Tag } from "@/lib/items";
import type { WorkspaceSnapshot } from "@/lib/workspace";
import { TODAY } from "@/lib/today";
import { getWorkspace, mutate, newClientId, useWorkspace } from "@/components/workspace/store";
import * as actions from "@/server/actions";

/**
 * 항목·태그 스토어 — 작업공간 스토어 위의 얇은 층.
 * 화면을 먼저 바꾸고 서버에 저장한다 (실패하면 서버 값으로 되돌림).
 */

export function useItems(): Item[] {
  return useWorkspace((s) => s.items);
}

export function useTags(): Tag[] {
  return useWorkspace((s) => s.tags);
}

export function useItem(id: string): Item | undefined {
  return useWorkspace((s) => s.items.find((i) => i.id === id));
}

const withItems = (fn: (items: Item[]) => Item[]) => (s: WorkspaceSnapshot) => ({ ...s, items: fn(s.items) });

export function updateItem(id: string, fn: (i: Item) => Item) {
  const cur = getWorkspace().items.find((i) => i.id === id);
  if (!cur) return;
  const next = fn(cur);
  void mutate(
    withItems((items) => items.map((i) => (i.id === id ? next : i))),
    () => actions.saveItem(next),
  );
}

export function addItem(item: Omit<Item, "id" | "createdAt">): string {
  const next: Item = { ...item, id: newClientId("n"), createdAt: TODAY };
  void mutate(
    withItems((items) => [...items, next]),
    () => actions.saveItem(next),
  );
  return next.id;
}

export function deleteItem(id: string) {
  void mutate(
    withItems((items) => items.filter((i) => i.id !== id)),
    () => actions.deleteItem(id),
  );
}

export function addTag(label: string, color: string) {
  const tag: Tag = { id: newClientId("tag-"), label, color };
  void mutate(
    (s) => ({ ...s, tags: [...s.tags, tag] }),
    () => actions.addTag(tag),
  );
}

export function removeTag(id: string) {
  void mutate(
    (s) => ({
      ...s,
      tags: s.tags.filter((t) => t.id !== id),
      items: s.items.map((i) => (i.tags.includes(id) ? { ...i, tags: i.tags.filter((t) => t !== id) } : i)),
    }),
    () => actions.removeTag(id),
  );
}

/** 하위 항목이 바뀌면 진행 상태를 맞춘다: 전부 끝나면 완료, 일부면 진행 중 */
export function withSubItems(i: Item, subItems: Item["subItems"]): Item {
  let status = i.status;
  if (subItems.length > 0) {
    const all = subItems.every((s) => s.done);
    const any = subItems.some((s) => s.done);
    if (all) status = "done";
    else if (status === "done" || (any && status === "todo")) status = "doing";
  }
  return { ...i, subItems, status };
}

/** 유형 전환: 일정 ↔ 할 일 */
export function convertKind(i: Item, kind: Item["kind"], fallbackDate: string): Item {
  if (kind === i.kind) return i;
  if (kind === "task") return { ...i, kind, status: i.status ?? "todo", priority: i.priority ?? "P3" };
  // 일정은 시간이 필요하다
  const start = i.start ?? `${fallbackDate}T09:00`;
  const end = i.end ?? (i.start ? i.start : `${fallbackDate}T10:00`);
  return { ...i, kind, start, end };
}
