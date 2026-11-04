"use client";

import { createContext, useContext, useSyncExternalStore } from "react";
import type { WorkspaceSnapshot } from "@/lib/workspace";
import { syncClock } from "@/lib/today";

/**
 * 작업공간 클라이언트 스토어.
 *
 * - 처음 값은 서버가 렌더할 때 내려준 스냅샷 (WorkspaceProvider가 seed)
 * - 바꿀 때는 화면을 먼저 바꾸고(낙관적 업데이트) 서버 액션으로 저장한다
 * - 저장이 실패하면 서버 값으로 다시 불러와 되돌리고 오류를 띄운다
 * - 서버에서 처리 중인 일(위키 검토·메모 처리)이 있으면 끝날 때까지 주기적으로 다시 불러온다
 */

export const SnapshotContext = createContext<WorkspaceSnapshot | null>(null);

let state: WorkspaceSnapshot | null = null;
/** 서버에 저장 중인 변경 수 */
let pending = 0;
/** 화면에서 바꾼 횟수 — 다시 불러오는 사이에 바뀌었는지 알아보는 데 쓴다 */
let changeSeq = 0;
let refreshQueued = false;
let inFlight: Promise<boolean> | null = null;
let saveError: string | null = null;
const listeners = new Set<() => void>();

const emit = () => listeners.forEach((l) => l());

function subscribe(l: () => void) {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
}

/** 서버 스냅샷 받기 — 브라우저에서만 저장 (서버의 모듈 상태는 요청끼리 공유되므로 쓰지 않는다) */
export function seed(snap: WorkspaceSnapshot) {
  syncClock(snap.now);
  if (typeof window === "undefined") return;
  if (!state || (snap.version > state.version && pending === 0)) state = snap;
}

export function getWorkspace(): WorkspaceSnapshot {
  if (!state) throw new Error("작업공간이 아직 준비되지 않았어요");
  return state;
}

/** 작업공간 일부를 읽는 hook. select는 스냅샷 안의 값을 그대로 골라야 한다 (새 배열을 만들지 말 것) */
export function useWorkspace<T>(select: (s: WorkspaceSnapshot) => T): T {
  const initial = useContext(SnapshotContext);
  if (!initial) throw new Error("WorkspaceProvider 밖에서 작업공간을 읽었어요");
  return useSyncExternalStore(
    subscribe,
    () => select(state ?? initial),
    () => select(initial),
  );
}

/* ───────── 바꾸기 ───────── */

/**
 * 낙관적 업데이트 + 서버 저장.
 * apply는 화면에 바로 반영할 변경, remote는 서버 액션 호출.
 */
export async function mutate<R>(apply: ((s: WorkspaceSnapshot) => WorkspaceSnapshot) | null, remote: () => Promise<R>) {
  changeSeq++;
  if (apply && state) {
    state = apply(state);
    emit();
  }
  pending++;
  try {
    const result = await remote();
    return result;
  } catch (error) {
    console.error("[workspace] 저장 실패", error);
    setSaveError("저장하지 못했어요. 서버에 저장된 값으로 되돌렸어요.");
    refreshQueued = true;
    return undefined;
  } finally {
    pending--;
    if (pending === 0 && refreshQueued) void refresh();
  }
}

/** 서버가 이미 저장한 값을 화면에만 반영 (서버 응답으로 받은 값 맞추기) */
export function applyLocal(apply: (s: WorkspaceSnapshot) => WorkspaceSnapshot) {
  if (!state) return;
  state = apply(state);
  emit();
}

/**
 * 서버 스냅샷으로 다시 불러오기. 받아서 화면에 반영했으면 true.
 * - 저장 중인 변경이 있으면 끝난 뒤로 미룬다
 * - 이미 받는 중이면 그 요청을 같이 기다린다 (폴링·포커스가 겹쳐도 요청이 쌓이지 않게)
 */
export function refresh(): Promise<boolean> {
  if (pending > 0) {
    refreshQueued = true;
    return Promise.resolve(false);
  }
  inFlight ??= load().finally(() => {
    inFlight = null;
    if (refreshQueued && pending === 0) void refresh();
  });
  return inFlight;
}

async function load(): Promise<boolean> {
  refreshQueued = false;
  const seqAtStart = changeSeq;
  try {
    const res = await fetch("/api/workspace", { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const snap: WorkspaceSnapshot = await res.json();
    // 받는 사이에 화면에서 바꾼 게 있으면(저장이 이미 끝났더라도) 이 스냅샷은 그 변경을 모를 수 있다 → 다시 받는다
    if (changeSeq !== seqAtStart || pending > 0) {
      refreshQueued = true;
      return false;
    }
    if (state && snap.version < state.version) return false;
    state = snap;
    syncClock(snap.now);
    emit();
    return true;
  } catch (error) {
    console.error("[workspace] 다시 불러오기 실패", error);
    if (saveError) setSaveError("저장하지 못했고 서버 값도 불러오지 못했어요. 연결을 확인한 뒤 새로고침해 주세요.");
    return false;
  }
}

/** 서버에서 아직 처리 중인 일이 있는지 */
export function hasServerWork(s: WorkspaceSnapshot) {
  return (
    s.wiki.revisions.some((r) => r.status === "reviewing") ||
    s.memos.some((m) => m.status === "processing") ||
    s.wiki.sources.some((src) => src.wiki?.status === "processing")
  );
}

/* ───────── 저장 오류 표시 ───────── */

const errorListeners = new Set<() => void>();

function setSaveError(msg: string | null) {
  saveError = msg;
  errorListeners.forEach((l) => l());
}

export const clearSaveError = () => setSaveError(null);

export function useSaveError() {
  return useSyncExternalStore(
    (l) => {
      errorListeners.add(l);
      return () => {
        errorListeners.delete(l);
      };
    },
    () => saveError,
    () => null,
  );
}

/* ───────── 공통 ───────── */

/** 화면에서 새로 만드는 것의 id (서버 검증 규칙 ^[A-Za-z0-9_-]{1,64}$ 와 맞춘다) */
export function newClientId(prefix = "") {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}
