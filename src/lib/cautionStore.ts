"use client";

import { useSyncExternalStore } from "react";
import { addDays, format, parseISO } from "date-fns";
import type { Caution, Item } from "@/lib/types";
import { cautions as SEED } from "@/mocks/cautions";
import { TODAY } from "@/mocks/today";
import { nextInterval } from "@/components/ReviewDoneButton";

/**
 * 주의할 점 클라이언트 스토어 (목업: 브라우저 저장). 실제로는 DB cautions 테이블.
 * 메모·질문 기록·위키에서 모이고, 항목 패널·Claude 작업 지침·대시보드·위키에서 먼저 알려준다.
 */
const KEY = "newb.cautions.v1";
let state: Caution[] | null = null;
const listeners = new Set<() => void>();

function load(): Caution[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (Array.isArray(s)) return s;
    }
  } catch {
    /* 저장소를 못 읽으면 목데이터로 */
  }
  return SEED;
}

function get(): Caution[] {
  if (typeof window === "undefined") return SEED;
  if (!state) state = load();
  return state;
}

function set(next: Caution[]) {
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

export function useCautions(): Caution[] {
  return useSyncExternalStore(subscribe, get, () => SEED);
}

export function addCaution(c: Omit<Caution, "id" | "createdAt" | "review">): string {
  const id = `c${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
  // 새로 생긴 주의할 점은 내일 한 번 더 보여준다
  const review = { nextReview: format(addDays(parseISO(TODAY), 1), "yyyy-MM-dd"), intervalDays: 1 };
  set([{ ...c, id, createdAt: TODAY, review }, ...get()]);
  return id;
}

export function updateCaution(id: string, fn: (c: Caution) => Caution) {
  set(get().map((c) => (c.id === id ? fn(c) : c)));
}

export function deleteCaution(id: string) {
  set(get().filter((c) => c.id !== id));
}

/** 다시 봤음 → 다음에 보여줄 날을 뒤로 */
export function reviewCaution(id: string) {
  updateCaution(id, (c) => {
    const intervalDays = nextInterval(c.review.intervalDays);
    return { ...c, review: { intervalDays, nextReview: format(addDays(parseISO(TODAY), intervalDays), "yyyy-MM-dd") } };
  });
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
