import { useEffect, useState } from "react";
import clsx from "clsx";
import { Filter, X } from "lucide-react";
import { api, type ProductBreakdown, type SiteAnalyticsResponse } from "../api";
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

function VisitsChart({ data }: { data: SiteAnalyticsResponse["daily"] }) {
  if (data.length === 0) {
    return (
      <div className="card p-4">
        <h2 className="text-sm font-semibold mb-3 tracking-tightish">Посещаемость по дням</h2>
        <div className="text-[13px] text-ink-subtle">Нет данных за выбранный период.</div>
      </div>
    );
  }
  const h = 180, w = 1000, padTop = 16, padBottom = 24, padX = 8;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBottom;
  const maxVisits = Math.max(1, ...data.map((d) => d.visits));
  const totalVisits = data.reduce((s, d) => s + d.visits, 0);
  const totalUsers = data.reduce((s, d) => s + d.users, 0);
  const xAt = (i: number) =>
    padX + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  const yAt = (v: number) => padTop + innerH - (v / maxVisits) * innerH;
  const linePath = (key: "visits" | "users") =>
    data.map((d, i) => {
      const x = xAt(i);
      const y = yAt(d[key]);
      if (i === 0) return `M ${x.toFixed(1)} ${y.toFixed(1)}`;
      const px = xAt(i - 1);
      const py = yAt(data[i - 1][key]);
      const cx = (px + x) / 2;
      return `C ${cx.toFixed(1)} ${py.toFixed(1)}, ${cx.toFixed(1)} ${y.toFixed(1)}, ${x.toFixed(1)} ${y.toFixed(1)}`;
    }).join(" ");
  const fmtDate = (s: string) => {
    const d = new Date(s);
    if (Number.isNaN(d.getTime())) return s;
    return new Intl.DateTimeFormat("ru-RU", { day: "2-digit", month: "short", timeZone: "Europe/Moscow" }).format(d);
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
          <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-brand inline-block" /> Визиты</span>
          <span className="flex items-center gap-1.5"><span className="w-3 inline-block" style={{ borderTop: "1px dashed #6b7280" }} /> Уникальные</span>
        </div>
      </div>
    </div>
  );
}

function ProductCard({
  p, onClick,
}: { p: ProductBreakdown; onClick: () => void }) {
  const topColor = p.colors[0];
  const topSize = p.sizes[0];
  return (
    <button
      type="button"
      onClick={onClick}
      className="card card-hover text-left p-4 transition-transform duration-150 hover:-translate-y-px"
    >
      <h3 className="text-[14px] font-semibold tracking-tightish">{p.name}</h3>
      <div className="mt-2 text-2xl font-semibold tabular-nums text-brand-dark dark:text-white">
        {formatRub(p.revenue)}
      </div>
      <div className="mt-1 text-[12px] text-ink-muted tabular-nums">
        {p.orders} зак. · {p.units} ед.
      </div>
      {(topColor || topSize) && (
        <div className="mt-3 flex gap-2 flex-wrap text-[11px]">
          {topColor && (
            <span className="px-2 py-0.5 rounded bg-surface text-ink-muted">
              цвет: <b className="text-ink">{topColor[0]}</b>
            </span>
          )}
          {topSize && (
            <span className="px-2 py-0.5 rounded bg-surface text-ink-muted">
              размер: <b className="text-ink">{topSize[0]}</b>
            </span>
          )}
        </div>
      )}
    </button>
  );
}

