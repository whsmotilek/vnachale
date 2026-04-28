import { useMemo, useState } from "react";

interface Point {
  date: string;
  revenue: number;
  orders: number;
}

/**
 * Линейный график выручки по дням. SVG, без зависимостей.
 * Сглаживание через monotone-cubic-like (Catmull-Rom-ish), но проще — bezier с
 * контрольными точками на половине между точками.
 */
export function Sparkline({ data, height = 160 }: { data: Point[]; height?: number }) {
  const [hover, setHover] = useState<number | null>(null);
  const padTop = 16;
  const padBottom = 24;
  const padX = 8;

  const max = useMemo(() => Math.max(1, ...data.map((d) => d.revenue)), [data]);
  const totalRevenue = useMemo(() => data.reduce((s, d) => s + d.revenue, 0), [data]);
  const totalOrders = useMemo(() => data.reduce((s, d) => s + d.orders, 0), [data]);

  if (data.length === 0) {
    return (
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3 tracking-tightish">Выручка по дням</h2>
        <div className="text-[13px] text-ink-subtle">Нет данных за последние 30 дней.</div>
      </div>
    );
  }

  // viewBox 0..1000 на ширину, чтобы не зависеть от реальных px
  const w = 1000;
  const h = height;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBottom;

  const xAt = (i: number) =>
    padX + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number) => padTop + innerH - (v / max) * innerH;

  // gradient fill area path
  const linePath = data
    .map((d, i) => {
      const x = xAt(i);
      const y = yAt(d.revenue);
      if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      const prev = data[i - 1];
      const px = xAt(i - 1);
      const py = yAt(prev.revenue);
      const cx1 = (px + x) / 2;
      const cx2 = (px + x) / 2;
      return `C ${cx1.toFixed(1)} ${py.toFixed(1)}, ${cx2.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");

  const areaPath =
    `${linePath} L ${xAt(data.length - 1).toFixed(1)} ${(padTop + innerH).toFixed(1)} ` +
    `L ${xAt(0).toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`;

  const fmtRub = (n: number) =>
    new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";
  const fmtDate = (s: string) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short" }).format(d);
  };

  return (
    <div className="card p-4">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tightish">Выручка по дням</h2>
        <div className="text-[12px] text-ink-muted">
          30 дней · <span className="text-ink font-medium tabular-nums">{fmtRub(totalRevenue)}</span> · {totalOrders} заказ.
        </div>
      </header>

      <div className="relative">
        <svg
          viewBox={`0 0 ${w} ${h}`}
          width="100%"
          height={h}
          preserveAspectRatio="none"
          onMouseLeave={() => setHover(null)}
        >
          <defs>
            <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a0088" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#1a0088" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* baseline */}
          <line
            x1={padX}
            x2={w - padX}
            y1={padTop + innerH}
            y2={padTop + innerH}
            stroke="#e9e9e7"
            strokeWidth="1"
          />

          <path d={areaPath} fill="url(#sparkfill)" />
          <path d={linePath} fill="none" stroke="#1a0088" strokeWidth="2" strokeLinejoin="round" />

          {/* hover hit areas: invisible vertical bars */}
          {data.map((d, i) => {
            const cx = xAt(i);
            const stepW = innerW / Math.max(data.length - 1, 1);
            return (
              <rect
                key={d.date}
                x={cx - stepW / 2}
                y={padTop}
                width={stepW}
                height={innerH}
                fill="transparent"
                onMouseEnter={() => setHover(i)}
              />
            );
          })}

          {/* hover marker */}
          {hover !== null && (
            <>
              <line
                x1={xAt(hover)}
                x2={xAt(hover)}
                y1={padTop}
                y2={padTop + innerH}
                stroke="#d3d3d1"
                strokeWidth="1"
                strokeDasharray="3 3"
              />
              <circle
                cx={xAt(hover)}
                cy={yAt(data[hover].revenue)}
                r="4"
                fill="#1a0088"
                stroke="#fff"
                strokeWidth="2"
              />
            </>
          )}
        </svg>

        {hover !== null && (
          <div
            className="absolute -translate-x-1/2 top-0 pointer-events-none bg-ink text-surface text-[11px] font-medium px-2 py-1 rounded shadow-lg whitespace-nowrap tabular-nums"
            style={{ left: `${(xAt(hover) / w) * 100}%` }}
          >
            {fmtDate(data[hover].date)} · {fmtRub(data[hover].revenue)} · {data[hover].orders} зак.
          </div>
        )}

        {/* x-axis labels (first / middle / last) */}
        <div className="flex justify-between mt-1 text-[10px] text-ink-subtle px-1 tabular-nums">
          <span>{fmtDate(data[0].date)}</span>
          {data.length > 2 && <span>{fmtDate(data[Math.floor(data.length / 2)].date)}</span>}
          <span>{fmtDate(data[data.length - 1].date)}</span>
        </div>
      </div>
    </div>
  );
}
