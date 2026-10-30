import clsx from "clsx";
import {
  FileImage,
  FileSpreadsheet,
  FileText,
  FileType,
  Presentation,
  StickyNote,
} from "lucide-react";
import type { Source } from "@/lib/types";
import { sourceTypeLabel } from "@/mocks/wiki";

const fileMeta: Record<Source["fileType"], { icon: typeof FileText; label: string; cls: string }> = {
  pdf: { icon: FileText, label: "PDF", cls: "text-danger" },
  docx: { icon: FileType, label: "DOCX", cls: "text-accent" },
  hwp: { icon: FileType, label: "HWP", cls: "text-info" },
  hwpx: { icon: FileType, label: "HWPX", cls: "text-info" },
  xlsx: { icon: FileSpreadsheet, label: "XLSX", cls: "text-ok" },
  pptx: { icon: Presentation, label: "PPTX", cls: "text-warn" },
  text: { icon: StickyNote, label: "텍스트", cls: "text-muted" },
  image: { icon: FileImage, label: "이미지", cls: "text-muted" },
};

export function FileIcon({ type, className }: { type: Source["fileType"]; className?: string }) {
  const m = fileMeta[type];
  const Icon = m.icon;
  return (
    <span
      className={clsx("grid size-8 shrink-0 place-items-center rounded-lg bg-sunken", m.cls, className)}
      title={m.label}
    >
      <Icon className="size-4" strokeWidth={1.9} />
    </span>
  );
}

export function fileLabel(type: Source["fileType"]) {
  return fileMeta[type].label;
}

/** 출처 신뢰 유형 뱃지 — 공식 문서일수록 진하게 */
const trustCls: Record<Source["type"], string> = {
  manual: "bg-accent-soft text-accent-ink",
  guideline: "bg-accent-soft text-accent-ink",
  boss_answer: "bg-ok-soft text-ok",
  peer_advice: "bg-warn-soft text-warn",
  note: "bg-sunken text-muted",
};

export function SourceTypeBadge({ type }: { type: Source["type"] }) {
  return (
    <span
      className={clsx(
        "inline-flex h-[20px] items-center rounded-[5px] px-1.5 text-[11.5px] font-medium",
        trustCls[type],
      )}
    >
      {sourceTypeLabel[type]}
    </span>
  );
}

/** 복습 노출 간격 표시 */
export function IntervalPill({ days }: { days: number }) {
  return (
    <span className="inline-flex h-[20px] shrink-0 items-center rounded-full bg-sunken px-2 text-[11.5px] font-medium text-muted tabular">
      {days}일마다
    </span>
  );
}
