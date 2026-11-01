"use client";

import { useState, useSyncExternalStore } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { browserSupportsWebAuthn } from "@simplewebauthn/browser";
import { KeyRound } from "lucide-react";
import { Button } from "@/components/ui";
import { loginWithPasskey, registerPasskey } from "./passkeyClient";

const noop = () => () => {};

/** 로그인 화면. 주소에 ?invite=… 가 있으면 첫 Passkey 등록 화면 */
export function SignedOut() {
  const router = useRouter();
  const pathname = usePathname();
  const invite = useSearchParams().get("invite") ?? undefined;
  const supported = useSyncExternalStore(noop, browserSupportsWebAuthn, () => true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function go() {
    setBusy(true);
    setError(null);
    const failed = invite ? await registerPasskey(invite) : await loginWithPasskey();
    if (failed) {
      setError(failed);
      setBusy(false);
      return;
    }
    // 레이아웃까지 새로 그려야 해서 화면 전체를 다시 불러온다 (초대 토큰은 주소에서 지움)
    if (invite) window.location.replace(pathname);
    else router.refresh();
  }

  return (
    <main className="grid min-h-dvh place-items-center px-6">
      <div className="w-full max-w-[360px] text-center">
        <div className="mx-auto grid size-11 place-items-center rounded-xl bg-accent text-[19px] font-bold text-white">n</div>
        <div className="mt-3 text-[20px] font-bold tracking-[-0.02em]">newb</div>
        {invite ? (
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            이 기기에 Passkey를 만들어요.
            <br />
            Face ID·지문·기기 암호로 확인하고, 다음부터는 이 Passkey로 로그인해요.
          </p>
        ) : (
          <p className="mt-3 text-[14px] text-muted">로그인이 필요해요.</p>
        )}
        {supported ? (
          <Button variant="primary" className="mt-6 w-full" onClick={go} disabled={busy}>
            <KeyRound className="size-4" />
            {busy ? "확인하는 중…" : invite ? "이 기기에 Passkey 만들기" : "Passkey로 로그인"}
          </Button>
        ) : (
          <p className="mt-6 text-[13.5px] text-danger">이 브라우저는 Passkey를 지원하지 않아요.</p>
        )}
        {error && (
          <p role="alert" className="mt-3 text-[13px] text-danger">
            {error}
          </p>
        )}
      </div>
    </main>
  );
}
