import { WikiMobileNav, WikiSidebar } from "@/components/wiki/WikiNav";

/** 위키 공통 레이아웃: Next.js 문서처럼 왼쪽 문서 내비게이션 + 본문 */
export default function WikiLayout({ children }: LayoutProps<"/wiki">) {
  return (
    <div className="flex min-h-dvh">
      <WikiSidebar />
      <div className="min-w-0 flex-1">
        <WikiMobileNav />
        {children}
      </div>
    </div>
  );
}
