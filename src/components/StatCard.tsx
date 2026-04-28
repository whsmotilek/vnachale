import clsx from "clsx";

export function StatCard({
  label,
  value,
  hint,
  className,
}: {
  label: string;
  value: string | number;
  hint?: string;
  className?: string;
}) {
  return (
    <div className={clsx("card p-4", className)}>
      <div className="text-[12px] text-ink-muted uppercase tracking-wide">{label}</div>
      <div className="mt-2 text-2xl font-semibold tracking-tight tabular-nums">{value}</div>
      {hint && <div className="mt-1 text-[12px] text-ink-subtle">{hint}</div>}
    </div>
  );
}
