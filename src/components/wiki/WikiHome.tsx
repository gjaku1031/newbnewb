"use client";

import { useState } from "react";
import Link from "next/link";
import { ReviewDoneButton } from "@/components/ReviewDoneButton";
import { AlertTriangle, ArrowRight, Brain, Clock, Inbox, Loader2, Unlink } from "lucide-react";
import type { Source } from "@/lib/types";
import { mutate, refresh } from "@/components/workspace/store";
import * as actions from "@/server/actions";
import { fmt } from "@/lib/date";
import { TODAY } from "@/lib/today";
import { useSources, useWikiPages } from "@/components/workspace/hooks";
import { FileIcon, IntervalPill, SourceTypeBadge } from "./badges";
import { wikiChapters } from "./structure";
import { PendingPanel } from "./PendingPanel";

const issueMeta = {
  conflict: { label: "근거 충돌", icon: AlertTriangle, cls: "text-danger" },
  stale: { label: "오래된 내용", icon: Clock, cls: "text-warn" },
  orphan: { label: "연결 없음", icon: Unlink, cls: "text-muted" },
} as const;

function Panel({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-line bg-surface">
      <h2 className="flex items-center gap-2 px-4 pt-3.5 pb-2 text-[14px] font-semibold">
        <span className="text-muted">{icon}</span>
        {title}
      </h2>
      {children}
    </section>
  );
}

