"use client";

import { useState, useTransition } from "react";
import { Loader2, RefreshCw, Sparkles } from "lucide-react";
import { Button, Card } from "@/components/ui";
import type { MorningBriefing } from "@/lib/types";
import { useClaudeEnabled, useDashboardSettings } from "@/components/workspace/hooks";
import { refresh } from "@/components/workspace/store";
import * as actions from "@/server/actions";

const DAY_LABEL = ["일", "월", "화", "수", "목", "금", "토"];

/** 오늘 브리핑 머리: 인사 한 줄 + 만든 시각, 없으면 언제 만들어지는지와 '지금 만들기' */
export function BriefingCard({ morning }: { morning: MorningBriefing | null }) {
  const claude = useClaudeEnabled();
  const settings = useDashboardSettings();
  const [pending, start] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  const make = () =>
    start(async () => {
      setMessage(null);
      const r = await actions.generateBriefingNow();
      if (!r.ok) setMessage(r.error);
      else if (r.rescheduled) setMessage("일이 몰린 곳이 있어 재배치 제안도 만들었어요.");
      await refresh();
    });

  const days = [1, 2, 3, 4, 5, 6, 0].filter((d) => settings.days.includes(d)).map((d) => DAY_LABEL[d]).join("·");
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 text-[12.5px] font-semibold text-accent">
        <Sparkles className="size-3.5" />
        오늘 브리핑
      </div>
      {morning ? (
        <>
          <p className="mt-2 text-[15px] leading-relaxed font-medium">{morning.greeting || "오늘 브리핑이에요."}</p>
          <div className="mt-2 flex items-center justify-between gap-2 text-[12px] text-muted">
            <span className="tabular">{morning.generatedAt.slice(11, 16)}에 만듦</span>
            <Button size="sm" variant="ghost" onClick={make} disabled={pending || !claude} title="지금 상태로 다시 만들기">
              {pending ? <Loader2 className="size-3.5 animate-spin" /> : <RefreshCw className="size-3.5" />}
              다시 만들기
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">
            {days ? (
              <>
                아직 오늘 브리핑이 없어요. {days} <span className="tabular">{settings.morningTime}</span>에 Claude가 만들어요.
              </>
            ) : (
              "브리핑 요일이 꺼져 있어요 (설정 → 대시보드 알림)."
            )}
          </p>
          <Button size="sm" variant="primary" className="mt-3" onClick={make} disabled={pending || !claude}>
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
            {pending ? "만드는 중… (1분 정도)" : "지금 만들기"}
          </Button>
        </>
      )}
      {!claude && <p className="mt-2 text-[12.5px] text-danger">Claude API 키가 없어 브리핑을 만들 수 없어요.</p>}
      {message && (
        <p role="status" className="mt-2 text-[12.5px] text-muted">
          {message}
        </p>
      )}
    </Card>
  );
}
