import clsx from "clsx";
import type { DisplayKind, Priority, Verdict } from "@/lib/types";
import { KIND_META } from "@/lib/items";

/** 페이지 공통 헤더 */
export function PageHeader({
  title,
  description,
  actions,
  eyebrow,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
  eyebrow?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-end justify-between gap-4 px-6 pt-7 pb-5 lg:px-10 lg:pt-9">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-[13px] text-muted">{eyebrow}</div>}
        <h1 className="text-[24px] font-bold tracking-[-0.02em]">{title}</h1>
        {description && <p className="mt-1 text-[14px] text-muted">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}

/** 페이지 본문 패딩 */
export function PageBody({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={clsx("px-6 pb-12 lg:px-10", className)}>{children}</div>;
}

export function Card({
  children,
  className,
  as: As = "div",
}: {
  children: React.ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <As className={clsx("rounded-xl border border-line bg-surface shadow-card", className)}>{children}</As>
  );
}

export function CardTitle({
  children,
  icon,
  right,
  className,
}: {
  children: React.ReactNode;
  icon?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex items-center justify-between gap-3 px-5 pt-4 pb-3", className)}>
      <h2 className="flex items-center gap-2 text-[14.5px] font-semibold">
        {icon && <span className="text-muted">{icon}</span>}
        {children}
      </h2>
      {right}
    </div>
  );
}

export function Button({
  children,
  variant = "secondary",
  size = "md",
  className,
  ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost";
  size?: "sm" | "md";
}) {
  return (
    <button
      {...rest}
      className={clsx(
        "inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-50",
        size === "sm" ? "h-8 px-2.5 text-[13px]" : "h-9 px-3.5 text-[14px]",
        variant === "primary" && "bg-accent text-white hover:bg-accent-ink",
        variant === "secondary" && "border border-line bg-surface text-ink hover:bg-sunken",
        variant === "ghost" && "text-muted hover:bg-sunken hover:text-ink",
        className,
      )}
    >
      {children}
    </button>
  );
}

export const priorityLabel: Record<Priority, string> = {
  P0: "지금 당장",
  P1: "오늘·내일",
  P2: "이번 주",
  P3: "다음 주",
  P4: "여유 있음",
  P5: "언젠가",
};

export function PriorityBadge({ p, withLabel = false }: { p: Priority; withLabel?: boolean }) {
  return (
    <span
      className={clsx(
        `tone-${p}`,
        "tone-chip inline-flex h-[20px] items-center gap-1 rounded-[5px] px-1.5 text-[11.5px] font-semibold tabular",
      )}
      title={priorityLabel[p]}
    >
      {p}
      {withLabel && <span className="font-medium opacity-90">· {priorityLabel[p]}</span>}
    </span>
  );
}

/** 항목 유형 배지: 일정 / 단순 작업 / 작업 (고정 3종) */
export function KindTag({ kind }: { kind: DisplayKind }) {
  const m = KIND_META[kind];
  return (
    <span
      style={{ "--tone": m.color } as React.CSSProperties}
      className="tone-chip inline-flex h-[20px] items-center rounded-[5px] px-1.5 text-[11.5px] font-semibold"
    >
      {m.label}
    </span>
  );
}

/** 자유 태그 배지 */
export function ItemTagChip({ label, color }: { label: string; color: string }) {
  return (
    <span className="inline-flex h-[20px] items-center gap-1 rounded-[5px] border border-line px-1.5 text-[11.5px] text-muted">
      <span className="size-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

export function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-[20px] items-center rounded-[5px] border border-line px-1.5 text-[11.5px] text-muted">
      {children}
    </span>
  );
}

const verdictStyle: Record<Verdict, { label: string; cls: string }> = {
  ANSWER: { label: "확답", cls: "bg-ok-soft text-ok" },
  ANSWER_WITH_CAVEAT: { label: "조건부 답", cls: "bg-warn-soft text-warn" },
  NEED_INFO: { label: "알아올 것 있음", cls: "bg-info-soft text-info" },
};

export function VerdictBadge({ v, className }: { v: Verdict; className?: string }) {
  const s = verdictStyle[v];
  return (
    <span
      className={clsx(
        "inline-flex h-[22px] items-center gap-1 rounded-full px-2 text-[12px] font-semibold",
        s.cls,
        className,
      )}
    >
      {s.label}
    </span>
  );
}

/** 가로 진척률 바 */
export function ProgressBar({
  value,
  className,
  tone = "accent",
}: {
  value: number;
  className?: string;
  tone?: "accent" | "ok";
}) {
  return (
    <div className={clsx("h-1.5 w-full overflow-hidden rounded-full bg-sunken", className)}>
      <div
        className={clsx("h-full rounded-full transition-[width]", tone === "ok" || value === 100 ? "bg-ok" : "bg-accent")}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

/** 원형 진척률 */
export function ProgressRing({ value, size = 44, stroke = 4.5 }: { value: number; size?: number; stroke?: number }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const done = value >= 100;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--sunken)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={done ? "var(--ok)" : "var(--accent)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - value / 100)}
        />
      </svg>
      <span className="absolute inset-0 grid place-items-center text-[11px] font-semibold tabular">{value}%</span>
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-line-strong px-6 py-10 text-center">
      <div className="text-[14px] font-medium">{title}</div>
      {children && <div className="mt-1 text-[13px] text-muted">{children}</div>}
    </div>
  );
}

/** 0~1 신호값 막대 (판정 근거 표시용) */
export function SignalBar({
  label,
  value,
  invert = false,
}: {
  label: string;
  value: number;
  /** true면 값이 높을수록 나쁨(충돌·위험·모호성) */
  invert?: boolean;
}) {
  const good = invert ? 1 - value : value;
  const color = good >= 0.7 ? "var(--ok)" : good >= 0.4 ? "var(--warn)" : "var(--danger)";
  return (
    <div className="grid grid-cols-[96px_1fr_36px] items-center gap-3 text-[13px]">
      <span className="text-muted">{label}</span>
      <div className="h-1.5 overflow-hidden rounded-full bg-sunken">
        <div className="h-full rounded-full" style={{ width: `${value * 100}%`, background: color }} />
      </div>
      <span className="text-right tabular text-muted">{Math.round(value * 100)}</span>
    </div>
  );
}
