"use client";

import Link from "next/link";
import { GitPullRequestArrow } from "lucide-react";
import { fmt } from "@/lib/date";
import { pendingRevisions, useWiki } from "./store";

/** 위키 홈: 모순이 있어 반영 보류된 변경(확인 대기) */
export function PendingPanel() {
  const wiki = useWiki();
  const list = pendingRevisions(wiki).sort((a, b) => b.at.localeCompare(a.at));
  if (list.length === 0) return null;
  return (
    <section className="rounded-xl border border-warn/40 bg-surface">
      <h2 className="flex items-center gap-2 px-4 pt-3.5 pb-2 text-[14px] font-semibold">
        <GitPullRequestArrow className="size-4 text-warn" />
        확인 대기
        <span className="text-[12.5px] font-normal text-warn tabular">{list.length}</span>
      </h2>
      <ul className="px-2 pb-2.5">
        {list.map((r) => (
          <li key={r.id}>
            <Link href={`/wiki/${r.slug}`} className="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-sunken">
              <span className="w-7 shrink-0 font-mono text-[12px] text-muted">v{r.version}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[13.5px] font-medium">{r.after.title}</span>
                <span className="block truncate text-[12px] text-muted">{r.message}</span>
              </span>
              <span className="shrink-0 text-[12px] font-semibold text-warn">
                {r.status === "reviewing" ? "검토 중" : `모순 ${r.conflicts.length}건`}
              </span>
              <span className="w-[72px] shrink-0 text-right text-[12px] text-faint tabular">{fmt(r.at, "M/d HH:mm")}</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
