import { connection } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/server/db/client";
import { loadWorkspace } from "@/server/services/workspace";
import { AppShell } from "@/components/shell/AppShell";
import { QuickMemo } from "@/components/memo/QuickMemo";
import { WorkspaceProvider } from "./WorkspaceProvider";

/**
 * 로그인 확인 → 작업공간 스냅샷을 DB에서 읽어 화면 전체에 공급 (서버 컴포넌트).
 * 개인 데이터라 요청마다 읽고, 로그인하지 않았으면 아무 데이터도 보내지 않는다.
 */
export async function WorkspaceGate({ children }: { children: React.ReactNode }) {
  await connection();
  const user = await getCurrentUser();
  if (!user) return <SignedOut />;
  const snapshot = await loadWorkspace(getDb());
  return (
    <WorkspaceProvider initial={snapshot}>
      <AppShell>{children}</AppShell>
      <QuickMemo />
    </WorkspaceProvider>
  );
}

function SignedOut() {
  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="max-w-[360px] text-center">
        <div className="text-[20px] font-bold tracking-[-0.02em]">newb</div>
        <p className="mt-3 text-[14px] text-muted">로그인이 필요해요.</p>
      </div>
    </main>
  );
}
