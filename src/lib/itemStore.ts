"use client";

import { useSyncExternalStore } from "react";
import type { Item } from "@/lib/types";
import { DEFAULT_TAGS, type Tag } from "@/lib/items";
import { items as mockItems } from "@/mocks/items";

/**
 * 항목·태그 클라이언트 스토어 (목업용).
 * 대시보드·작업·항목 상세가 같은 데이터를 보고, 브라우저 저장소에 저장해 새로고침해도 유지된다.
 * 서버 렌더와 첫 하이드레이션은 목데이터로 그리고, 이후 저장된 값으로 다시 그린다.
 */
interface State {
  items: Item[];
  tags: Tag[];
}

const KEY = "newb.items.v1";
const SERVER: State = { items: mockItems, tags: DEFAULT_TAGS };
let state: State | null = null;
const listeners = new Set<() => void>();

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s?.items) && Array.isArray(s?.tags)) return s;
    }
  } catch {
    /* 저장소를 못 읽으면 목데이터로 */
  }
  return SERVER;
}

function get(): State {
  if (typeof window === "undefined") return SERVER;
  if (!state) state = load();
  return state;
}

function set(next: State) {
  state = next;
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* 저장이 막혀 있으면 이번 화면에서만 */
  }
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => {
    if (e.key === KEY) {
      state = load();
      l();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(l);
    window.removeEventListener("storage", onStorage);
  };
}

export function useItems(): Item[] {
  return useSyncExternalStore(
    subscribe,
    () => get().items,
    () => SERVER.items,
  );
}

export function useTags(): Tag[] {
  return useSyncExternalStore(
    subscribe,
    () => get().tags,
    () => SERVER.tags,
  );
}

export function useItem(id: string): Item | undefined {
  return useItems().find((i) => i.id === id);
}

export function updateItem(id: string, fn: (i: Item) => Item) {
  const s = get();
  set({ ...s, items: s.items.map((i) => (i.id === id ? fn(i) : i)) });
}

export function addItem(item: Omit<Item, "id" | "createdAt">): string {
  const s = get();
  const id = `n${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  const today = new Date().toISOString().slice(0, 10);
  set({ ...s, items: [...s.items, { ...item, id, createdAt: today }] });
  return id;
}

export function deleteItem(id: string) {
  const s = get();
  set({ ...s, items: s.items.filter((i) => i.id !== id) });
}

export function addTag(label: string, color: string) {
  const s = get();
  set({ ...s, tags: [...s.tags, { id: `tag-${Date.now().toString(36)}`, label, color }] });
}

export function removeTag(id: string) {
  const s = get();
  set({
    tags: s.tags.filter((t) => t.id !== id),
    items: s.items.map((i) => (i.tags.includes(id) ? { ...i, tags: i.tags.filter((t) => t !== id) } : i)),
  });
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
