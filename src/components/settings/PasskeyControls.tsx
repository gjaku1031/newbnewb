"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, LogOut, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import { registerPasskey } from "@/components/auth/passkeyClient";
import { logout, removePasskey } from "@/server/authActions";

export interface PasskeyRow {
  id: string;
  name: string;
  added: string;
  lastUsed: string | null;
  synced: boolean;
  current: boolean;
}

export function PasskeyControls({ rows }: { rows: PasskeyRow[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const act = (task: () => Promise<string | null>, after: () => void = () => router.refresh()) =>
    start(async () => {
      setError(null);
      const failed = await task();
      if (failed) setError(failed);
      else after();
    });

  const onlyOne = rows.length <= 1;
  return (
    <>
      {rows.length === 0 ? (
        <div className="px-6 py-4 text-[13.5px] text-muted">등록한 Passkey가 없어요.</div>
      ) : (
        <ul className="divide-y divide-line">
          {rows.map((p) => (
            <li key={p.id} className="flex items-center gap-3 px-6 py-3.5">
              <span className="grid size-9 place-items-center rounded-lg bg-sunken text-muted">
                <KeyRound className="size-[18px]" strokeWidth={1.8} />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 text-[14px] font-medium">
                  {p.name}
                  {p.current && <span className="text-[12px] font-semibold text-accent">지금 이 로그인</span>}
                </div>
                <div className="text-[12.5px] text-muted tabular">
                  등록 {p.added}
                  {p.lastUsed && ` · 마지막 사용 ${p.lastUsed}`}
                  {p.synced && " · 다른 기기와 동기화됨"}
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label={`${p.name} Passkey 삭제`}
                title={p.current ? "지금 이 로그인에 쓴 Passkey는 지울 수 없어요" : onlyOne ? "마지막 Passkey는 지울 수 없어요" : "삭제"}
                disabled={pending || p.current || onlyOne}
                onClick={() => {
                  if (!confirm(`${p.name} Passkey를 지울까요? 그 기기에서는 다시 로그인해야 해요.`)) return;
                  act(async () => {
                    const r = await removePasskey(p.id);
                    return r.ok ? null : r.error;
                  });
                }}
              >
                <Trash2 className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
      <div className="flex flex-wrap items-center gap-2 px-6 py-3.5">
        <Button size="sm" disabled={pending} onClick={() => act(() => registerPasskey())}>
          <KeyRound className="size-3.5" />이 기기에 Passkey 추가
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={pending}
          onClick={() =>
            act(async () => {
              const r = await logout();
              return r.ok ? null : r.error;
            })
          }
        >
          <LogOut className="size-3.5" />
          로그아웃
        </Button>
        {error && (
          <p role="alert" className="w-full text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </>
  );
}
