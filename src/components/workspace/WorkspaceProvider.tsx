"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import type { WorkspaceSnapshot } from "@/lib/workspace";
import { SnapshotContext, clearSaveError, getWorkspace, hasServerWork, refresh, seed, useSaveError } from "./store";

const POLL_MS = 1500;
const FOCUS_REFRESH_MS = 5000;

/** 서버가 내려준 작업공간 스냅샷을 화면 전체에 공급하고, 처리 중인 일이 끝날 때까지 다시 불러온다 */
export function WorkspaceProvider({ initial, children }: { initial: WorkspaceSnapshot; children: React.ReactNode }) {
  // 자식이 읽기 전에 스토어를 채운다. 서버가 더 새 스냅샷을 내려주면(다시 렌더된 경우) 그것으로 바꾼다
  seed(initial);

  useEffect(() => {
    // 숨겨진 탭에서는 폴링하지 않는다 (돌아오면 포커스 때 다시 불러옴)
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && hasServerWork(getWorkspace())) void refresh();
    }, POLL_MS);
    // 다른 기기·Claude Desktop에서 바뀐 내용은 창으로 돌아올 때 가져온다
    let last = Date.now();
    const onFocus = () => {
      if (document.visibilityState !== "visible" || Date.now() - last < FOCUS_REFRESH_MS) return;
      last = Date.now();
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  return (
    <SnapshotContext.Provider value={initial}>
      {children}
      <SaveErrorBanner />
    </SnapshotContext.Provider>
  );
}

function SaveErrorBanner() {
  const error = useSaveError();
  if (!error) return null;
  return (
    <div
      role="alert"
      className="fixed inset-x-4 bottom-4 z-[60] mx-auto flex max-w-[420px] items-center gap-3 rounded-xl border border-danger/30 bg-surface px-4 py-3 text-[13.5px] shadow-pop"
    >
      <span className="min-w-0 flex-1 text-danger">{error}</span>
      <button aria-label="닫기" onClick={clearSaveError} className="grid size-7 place-items-center rounded-md text-muted hover:bg-sunken">
        <X className="size-4" />
      </button>
    </div>
  );
}
