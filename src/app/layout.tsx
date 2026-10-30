import { Suspense } from "react";
import type { Metadata, Viewport } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { AppShell } from "@/components/shell/AppShell";
import { AgentationToolbar } from "@/components/dev/AgentationToolbar";
import { QuickMemo } from "@/components/memo/QuickMemo";
import { ItemPeek } from "@/components/item/ItemPeek";

export const metadata: Metadata = {
  title: "newb — 신입과 함께 일하는 에이전트",
  description: "사내 문서·매뉴얼·조언을 쌓고, 확실한 답과 알아올 것을 알려주는 신입용 업무 도우미",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fbfbfa" },
    { media: "(prefers-color-scheme: dark)", color: "#141413" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full">
        <AppShell>{children}</AppShell>
        {/* ?item=… 이면 어느 화면에서든 항목 사이드 패널 */}
        <Suspense fallback={null}>
          <ItemPeek />
        </Suspense>
        {/* 로그인한 사용자에게만 표시 (컴포넌트 안에서 확인) */}
        <QuickMemo />
        <AgentationToolbar />
      </body>
    </html>
  );
}
