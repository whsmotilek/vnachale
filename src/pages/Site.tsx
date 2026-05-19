import { useEffect, useState } from "react";
import clsx from "clsx";
import { api, type SiteAnalyticsResponse } from "../api";
import { StatCard } from "../components/StatCard";
import { StatCardsSkeleton } from "../components/Skeleton";
import { BarList } from "../components/charts/BarList";
import { Donut } from "../components/charts/Donut";
import { hasApi } from "../env";

function formatNum(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
}
function formatRub(n: number): string {
  return formatNum(n) + " ₽";
}
function formatPct(n: number, fractionDigits = 1): string {
  return `${n.toFixed(fractionDigits).replace(/\.0$/, "")}%`;
}
function formatDuration(sec: number): string {
  if (sec <= 0) return "—";
  const m = Math.floor(sec / 60);
  const s = Math.round(sec - m * 60);
  if (m > 0) return `${m} мин ${s.toString().padStart(2, "0")} сек`;
  return `${s} сек`;
}

type PeriodKey = "today" | "week" | "month" | "year" | "custom";

const PRESETS: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "Сегодня" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "year", label: "Год" },
  { key: "custom", label: "Период" },
];

// Простой sparkline-график визитов по дням — две линии: визиты и уникальные
function VisitsChart({ data }: { data: SiteAnalyticsResponse["daily"] }) {
  if (data.length === 0) {
    return (
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3 tracking-tightish">Посещаемость по дням</h2>
        <div className="text-[13px] text-ink-subtle">Нет данных за выбранный период.</div>
      </div>
    );
  }

  const h = 180;
  const w = 1000;
  const padTop = 16;
  const padBottom = 24;
  const padX = 8;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBottom;

  const maxVisits = Math.max(1, ...data.map((d) => d.visits));
  const totalVisits = data.reduce((s, d) => s + d.visits, 0);
  const totalUsers = data.reduce((s, d) => s + d.users, 0);

  const xAt = (i: number) =>
    padX + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number) => padTop + innerH - (v / maxVisits) * innerH;

  const linePath = (key: "visits" | "users") =>
    data
      .map((d, i) => {
        const x = xAt(i);
        const y = yAt(d[key]);
        if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
        const px = xAt(i - 1);
        const py = yAt(data[i - 1][key]);
        const cx = (px + x) / 2;
        return `C ${cx.toFixed(1)} ${py.toFixed(1)}, ${cx.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
      })
      .join(" ");

  const fmtDate = (s: string) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return new Intl.DateTimeFormat("ru-RU", {
      day: "2-digit", month: "short", timeZone: "Europe/Moscow",
    }).format(d);
  };

  return (
    <div className="card p-4">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tightish">Посещаемость по дням</h2>
        <div className="text-[12px] text-ink-muted">
          <span className="text-ink font-medium tabular-nums">{formatNum(totalVisits)}</span> визитов ·{" "}
          <span className="text-ink font-medium tabular-nums">{formatNum(totalUsers)}</span> уникальных
        </div>
      </header>

      <div className="relative">
        <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
          <defs>
            <linearGradient id="vfill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#1a0088" stopOpacity="0.12" />
              <stop offset="100%" stopColor="#1a0088" stopOpacity="0" />
            </linearGradient>
          </defs>
          <line x1={padX} x2={w - padX} y1={padTop + innerH} y2={padTop + innerH} stroke="#e9e9e7" strokeWidth="1" />
          <path
            d={`${linePath("visits")} L ${xAt(data.length - 1).toFixed(1)} ${(padTop + innerH).toFixed(1)} L ${xAt(0).toFixed(1)} ${(padTop + innerH).toFixed(1)} Z`}
            fill="url(#vfill)"
          />
          <path d={linePath("visits")} fill="none" stroke="#1a0088" strokeWidth="2" strokeLinejoin="round" />
          <path d={linePath("users")} fill="none" stroke="#6b7280" strokeWidth="1.5" strokeLinejoin="round" strokeDasharray="3 3" />
        </svg>

        <div className="flex justify-between mt-1 text-[10px] text-ink-subtle px-1 tabular-nums">
          <span>{fmtDate(data[0].date)}</span>
          {data.length > 2 && <span>{fmtDate(data[Math.floor(data.length / 2)].date)}</span>}
          <span>{fmtDate(data[data.length - 1].date)}</span>
        </div>

        <div className="flex gap-4 mt-2 text-[11px]">
          <span className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 bg-brand inline-block" /> Визиты
          </span>
          <span className="flex items-center gap-1.5">
            <span
              className="w-3 h-0.5 bg-ink-soft inline-block"
              style={{ borderTop: "1px dashed currentColor" }}
            />{" "}
            Уникальные
          </span>
        </div>
      </div>
    </div>
  );
}

export function Site() {
  const [data, setData] = useState<SiteAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasApi) {
      setError("Сервис временно недоступен.");
      return;
    }
    setLoading(true);
    const opts =
      period === "custom"
        ? { from: from || undefined, to: to || undefined }
        : { period };
    api
      .siteAnalytics(opts)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError("Не удалось загрузить аналитику сайта. Попробуйте обновить страницу."))
      .finally(() => setLoading(false));
  }, [period, from, to]);

  const subtitle = (() => {
    if (!data) return "";
    if (period === "today") return "сегодня";
    if (period === "week") return "за неделю";
    if (period === "month") return "за месяц";
    if (period === "year") return "за год";
    if (period === "custom") {
      if (from && to) return `с ${from} по ${to}`;
      if (from) return `с ${from}`;
      if (to) return `по ${to}`;
      return "произвольный период";
    }
    return "";
  })();

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1200px] animate-slide-up">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Сайт</h1>
        <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
          Посещаемость и поведение посетителей на vnachale.shop. Данные из Яндекс.Метрики,
          обновляются с задержкой около 30 минут.
        </p>
      </header>

      {/* === Период === */}
      <section className="mb-5 animate-fade-in">
        <div className="flex flex-wrap gap-1.5 items-center">
          {PRESETS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => setPeriod(key)}
              className={clsx(
                "px-3 py-1.5 text-[12px] rounded-md border transition-colors",
                period === key
                  ? "bg-brand text-white border-brand"
                  : "bg-surface border-line text-ink-muted hover:bg-surface-hover hover:text-ink",
              )}
            >
              {label}
            </button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex flex-wrap gap-2 mt-3 items-center text-[12px]">
            <label className="flex items-center gap-1.5 text-ink-muted">
              с
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand transition-colors"
              />
            </label>
            <label className="flex items-center gap-1.5 text-ink-muted">
              по
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand transition-colors"
              />
            </label>
          </div>
        )}
      </section>

      {error && (
        <div className="mb-4 text-[13px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 animate-fade-in">
          {error}
        </div>
      )}

      {!data && !error ? (
        <StatCardsSkeleton />
      ) : data ? (
        <div className={clsx("transition-opacity", loading && "opacity-60")}>
          <div className="text-[12px] text-ink-subtle mb-2">Показатели {subtitle}</div>

          {/* === KPI: трафик === */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Визиты" value={formatNum(data.visits)} hint="сеансы на сайте" />
            <StatCard label="Уникальные" value={formatNum(data.users)} hint="разных посетителей" />
            <StatCard label="Просмотры" value={formatNum(data.pageviews)} hint="страниц всего" />
            <StatCard label="Отказы" value={formatPct(data.bounce_rate)} hint="ушли за <15 сек" />
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <StatCard label="Длительность визита" value={formatDuration(data.avg_visit_duration_sec)} hint="в среднем" />
            <StatCard label="Глубина" value={data.page_depth.toFixed(2)} hint="страниц за визит" />
            <StatCard label="Покупки" value={formatNum(data.purchases)} hint="по цели Метрики" />
            <StatCard label="Конверсия → заказ" value={formatPct(data.conv_to_purchase_pct, 2)} hint="от визитов" />
          </section>

          {/* === Воронка корзины === */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <StatCard label="В корзину" value={formatNum(data.add_to_carts)} hint="добавлений" />
            <StatCard label="Конверсия → корзина" value={formatPct(data.conv_to_cart_pct, 2)} hint="визиты → корзина" />
            <StatCard label="Корзина → оплата" value={formatPct(data.cart_to_purchase_pct, 1)} hint="закрытие воронки" />
            <StatCard
              label="Брошенная оплата"
              value={formatNum(data.payment_returns)}
              hint="ушли с ЮKassa"
            />
          </section>

          {/* === Ecommerce: выручка с сайта по Метрике === */}
          {data.ecom_revenue > 0 && (
            <section className="mt-6 animate-fade-in">
              <div className="card relative overflow-hidden">
                <div
                  className="absolute inset-0 pointer-events-none"
                  style={{
                    background:
                      "radial-gradient(800px 240px at 0% 0%, rgba(26,0,136,0.08), transparent 60%)",
                  }}
                />
                <div className="relative p-5">
                  <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium">
                    Выручка по данным e-commerce
                  </div>
                  <div className="mt-2 text-3xl font-semibold tracking-tighter2 tabular-nums text-brand-dark dark:text-white">
                    {formatRub(data.ecom_revenue)}
                  </div>
                  <div className="mt-2 text-[13px] text-ink-muted">
                    {data.ecom_purchases} оплаченных заказов · средний чек{" "}
                    {data.ecom_purchases > 0
                      ? formatRub(Math.round(data.ecom_revenue / data.ecom_purchases))
                      : "—"}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* === График визитов === */}
          <section className="mt-6 animate-slide-up-fast">
            <VisitsChart data={data.daily} />
          </section>

          {/* === Источники + устройства === */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-slide-up-fast">
            <Donut
              title="Источники трафика"
              slices={data.sources.map(([name, count]) => ({ label: name, value: count }))}
              centerLabel={{
                primary: formatNum(data.sources.reduce((s, [, n]) => s + n, 0)),
                secondary: "визитов",
              }}
            />
            <Donut
              title="Устройства"
              slices={data.devices.map(([name, count]) => ({ label: name, value: count }))}
              centerLabel={{
                primary: formatNum(data.devices.reduce((s, [, n]) => s + n, 0)),
                secondary: "визитов",
              }}
            />
          </section>

          {/* === Топ-страниц + города === */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-slide-up-fast">
            <BarList
              title="Топ страниц"
              items={data.top_pages.map(([url, count]) => ({ label: url, value: count }))}
              emptyText="Просмотров пока нет."
              unit="просм."
            />
            <BarList
              title="Топ городов"
              items={data.top_cities.map(([city, count]) => ({ label: city, value: count }))}
              variant="neutral"
              unit="зак."
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}
