import { WikiMobileNav, WikiSidebar } from "@/components/wiki/WikiNav";
import { navData } from "@/components/wiki/structure";

/** 위키 공통 레이아웃: Next.js 문서처럼 왼쪽 문서 내비게이션 + 본문 */
export default function WikiLayout({ children }: LayoutProps<"/wiki">) {
  const chapters = navData();
  return (
    <div className="flex min-h-dvh">
      <WikiSidebar chapters={chapters} />
      <div className="min-w-0 flex-1">
        <WikiMobileNav chapters={chapters} />
        {children}
      </div>
    </div>
  );
}
