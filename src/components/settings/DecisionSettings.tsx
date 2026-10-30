"use client";

import { useState } from "react";
import { Scale } from "lucide-react";
import { Row, SettingsSection, inputCls } from "./Section";

const MODELS = [
  { id: "llm-signal-rule@v1", label: "llm-signal-rule@v1 — LLM 신호 추출 + 규칙 (기본)" },
  { id: "llm-self-eval@v0", label: "llm-self-eval@v0 — LLM 자기평가 (비교용)" },
];

function Slider({
  value,
  onChange,
  label,
}: {
  value: number;
  onChange: (v: number) => void;
  label: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <input
        type="range"
        min={0}
        max={100}
        step={5}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-[200px] accent-[var(--accent)]"
      />
      <span className="w-11 text-right text-[14px] font-semibold tabular">{value}%</span>
    </div>
  );
}

export function DecisionSettings() {
  const [model, setModel] = useState(MODELS[0].id);
  const [minCoverage, setMinCoverage] = useState(80);
  const [riskCoverage, setRiskCoverage] = useState(100);

  return (
    <SettingsSection
      id="decision"
      title="Decision Model"
      icon={<Scale className="size-4" />}
    >
      <Row label="사용할 구현체">
        <select value={model} onChange={(e) => setModel(e.target.value)} className={`${inputCls} max-w-[360px]`}>
          {MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </Row>
      <Row label="확답 최소 근거 커버리지">
        <Slider value={minCoverage} onChange={setMinCoverage} label="확답 최소 근거 커버리지" />
      </Row>
      <Row label="고위험 작업 요구 커버리지">
        <Slider value={riskCoverage} onChange={setRiskCoverage} label="고위험 작업 요구 커버리지" />
      </Row>
    </SettingsSection>
  );
}
