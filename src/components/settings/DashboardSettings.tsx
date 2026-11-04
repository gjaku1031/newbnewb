"use client";

import { useState, useTransition } from "react";
import clsx from "clsx";
import { Bell } from "lucide-react";
import { useDashboardSettings } from "@/components/workspace/hooks";
import { mutate, refresh } from "@/components/workspace/store";
import * as actions from "@/server/actions";
import { Row, SettingsSection, Toggle, inputCls } from "./Section";

/** 화면 순서(월~일)와 저장 값(0=일 … 6=토) */
const DAYS = [
  { label: "월", value: 1 },
  { label: "화", value: 2 },
  { label: "수", value: 3 },
  { label: "목", value: 4 },
  { label: "금", value: 5 },
  { label: "토", value: 6 },
  { label: "일", value: 0 },
];

export function DashboardSettings() {
  const saved = useDashboardSettings();
  const [morning, setMorning] = useState(saved.morningTime);
  const [days, setDays] = useState<Set<number>>(() => new Set(saved.days));
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  const save = (next: { morningTime: string; days: number[] }) =>
    start(async () => {
      setDone(false);
      await mutate((s) => ({ ...s, settings: next }), () => actions.saveDashboardSettings(next));
      await refresh();
      setDone(true);
    });

  return (
    <SettingsSection
      id="dashboard"
      title="대시보드 알림"
      description="고른 요일, 이 시각에 Claude가 오늘 브리핑·지난 정리를 만들고, 일이 몰리면 재배치 제안도 해요."
      icon={<Bell className="size-4" />}
    >
      <Row label="아침 브리핑" hint={pending ? "저장 중…" : done ? "저장했어요" : undefined}>
        <input
          type="time"
          value={morning}
          onChange={(e) => setMorning(e.target.value)}
          onBlur={() => morning && morning !== saved.morningTime && save({ morningTime: morning, days: [...days] })}
          className={inputCls}
          aria-label="아침 브리핑 시각"
        />
      </Row>
      <Row label="만드는 요일">
        <div className="flex gap-1">
          {DAYS.map((d) => {
            const on = days.has(d.value);
            return (
              <button
                key={d.value}
                type="button"
                aria-pressed={on}
                onClick={() => {
                  const next = new Set(days);
                  if (on) next.delete(d.value);
                  else next.add(d.value);
                  setDays(next);
                  save({ morningTime: morning, days: [...next] });
                }}
                className={clsx(
                  "size-9 rounded-lg text-[13.5px] font-medium transition-colors",
                  on ? "bg-accent text-white" : "border border-line text-muted hover:bg-sunken",
                )}
              >
                {d.label}
              </button>
            );
          })}
        </div>
      </Row>
      <Row label="푸시 알림" hint="준비 중이에요 (홈 화면 앱·알림과 함께)">
        <Toggle checked={false} onChange={() => {}} label="푸시 알림 (준비 중)" disabled />
      </Row>
    </SettingsSection>
  );
}
