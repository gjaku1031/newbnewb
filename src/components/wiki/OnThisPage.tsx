"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";

/** 오른쪽 '이 페이지에서' 목차 — 스크롤 위치에 따라 현재 절을 강조 */
export function OnThisPage({ headings }: { headings: { id: string; text: string }[] }) {
  const [active, setActive] = useState<string | null>(headings[0]?.id ?? null);

  useEffect(() => {
    const els = headings.map((h) => document.getElementById(h.id)).filter((el): el is HTMLElement => !!el);
    if (els.length === 0) return;
    const visible = new Map<string, number>();
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) visible.set(e.target.id, e.boundingClientRect.top);
          else visible.delete(e.target.id);
        }
        if (visible.size) setActive([...visible.entries()].sort((a, b) => a[1] - b[1])[0][0]);
      },
      { rootMargin: "0px 0px -70% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <div>
      <div className="mb-2 text-[12.5px] font-semibold text-ink">이 페이지에서</div>
      <ul className="space-y-1.5 text-[13px]">
        {headings.map((h) => (
          <li key={h.id}>
            <a
              href={`#${h.id}`}
              className={clsx(
                "block leading-snug transition-colors",
                active === h.id ? "font-medium text-accent-ink" : "text-muted hover:text-ink",
              )}
            >
              {h.text}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
