"use client";

import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import type { Caution } from "@/lib/types";

/** 작업·위키 화면 위쪽에 띄우는 '주의할 점' 상자 */
export function CautionBox({ list, className }: { list: Caution[]; className?: string }) {
  if (list.length === 0) return null;
  return (
    <section className={`rounded-xl border border-warn/30 bg-warn-soft px-4 py-3.5 ${className ?? ""}`}>
      <div className="flex items-center justify-between gap-2">
        <h2 className="flex items-center gap-1.5 text-[13.5px] font-semibold text-warn">
          <ShieldAlert className="size-4" />
          주의할 점 <span className="tabular">{list.length}</span>
        </h2>
        <Link href="/wiki/cautions" className="text-[12.5px] text-muted hover:text-ink hover:underline">
          모두 보기
        </Link>
      </div>
      <ul className="mt-2 space-y-2">
        {list.map((c) => (
          <li key={c.id} className="text-[14px] leading-snug">
            <Link href={`/wiki/cautions#${c.id}`} className="font-medium hover:underline">
              {c.point}
            </Link>
            {c.wrong && <div className="mt-0.5 text-[12.5px] text-muted">{c.wrong}</div>}
          </li>
        ))}
      </ul>
    </section>
  );
}
