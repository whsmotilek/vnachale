import { useMemo } from "react";

export interface DonutSlice {
  label: string;
  value: number;
}

// палитра — оттенки brand + нейтральные
const COLORS = ["#1a0088", "#372a9a", "#5a4ec2", "#8782db", "#b0aef0", "#d3d3d1"];

export function Donut({
  title,
  slices,
  centerLabel,
}: {
  title: string;
  slices: DonutSlice[];
  centerLabel?: { primary: string; secondary?: string };
}) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  const segments = useMemo(() => {
    if (total === 0) return [];
    let acc = 0;
    return slices.map((s, i) => {
      const start = acc / total;
      acc += s.value;
      const end = acc / total;
      return { ...s, start, end, color: COLORS[i % COLORS.length] };
    });
  }, [slices, total]);

  const r = 60;
  const cx = 80;
  const cy = 80;
  const sw = 18; // stroke width
  const C = 2 * Math.PI * r;

  return (
    <div className="card p-4">
      <h2 className="text-sm font-semibold mb-3 tracking-tightish">{title}</h2>
      {total === 0 ? (
        <div className="text-[13px] text-ink-subtle">Данных пока нет.</div>
      ) : (
        <div className="flex items-center gap-5">
          <svg width="160" height="160" viewBox="0 0 160 160" className="shrink-0">
            <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f0f0ee" strokeWidth={sw} />
            {segments.map((seg, i) => {
              const dash = (seg.end - seg.start) * C;
              const offset = -seg.start * C + C / 4; // start at top
              return (
                <circle
                  key={i}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={sw}
                  strokeDasharray={`${dash} ${C - dash}`}
                  strokeDashoffset={offset}
                  transform={`rotate(-90 ${cx} ${cy})`}
                  style={{ transition: "stroke-dasharray 700ms ease-out" }}
                />
              );
            })}
            {centerLabel && (
              <>
                <text
                  x={cx}
                  y={cy - 2}
                  textAnchor="middle"
                  className="fill-ink"
                  fontSize="20"
                  fontWeight="600"
                  style={{ fontVariantNumeric: "tabular-nums", letterSpacing: "-0.02em" }}
                >
                  {centerLabel.primary}
                </text>
                {centerLabel.secondary && (
                  <text
                    x={cx}
                    y={cy + 16}
                    textAnchor="middle"
                    className="fill-ink-muted"
                    fontSize="11"
                  >
                    {centerLabel.secondary}
                  </text>
                )}
              </>
            )}
          </svg>

          <ul className="flex flex-col gap-1.5 min-w-0">
            {segments.map((s) => (
              <li key={s.label} className="flex items-center gap-2 text-[13px] min-w-0">
                <span
                  className="w-2.5 h-2.5 rounded-sm shrink-0"
                  style={{ background: s.color }}
                />
                <span className="text-ink truncate">{s.label}</span>
                <span className="text-ink-muted tabular-nums shrink-0 ml-auto text-[12px]">
                  {s.value} · {Math.round((s.value / total) * 100)}%
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
