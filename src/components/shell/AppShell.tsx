"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  BookOpen,
  NotebookPen,
  ListChecks,
  MessageCircleQuestion,
  Settings,
  Sun,
  Shuffle,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from "lucide-react";
import { useEffect, useState, useSyncExternalStore } from "react";

/* 데스크톱 사이드바 접힘 상태 — 브라우저에 기억 (Ctrl/⌘ + \ 로 토글) */
const COLLAPSE_KEY = "newb.sidebar.collapsed";
const COLLAPSE_EVENT = "newb-sidebar";
function readCollapsed() {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}
function subscribeCollapsed(cb: () => void) {
  window.addEventListener(COLLAPSE_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(COLLAPSE_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}
function setCollapsedStored(v: boolean) {
  try {
    localStorage.setItem(COLLAPSE_KEY, v ? "1" : "0");
  } catch {
    /* 저장이 막혀 있으면 이번 화면에서만 */
  }
  window.dispatchEvent(new Event(COLLAPSE_EVENT));
}

const NAV = [
  { href: "/", label: "오늘", icon: Sun },
  { href: "/tasks", label: "작업", icon: ListChecks },
  { href: "/wiki", label: "위키", icon: BookOpen },
  { href: "/memos", label: "메모", icon: NotebookPen },
  { href: "/questions", label: "질문 기록", icon: MessageCircleQuestion },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function SidebarContent({ onNavigate, onCollapse }: { onNavigate?: () => void; onCollapse?: () => void }) {
  const pathname = usePathname();
  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2.5 px-4 pt-5 pb-4">
        <div className="grid size-8 place-items-center rounded-lg bg-accent text-[15px] font-bold text-white">
          n
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold">newb</div>
          <div className="text-[11.5px] text-muted">신입 업무 도우미</div>
        </div>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="사이드바 접기"
            title="사이드바 접기 (Ctrl + \\)"
            className="ml-auto grid size-7 place-items-center rounded-md text-faint hover:bg-black/[0.05] hover:text-ink dark:hover:bg-white/[0.06]"
          >
            <PanelLeftClose className="size-4" />
          </button>
        )}
      </div>

      <nav className="flex flex-col gap-0.5 px-2">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              onClick={onNavigate}
              className={clsx(
                "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[14px] transition-colors",
                active
                  ? "bg-surface font-medium text-ink shadow-card ring-1 ring-line"
                  : "text-muted hover:bg-black/[0.035] hover:text-ink dark:hover:bg-white/[0.04]",
              )}
            >
              <Icon className={clsx("size-[17px]", active ? "text-accent" : "")} strokeWidth={1.9} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mx-2 mt-5">
        <Link
          href="/reschedule"
          onClick={onNavigate}
          className="flex items-start gap-2.5 rounded-lg border border-dashed border-line-strong px-3 py-2.5 text-[13px] hover:bg-surface"
        >
          <Shuffle className="mt-0.5 size-4 shrink-0 text-warn" strokeWidth={2} />
          <span>
            <span className="font-medium">재배치 제안 1건</span>
            <span className="block text-[12px] text-muted">이번 주 P0~P1이 몰려 있어요</span>
          </span>
        </Link>
      </div>

      <div className="mt-auto space-y-1 p-2">
        <Link
          href="/settings"
          onClick={onNavigate}
          className={clsx(
            "flex items-center gap-2.5 rounded-md px-2.5 py-[7px] text-[14px]",
            isActive(pathname, "/settings")
              ? "bg-surface font-medium text-ink ring-1 ring-line"
              : "text-muted hover:bg-black/[0.035] hover:text-ink dark:hover:bg-white/[0.04]",
          )}
        >
          <Settings className="size-[17px]" strokeWidth={1.9} />
          설정
        </Link>
        {/* TODO(MCP): 실제 연결 상태 */}
        <Link
          href="/settings#claude"
          onClick={onNavigate}
          className="block rounded-lg bg-surface px-3 py-2.5 ring-1 ring-line hover:bg-black/[0.02] dark:hover:bg-white/[0.03]"
        >
          <div className="flex items-center gap-2 text-[12.5px] font-medium text-muted">
            <span className="inline-flex size-2 rounded-full bg-faint" />
            Claude Desktop 연결 전
          </div>
        </Link>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const collapsed = useSyncExternalStore(subscribeCollapsed, readCollapsed, () => false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "\\") {
        e.preventDefault();
        setCollapsedStored(!readCollapsed());
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="flex min-h-dvh">
      {/* 데스크톱 사이드바 (접기 가능) */}
      <aside
        className={clsx(
          "hidden shrink-0 overflow-hidden bg-sidebar transition-[width] duration-200 lg:block",
          collapsed ? "w-0" : "w-[232px] border-r border-line",
        )}
      >
        <div className="sticky top-0 h-dvh w-[232px]">
          <SidebarContent onCollapse={() => setCollapsedStored(true)} />
        </div>
      </aside>
      {collapsed && (
        <button
          type="button"
          onClick={() => setCollapsedStored(false)}
          aria-label="사이드바 펼치기"
          title="사이드바 펼치기 (Ctrl + \\)"
          className="fixed top-3 left-3 z-30 hidden size-8 place-items-center rounded-md border border-line bg-surface text-muted shadow-card hover:text-ink lg:grid"
        >
          <PanelLeftOpen className="size-4" />
        </button>
      )}

      {/* 태블릿/모바일: 상단 바 + 서랍 */}
      <div className="fixed inset-x-0 top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-bg/90 px-3 backdrop-blur lg:hidden">
        <button
          aria-label="메뉴 열기"
          onClick={() => setOpen(true)}
          className="grid size-9 place-items-center rounded-md hover:bg-sunken"
        >
          <Menu className="size-5" />
        </button>
        <span className="text-[15px] font-semibold">newb</span>
      </div>
      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <aside className="absolute inset-y-0 left-0 w-[260px] bg-sidebar shadow-pop">
            <button
              aria-label="메뉴 닫기"
              onClick={() => setOpen(false)}
              className="absolute top-4 right-3 grid size-8 place-items-center rounded-md hover:bg-sunken"
            >
              <X className="size-4" />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className={clsx("min-w-0 flex-1 pt-12 lg:pt-0", collapsed && "lg:pl-8")}>
        {/* 넓은 모니터에서 무한히 늘어나지 않도록 최대 폭 */}
        <div className="mx-auto w-full max-w-[1400px]">{children}</div>
      </main>
    </div>
  );
}
