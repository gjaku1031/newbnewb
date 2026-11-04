"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Unplug } from "lucide-react";
import { Button } from "@/components/ui";
import { disconnectClaude } from "@/server/oauthActions";

export function DisconnectButton({ grantId, name }: { grantId: string; name: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <Button
      size="sm"
      variant="ghost"
      disabled={pending}
      onClick={() => {
        if (!confirm(`${name} 연결을 끊을까요? 다시 쓰려면 Claude에서 커넥터를 다시 연결해야 해요.`)) return;
        start(async () => {
          await disconnectClaude(grantId);
          router.refresh();
        });
      }}
    >
      <Unplug className="size-3.5" />
      연결 끊기
    </Button>
  );
}