export function Site() {
  const [data, setData] = useState<SiteAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [product, setProduct] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!hasApi) {
      setError("Сервис временно недоступен.");
      return;
    }
    setLoading(true);
    setError(null);
    // КРИТИЧНО: при period="custom" передаём period="custom" + from/to.
    // Раньше при custom передавались только from/to (без period),
    // и backend подставлял default "month" → возвращал данные за весь месяц
    // вместо выбранного интервала.
    const opts = {
      ...(period === "custom"
        ? { period: "custom", from: from || undefined, to: to || undefined }
        : { period }),
      ...(product ? { product } : {}),
    };
    // Race-condition guard: если пользователь быстро меняет периоды,
    // эффект захватывает свой собственный "myPeriod" и не пишет результат
    // если состояние уже изменилось.
    let cancelled = false;
    const myPeriod = period;
    const myFrom = from;
    const myTo = to;
    const myProduct = product;
    console.log("[Site] fetching /site/analytics period=%s from=%s to=%s product=%s",
                myPeriod, myFrom, myTo, myProduct);
    api
      .siteAnalytics(opts)
      .then((d) => {
        if (cancelled || myPeriod !== period || myFrom !== from
            || myTo !== to || myProduct !== product) {
          console.log("[Site] discarded stale response for period=%s (current=%s)",
                      myPeriod, period);
          return;
        }
        console.log("[Site] got data period_from=%s period_to=%s visits=%s",
                    d.period_from, d.period_to, d.visits);
        setData(d);
      })
      .catch((e) => {
        if (cancelled) return;
        console.error("[Site] fetch error:", e);
        setError("Не удалось загрузить аналитику сайта.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [period, from, to, product]);

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

  const filteredProduct = data?.products.find((p) => p.name === product) || null;

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1200px] animate-slide-up">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Сайт · Трафик</h1>
        <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
          Посещаемость vnachale.shop из Яндекс.Метрики (обновляется с задержкой ~30 минут)
          и реальная выручка по нашим заказам в Google-таблице.
        </p>
      </header>

      {/* === Период === */}
      <section className="mb-5 animate-fade-in flex flex-col gap-3">
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
          <div className="flex flex-wrap gap-2 items-center text-[12px]">
            <label className="flex items-center gap-1.5 text-ink-muted">
              с
              <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
                className="border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand" />
            </label>
            <label className="flex items-center gap-1.5 text-ink-muted">
              по
              <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
                className="border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand" />
            </label>
          </div>
        )}
      </section>

      {error && (
        <div className="mb-4 text-[13px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          {error}
        </div>
      )}

      {!data && !error ? (
        <StatCardsSkeleton />
      ) : data ? (
        <div className={clsx("transition-opacity", loading && "opacity-60")}>
          <div className="text-[12px] text-ink-subtle mb-2 flex items-center gap-2">
            <span>Показатели {subtitle}</span>
            <span className="text-[10px] text-ink-soft font-mono">
              [{data.period_from} → {data.period_to}]
            </span>
            {loading && <span className="text-[10px] text-brand animate-pulse">обновляется…</span>}
          </div>

          {/* === Hero: реальная выручка с сайта === */}
          <section className="mb-6 animate-fade-in">
            <div className="card relative overflow-hidden">
              <div className="absolute inset-0 pointer-events-none"
                style={{ background: "radial-gradient(800px 240px at 0% 0%, rgba(26,0,136,0.08), transparent 60%)" }} />
              <div className="relative p-5">
                <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium">
                  Реальная выручка с сайта {subtitle}
                </div>
                <div className="mt-2 text-3xl font-semibold tabular-nums text-brand-dark dark:text-white">
                  {formatRub(data.real_revenue)}
                </div>
                <div className="mt-2 text-[13px] text-ink-muted">
                  {data.real_orders} оплаченных заказов
                  {data.real_orders > 0 && ` · средний чек ${formatRub(Math.round(data.real_aov))}`}
                  {" · конверсия "}
                  <b className="text-ink">{formatPct(data.real_conversion_pct, 2)}</b>
                  {" от визитов"}
                </div>
              </div>
            </div>
          </section>

          {/* === Трафик KPI === */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Визиты" value={formatNum(data.visits)} hint="сеансы" />
            <StatCard label="Уникальные" value={formatNum(data.users)} hint="разных посетителей" />
            <StatCard label="Просмотры" value={formatNum(data.pageviews)} hint="страниц всего" />
            <StatCard label="Отказы" value={formatPct(data.bounce_rate)} hint="ушли за <15 сек" />
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <StatCard label="Длительность" value={formatDuration(data.avg_visit_duration_sec)} hint="средняя" />
            <StatCard label="Глубина" value={data.page_depth.toFixed(2)} hint="страниц/визит" />
            <StatCard label="В корзину" value={formatNum(data.add_to_carts)} hint={`конв. ${formatPct(data.conv_to_cart_pct, 1)}`} />
            <StatCard
              label="Брошенная оплата"
              value={formatNum(data.payment_returns)}
              hint="ушли с ЮKassa"
            />
          </section>

          {/* === График визитов === */}
          <section className="mt-6 animate-slide-up-fast">
            <VisitsChart data={data.daily} />
          </section>

          {/* === Источники + устройства === */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-slide-up-fast">
            <Donut
              title="Источники трафика"
              slices={data.sources.map(([n, v]) => ({ label: n, value: v }))}
              centerLabel={{ primary: formatNum(data.sources.reduce((s, [, n]) => s + n, 0)), secondary: "визитов" }}
            />
            <Donut
              title="Устройства"
              slices={data.devices.map(([n, v]) => ({ label: n, value: v }))}
              centerLabel={{ primary: formatNum(data.devices.reduce((s, [, n]) => s + n, 0)), secondary: "визитов" }}
            />
          </section>

          {/* === Топ страниц + города === */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-slide-up-fast">
            <BarList title="Топ страниц"
              items={data.top_pages.map(([url, v]) => ({ label: url, value: v }))}
              emptyText="Просмотров пока нет." unit="просм." />
            <BarList title="Топ городов посетителей"
              items={data.top_cities.map(([c, v]) => ({ label: c, value: v }))}
              variant="neutral" unit="зах." />
          </section>

          {/* === ТОВАРЫ С САЙТА (из «Заказы») === */}
          <section className="mt-8 animate-slide-up-fast">
            <div className="mb-3 flex items-baseline justify-between flex-wrap gap-2">
              <h2 className="text-base font-semibold tracking-tightish">Товары — реальные продажи</h2>
              {data.available_products.length > 0 && (
                <div className="flex items-center gap-2 text-[12px]">
                  <Filter size={12} className="text-ink-soft" />
                  <span className="text-ink-muted">Фильтр:</span>
                  <select
                    value={product || ""}
                    onChange={(e) => setProduct(e.target.value || null)}
                    className="border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand"
                  >
                    <option value="">Все товары</option>
                    {data.available_products.map((p) => (
                      <option key={p} value={p}>{p}</option>
                    ))}
                  </select>
                  {product && (
                    <button onClick={() => setProduct(null)}
                      className="text-[11px] text-ink-soft hover:text-ink flex items-center gap-1">
                      <X size={11} /> сбросить
                    </button>
                  )}
                </div>
              )}
            </div>

            {data.products.length === 0 ? (
              <div className="card p-5 text-[13px] text-ink-subtle">
                За выбранный период нет оплаченных заказов с сайта{product ? ` по товару «${product}»` : ""}.
              </div>
            ) : product && filteredProduct ? (
              <div className="card p-5">
                <div className="text-[12px] text-ink-muted mb-3">
                  <b className="text-ink">{filteredProduct.name}</b>
                  {" · "}
                  {formatNum(filteredProduct.orders)} заказов · {formatNum(filteredProduct.units)} единиц ·{" "}
                  {formatRub(filteredProduct.revenue)} выручки
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
                  <BarList
                    title="По цветам"
                    items={filteredProduct.colors.map(([n, v]) => ({ label: n, value: v }))}
                    unit="ед"
                  />
                  <BarList
                    title="По размерам"
                    items={filteredProduct.sizes.map(([s, v]) => ({ label: s, value: v }))}
                    unit="ед"
                    variant="neutral"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.products.map((p) => (
                  <ProductCard key={p.name} p={p} onClick={() => setProduct(p.name)} />
                ))}
              </div>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}
