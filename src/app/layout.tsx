import type { Metadata, Viewport } from "next";
import "pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css";
import "./globals.css";
import { Suspense } from "react";
import { AgentationToolbar } from "@/components/dev/AgentationToolbar";
import { PageSkeleton } from "@/components/PageSkeleton";
import { WorkspaceGate } from "@/components/workspace/WorkspaceGate";

/**
 * 즉시 이동(instant navigation) 검사를 끈다 — 화면 전체가 로그인 확인(WorkspaceGate) 뒤에 있어,
 * 로그인 전에는 모든 페이지 대신 로그인 화면을 그리므로 이 검사가 항상 "페이지를 그리지 않았다"고 오류를 낸다.
 * (개발 모드에서만 도는 검사라 운영 동작은 같다)
 */
export const instant = false;

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
        {/* 로그인 확인 + DB에서 작업공간을 읽는 동안 뼈대를 보여준다 (항목 사이드 패널·빠른 메모도 그 안에) */}
        <Suspense fallback={<PageSkeleton />}>
          <WorkspaceGate>{children}</WorkspaceGate>
        </Suspense>
        {/* 로그인한 사용자에게만 표시 (컴포넌트 안에서 확인) */}
        <AgentationToolbar />
      </body>
    </html>
  );
}
