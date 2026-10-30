"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import clsx from "clsx";
import { ChevronDown, ChevronRight, Home, Menu, Search, ShieldAlert, X } from "lucide-react";
import { navData } from "./structure";
import { pendingRevisions, useWiki } from "./store";
import { isDue, useCautions } from "@/lib/cautionStore";

/** Next.js 문서 스타일 왼쪽 내비게이션 (검색 + 접는 장 + 페이지 트리) */
function NavTree({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  const current = pathname.startsWith("/wiki/") ? decodeURIComponent(pathname.slice(6)) : null;
  const wiki = useWiki();
  const chapters = navData(wiki.pages);
  const dueCautions = useCautions().filter(isDue).length;
  const pending = new Set(pendingRevisions(wiki).map((r) => r.slug));
  const [query, setQuery] = useState("");
  const [closed, setClosed] = useState<Set<string>>(new Set());

  const q = query.trim().toLowerCase();
  const filtered = chapters
    .map((c) => ({ ...c, pages: q ? c.pages.filter((p) => p.title.toLowerCase().includes(q)) : c.pages }))
    .filter((c) => c.pages.length > 0);

  const toggle = (cat: string) =>
    setClosed((s) => {
      const next = new Set(s);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });

  return (
    <nav className="px-4 py-5 text-[14px]">
      <div className="relative">
        <Search className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-faint" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="위키 검색"
          className="h-9 w-full rounded-lg border border-line bg-surface pr-3 pl-8 text-[14px] outline-none placeholder:text-faint focus:border-accent focus:ring-3 focus:ring-accent/15"
        />
      </div>

      <Link
        href="/wiki"
        onClick={onNavigate}
        className={clsx(
          "mt-4 flex items-center gap-2 rounded-md px-2 py-1.5",
          pathname === "/wiki" ? "font-semibold text-accent-ink" : "text-muted hover:text-ink",
        )}
      >
        <Home className="size-4" />
        위키 홈
      </Link>
      <Link
        href="/wiki/cautions"
        onClick={onNavigate}
        className={clsx(
          "flex items-center gap-2 rounded-md px-2 py-1.5",
          pathname === "/wiki/cautions" ? "font-semibold text-accent-ink" : "text-muted hover:text-ink",
        )}
      >
        <ShieldAlert className="size-4" />
        <span className="flex-1">주의할 점</span>
        {dueCautions > 0 && (
          <span className="rounded-full bg-warn-soft px-1.5 text-[11.5px] font-semibold text-warn tabular">
            {dueCautions}
          </span>
        )}
      </Link>

      <div className="mt-3 space-y-4">
        {filtered.length === 0 && <p className="px-2 text-[13px] text-faint">찾는 페이지가 없어요</p>}
        {filtered.map((c) => {
          const hasCurrent = c.pages.some((p) => p.slug === current);
          const open = q ? true : hasCurrent || !closed.has(c.category);
          return (
            <div key={c.category}>
              <button
                type="button"
                onClick={() => toggle(c.category)}
                className="flex w-full items-center justify-between rounded-md px-2 py-1 text-left text-[13.5px] font-semibold text-ink hover:bg-sunken"
                aria-expanded={open}
              >
                <span>
                  <span className="mr-1.5 text-faint tabular">{c.no}</span>
                  {c.category}
                </span>
                {open ? <ChevronDown className="size-3.5 text-faint" /> : <ChevronRight className="size-3.5 text-faint" />}
              </button>
              {open && (
                <ul className="mt-1 ml-2 border-l border-line">
                  {c.pages.map((p) => {
                    const active = p.slug === current;
                    return (
                      <li key={p.slug}>
                        <Link
                          href={`/wiki/${p.slug}`}
                          onClick={onNavigate}
                          className={clsx(
                            "-ml-px flex items-center gap-2 border-l py-[5px] pr-2 pl-3.5 text-[13.5px] leading-snug transition-colors",
                            active
                              ? "border-accent font-semibold text-accent-ink"
                              : "border-transparent text-muted hover:border-line-strong hover:text-ink",
                          )}
                        >
                          <span className="min-w-0 flex-1">{p.title}</span>
                          {pending.has(p.slug) && (
                            <span className="size-1.5 shrink-0 rounded-full bg-info" title="확인 대기" />
                          )}
                          {p.hasIssue && <span className="size-1.5 shrink-0 rounded-full bg-warn" title="점검 필요" />}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </nav>
  );
}

/** 데스크톱: 고정 사이드바 */
export function WikiSidebar() {
  return (
    <aside className="hidden w-[264px] shrink-0 border-r border-line lg:block">
      <div className="sticky top-0 h-dvh overflow-y-auto">
        <NavTree />
      </div>
    </aside>
  );
}

/** 태블릿·모바일: 상단 '위키 목차' 버튼 → 서랍 */
export function WikiMobileNav() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-line px-6 py-2 lg:hidden">
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-[13.5px] font-medium text-muted hover:bg-sunken hover:text-ink"
      >
        <Menu className="size-4" /> 위키 목차
      </button>
      {open && (
        <div className="fixed inset-0 z-40">
          <div className="absolute inset-0 bg-black/30" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-[300px] max-w-[85vw] overflow-y-auto bg-bg shadow-pop">
            <button
              type="button"
              aria-label="목차 닫기"
              onClick={() => setOpen(false)}
              className="absolute top-3 right-3 grid size-8 place-items-center rounded-md hover:bg-sunken"
            >
              <X className="size-4" />
            </button>
            <div className="pt-8">
              <NavTree onNavigate={() => setOpen(false)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
