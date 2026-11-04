import clsx from "clsx";
import { Card } from "@/components/ui";

export function SettingsSection({
  id,
  title,
  description,
  icon,
  children,
}: {
  id: string;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Card as="section">
      <div id={id} className="scroll-mt-8 border-b border-line px-6 py-4">
        <h2 className="flex items-center gap-2 text-[15.5px] font-semibold">
          {icon && <span className="text-muted">{icon}</span>}
          {title}
        </h2>
        {description && <p className="mt-0.5 text-[13px] text-muted">{description}</p>}
      </div>
      <div className="divide-y divide-line">{children}</div>
    </Card>
  );
}

/** 라벨 + 컨트롤 한 줄 */
export function Row({
  label,
  hint,
  children,
  className,
}: {
  label: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={clsx("flex flex-wrap items-center justify-between gap-x-6 gap-y-2 px-6 py-4", className)}>
      <div className="min-w-0">
        <div className="text-[14px] font-medium">{label}</div>
        {hint && <div className="mt-0.5 text-[12.5px] text-muted">{hint}</div>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={clsx(
        "relative h-6 w-10 shrink-0 rounded-full transition-colors disabled:opacity-50",
        checked ? "bg-accent" : "bg-line-strong",
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 left-0.5 size-5 rounded-full bg-white shadow transition-transform",
          checked && "translate-x-4",
        )}
      />
    </button>
  );
}

export const inputCls =
  "h-9 rounded-lg border border-line bg-surface px-3 text-[14px] outline-none focus:border-accent focus:ring-2 focus:ring-accent/20";
