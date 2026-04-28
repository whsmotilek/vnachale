import clsx from "clsx";

export function StatCard({
  label,
  value,
  hint,
  accent = false,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  accent?: boolean;
  className?: string;
}) {
  return (
    <div
      className={clsx(
        "card card-hover p-4 transition-transform duration-200 hover:-translate-y-px",
        accent && "border-brand/30",
        className,
      )}
    >
      <div className="text-[11px] text-ink-muted uppercase tracking-wide font-medium">
        {label}
      </div>
      <div
        className={clsx(
          "mt-2 text-2xl font-semibold tracking-tighter2 tabular-nums",
          accent ? "text-brand-dark" : "text-ink",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-1 text-[12px] text-ink-subtle">{hint}</div>}
    </div>
  );
}
