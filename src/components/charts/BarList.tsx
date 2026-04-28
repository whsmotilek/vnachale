import clsx from "clsx";

export interface BarItem {
  label: string;
  value: number;
  hint?: string;
}

export function BarList({
  title,
  items,
  emptyText = "Данных пока нет.",
  unit = "",
  variant = "brand",
}: {
  title: string;
  items: BarItem[];
  emptyText?: string;
  unit?: string;
  variant?: "brand" | "neutral";
}) {
  const max = Math.max(1, ...items.map((i) => i.value));

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold mb-3 tracking-tightish">{title}</h2>
      {items.length === 0 ? (
        <div className="text-[13px] text-ink-subtle">{emptyText}</div>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {items.map((it) => {
            const pct = (it.value / max) * 100;
            return (
              <li key={it.label} className="flex items-center gap-3 text-[13px]">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2 mb-1">
                    <span className="text-ink truncate">{it.label}</span>
                    <span className="text-ink-muted tabular-nums shrink-0 text-[12px]">
                      {it.value.toLocaleString("ru-RU")}
                      {unit ? ` ${unit}` : ""}
                      {it.hint && (
                        <span className="text-ink-subtle ml-1">· {it.hint}</span>
                      )}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-line-soft overflow-hidden">
                    <div
                      className={clsx(
                        "h-full rounded-full transition-[width] duration-700 ease-out",
                        variant === "brand"
                          ? "bg-gradient-to-r from-brand to-brand-muted"
                          : "bg-ink/70",
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
