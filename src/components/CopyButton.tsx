"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui";

/** 클립보드 복사 버튼 — Claude Desktop에 붙여넣을 문구용 */
export function CopyButton({
  text,
  label = "복사",
  size = "sm",
  variant = "secondary",
}: {
  text: string;
  label?: string;
  size?: "sm" | "md";
  variant?: "primary" | "secondary" | "ghost";
}) {
  const [copied, setCopied] = useState(false);
  return (
    <Button
      size={size}
      variant={variant}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
        } catch {
          // 권한이 없으면 조용히 무시 (목업)
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 1600);
      }}
    >
      {copied ? <Check className="size-3.5 text-ok" /> : <Copy className="size-3.5" />}
      {copied ? "복사됨" : label}
    </Button>
  );
}