/** 위키 첫 화면: Next.js 문서 홈처럼 장(카테고리) 카드 + 오늘 복습·점검·최근 원본 */
export function WikiHome() {
  const wikiPages = useWikiPages();
  const sources = useSources();
  const chapters = wikiChapters(wikiPages);
  // 오늘 복습할 목록은 화면을 연 시점 기준으로 고정 (복습했음을 눌러도 바로 사라지지 않게)
  const [dueSlugs] = useState(() =>
    wikiPages
      .filter((p) => p.review.nextReview <= TODAY)
      .sort((a, b) => a.review.nextReview.localeCompare(b.review.nextReview) || a.review.intervalDays - b.review.intervalDays)
      .map((p) => p.slug),
  );
  const dueReviews = dueSlugs.flatMap((slug) => wikiPages.filter((p) => p.slug === slug));
  const issuePages = wikiPages.filter((p) => p.issues?.length);
  // 정리 중·실패한 원본은 항상, 나머지는 최근 것 몇 개
  const newest = [...sources].reverse();
  const attention = newest.filter((s) => s.wiki?.status === "processing" || s.wiki?.status === "failed");
  const recentSources = [...attention, ...newest.filter((s) => !attention.includes(s)).slice(0, Math.max(0, 6 - attention.length))];

  return (
    <div className="space-y-10">
      <PendingPanel />

      {wikiPages.length === 0 && (
        <div className="rounded-xl border border-dashed border-line-strong px-5 py-6 text-[14px] leading-relaxed text-muted">
          아직 위키가 비어 있어요. 사내 규정·매뉴얼·양식 같은 <span className="font-medium text-ink">원본을 올리면</span> Claude가 읽고
          주제별 위키 페이지로 정리해요.
        </div>
      )}

      {/* 장 카드 */}
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {chapters.map((c) => (
          <section
            key={c.category}
            className="rounded-xl border border-line bg-surface p-4 transition-colors hover:border-line-strong"
          >
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-[15.5px] font-semibold">
                <span className="mr-1.5 text-faint tabular">{c.no}</span>
                {c.category}
              </h2>
              <span className="text-[12px] text-faint tabular">{c.pages.length}개</span>
            </div>
            <ul className="mt-2.5 space-y-1">
              {c.pages.slice(0, 4).map((p, i) => (
                <li key={p.slug}>
                  <Link
                    href={`/wiki/${p.slug}`}
                    className="group flex items-center gap-2 text-[13.5px] text-muted hover:text-ink"
                  >
                    <span className="w-7 shrink-0 text-[12px] text-faint tabular">
                      {c.no}.{i + 1}
                    </span>
                    <span className="truncate group-hover:underline group-hover:underline-offset-4">{p.title}</span>
                    {p.issues?.length ? <span className="size-1.5 shrink-0 rounded-full bg-warn" /> : null}
                  </Link>
                </li>
              ))}
            </ul>
            {c.pages.length > 4 && (
              <Link
                href={`/wiki/${c.pages[4].slug}`}
                className="mt-2 inline-flex items-center gap-1 text-[12.5px] text-accent-ink hover:underline"
              >
                {c.pages.length - 4}개 더 <ArrowRight className="size-3" />
              </Link>
            )}
          </section>
        ))}
      </div>

      <div className="grid gap-3 lg:grid-cols-3">
        <Panel title="오늘 복습할 것" icon={<Brain className="size-4" />}>
          <ul className="px-2 pb-2.5">
            {dueReviews.length === 0 && <li className="px-2 py-2 text-[13px] text-muted">오늘은 없어요</li>}
            {dueReviews.map((p) => (
              <li key={p.slug} className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-sunken">
                <Link href={`/wiki/${p.slug}`} className="min-w-0 flex-1 truncate text-[13.5px] font-medium">
                  {p.title}
                </Link>
                <IntervalPill days={p.review.intervalDays} />
                <ReviewDoneButton slug={p.slug} size="sm" />
              </li>
            ))}
          </ul>
        </Panel>

        <Panel title="위키 점검" icon={<AlertTriangle className="size-4" />}>
          <ul className="px-2 pb-2.5">
            {issuePages.length === 0 && <li className="px-2 py-2 text-[13px] text-muted">문제 없어요</li>}
            {issuePages.flatMap((p) =>
              (p.issues ?? []).map((issue, i) => {
                const meta = issueMeta[issue.kind];
                const Icon = meta.icon;
                return (
                  <li key={`${p.slug}-${i}`}>
                    <Link href={`/wiki/${p.slug}`} className="flex gap-2.5 rounded-lg px-2 py-2 hover:bg-sunken">
                      <Icon className={`mt-0.5 size-4 shrink-0 ${meta.cls}`} />
                      <span className="min-w-0">
                        <span className="block truncate text-[13.5px] font-medium">{p.title}</span>
                        <span className={`text-[12px] ${meta.cls}`}>{meta.label}</span>
                      </span>
                    </Link>
                  </li>
                );
              }),
            )}
          </ul>
        </Panel>

        <Panel title="최근 들어온 원본" icon={<Inbox className="size-4" />}>
          <ul className="px-2 pb-2.5">
            {recentSources.length === 0 && (
              <li className="px-2 py-2 text-[13px] text-muted">원본을 올리면 Claude가 읽고 위키로 정리해요</li>
            )}
            {recentSources.map((s) => (
              <li key={s.id} className="flex items-center gap-2.5 rounded-lg px-2 py-1.5">
                <FileIcon type={s.fileType} className="size-7" />
                <span className="min-w-0 flex-1">
                  {s.hasFile ? (
                    <a href={`/api/sources/${s.id}/file`} className="block truncate text-[13px] hover:text-accent-ink hover:underline">
                      {s.title}
                    </a>
                  ) : (
                    <span className="block truncate text-[13px]">{s.title}</span>
                  )}
                  <span className="flex items-center gap-1.5 text-[11.5px] text-faint">
                    <SourceTypeBadge type={s.type} />
                    {fmt(s.addedAt, "M/d")}
                  </span>
                  <SourceWikiStatus source={s} />
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      </div>
    </div>
  );
}

/** 위키 머리말의 페이지·원본 수 */
export function WikiCounts() {
  const pages = useWikiPages();
  const sources = useSources();
  return (
    <div className="mt-2 flex gap-3 text-[13px] text-faint tabular">
      <span>페이지 {pages.length}</span>
      <span>·</span>
      <span>원본 {sources.length}</span>
    </div>
  );
}

/** 원본을 위키로 정리한 상태 한 줄 */
function SourceWikiStatus({ source }: { source: Source }) {
  const w = source.wiki;
  if (!w) return null;
  if (w.status === "processing")
    return (
      <span className="mt-0.5 flex items-center gap-1 text-[11.5px] text-accent-ink">
        <Loader2 className="size-3 animate-spin" />
        Claude가 위키로 정리하는 중
      </span>
    );
  if (w.status === "failed")
    return (
      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11.5px] text-danger">
        <span title={w.note}>{w.note ?? "위키로 정리하지 못했어요"}</span>
        <button
          type="button"
          className="font-medium text-ink underline underline-offset-2"
          onClick={async () => {
            await mutate(null, () => actions.retryOrganizeSource(source.id));
            await refresh();
          }}
        >
          다시 정리
        </button>
      </span>
    );
  const made = (w.created?.length ?? 0) > 0 ? `새 페이지 ${w.created!.length}` : "";
  const changed = (w.updated?.length ?? 0) > 0 ? `수정 ${w.updated!.length}` : "";
  const summary = [made, changed].filter(Boolean).join(" · ");
  return (
    <span className="mt-0.5 block truncate text-[11.5px] text-muted" title={w.note}>
      {summary ? `위키 ${summary}` : (w.note ?? "위키에 남길 내용이 없었어요")}
    </span>
  );
}
