"use client";

import { useState } from "react";
import clsx from "clsx";
import { Bell } from "lucide-react";
import { Row, SettingsSection, Toggle, inputCls } from "./Section";

const DAYS = ["월", "화", "수", "목", "금", "토", "일"];

export function DashboardSettings() {
  const [morning, setMorning] = useState("08:00");
  const [days, setDays] = useState<Set<string>>(new Set(["월", "화", "수", "목", "금"]));
  const [push, setPush] = useState(true);

  return (
    <SettingsSection
      id="dashboard"
      title="대시보드 알림"
      icon={<Bell className="size-4" />}
    >
      <Row label="아침 알림">
        <input type="time" value={morning} onChange={(e) => setMorning(e.target.value)} className={inputCls} />
      </Row>
      <Row label="받는 요일">
        <div className="flex gap-1">
          {DAYS.map((d) => {
            const on = days.has(d);
            return (
              <button
                key={d}
                aria-pressed={on}
                onClick={() =>
                  setDays((prev) => {
                    const next = new Set(prev);
                    if (next.has(d)) next.delete(d);
                    else next.add(d);
                    return next;
                  })
                }
                className={clsx(
                  "size-9 rounded-lg text-[13.5px] font-medium transition-colors",
                  on ? "bg-accent text-white" : "border border-line text-muted hover:bg-sunken",
                )}
              >
                {d}
              </button>
            );
          })}
        </div>
      </Row>
      <Row label="푸시 알림">
        <Toggle checked={push} onChange={setPush} label="푸시 알림" />
      </Row>
    </SettingsSection>
  );
}
