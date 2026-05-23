import { useEffect, useState } from "react";
import clsx from "clsx";
import { Filter, X } from "lucide-react";
import { api, type OzonAnalyticsResponse, type ProductBreakdown } from "../api";
import { StatCard } from "../components/StatCard";
import { StatCardsSkeleton } from "../components/Skeleton";
import { Sparkline } from "../components/charts/Sparkline";
import { BarList } from "../components/charts/BarList";
import { Donut } from "../components/charts/Donut";
import { hasApi } from "../env";

function formatRub(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";
}
function formatNum(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
}
function formatPct(n: number, fractionDigits = 1): string {
  return `${n.toFixed(fractionDigits).replace(/\.0$/, "")}%`;
}

const OZON_STATUS_LABELS: Record<string, string> = {
  awaiting_approve: "Ждёт подтверждения",
  awaiting_packaging: "Ждёт сборки",
  awaiting_deliver: "Ждёт отгрузки",
  awaiting_registration: "Ждёт регистрации",
  delivering: "В доставке",
  driver_pickup: "У курьера",
  delivered: "Доставлен",
  cancelled: "Отменён",
  not_accepted: "Не принят",
  arbitration: "Спор",
  client_arbitration: "Спор клиента",
  delivering_failed: "Доставка не удалась",
  sent_by_seller: "Передан в доставку",
  in_transit: "В пути",
};

type PeriodKey = "all" | "today" | "week" | "month" | "year" | "custom";

const PRESETS: Array<{ key: PeriodKey; label: string }> = [
  { key: "all", label: "За всё время" },
  { key: "today", label: "Сегодня" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "year", label: "Год" },
  { key: "custom", label: "Период" },
];

/** Карточка товара с краткой статистикой + клик переключает фильтр */
function ProductCard({
  p, active, onClick,
}: { p: ProductBreakdown; active: boolean; onClick: () => void }) {
  const topColor = p.colors[0];
  const topSize = p.sizes[0];
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        "card text-left p-4 transition-all duration-150 hover:-translate-y-px",
        active ? "ring-2 ring-brand border-brand" : "card-hover",
      )}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h3 className="text-[14px] font-semibold tracking-tightish">{p.name}</h3>
        {active && <span className="text-[10px] text-brand uppercase font-medium">выбран</span>}
      </div>
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
              цвет: <b className="text-ink">{topColor[0]}</b> · {topColor[1]}
            </span>
          )}
          {topSize && (
            <span className="px-2 py-0.5 rounded bg-surface text-ink-muted">
              размер: <b className="text-ink">{topSize[0]}</b> · {topSize[1]}
            </span>
          )}
        </div>
      )}
    </button>
  );
}

export function Ozon() {
  const [data, setData] = useState<OzonAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("all");
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
    // КРИТИЧНО: period="custom" должен передаваться явно (см. фикс 23.05).
    const opts = {
      ...(period === "custom"
        ? { period: "custom", from: from || undefined, to: to || undefined }
        : { period }),
      ...(product ? { product } : {}),
    };
    api
      .ozonAnalytics(opts)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError("Не удалось загрузить аналитику Ozon."))
      .finally(() => setLoading(false));
  }, [period, from, to, product]);

  const subtitle = (() => {
    if (!data) return "";
    if (period === "all") return "за всё время";
    if (period === "today") return "сегодня";
    if (period === "week") return "за эту неделю";
    if (period === "month") return "за этот месяц";
    if (period === "year") return "за этот год";
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
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Селект · Аналитика</h1>
        <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
          Маркетплейс Ozon. Данные обновляются раз в час. Выручка считается без отменённых отправлений.
        </p>
      </header>

      {/* === Hero выручка === */}
      {data && !product && (
        <section className="mb-6 animate-fade-in">
          <div className="card relative overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(800px 240px at 0% 0%, rgba(26,0,136,0.08), transparent 60%)",
              }}
            />
            <div className="relative p-5 lg:p-7">
              <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium">
                Общая выручка Ozon за всё время
              </div>
              <div className="mt-2 text-4xl lg:text-5xl font-semibold tracking-tighter2 tabular-nums text-brand-dark dark:text-white">
                {formatRub(data.lifetime_revenue)}
              </div>
              <div className="mt-2 text-[13px] text-ink-muted">
                {data.lifetime_postings} оплаченных отправлений
                {data.lifetime_postings > 0 &&
                  ` · средний чек ${formatRub(Math.round(data.lifetime_revenue / data.lifetime_postings))}`}
              </div>
            </div>
          </div>
        </section>
      )}

      {/* === Период + селектор товара === */}
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
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className="border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand"
              />
            </label>
            <label className="flex items-center gap-1.5 text-ink-muted">
              по
              <input
                type="date"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className="border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand"
              />
            </label>
          </div>
        )}

        {/* Селектор товара */}
        {data && data.available_products.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Filter size={12} className="text-ink-soft" />
            <span className="text-[12px] text-ink-muted">Товар:</span>
            <select
              value={product || ""}
              onChange={(e) => setProduct(e.target.value || null)}
              className="text-[12px] border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand"
            >
              <option value="">Все товары</option>
              {data.available_products.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
            {product && (
              <button
                onClick={() => setProduct(null)}
                className="text-[11px] text-ink-soft hover:text-ink flex items-center gap-1"
              >
                <X size={11} /> сбросить
              </button>
            )}
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
          <div className="text-[12px] text-ink-subtle mb-2">
            {product ? <span><b>{product}</b> · </span> : null}Показатели {subtitle}
          </div>

          {/* === Финансы периода === */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Выручка" value={formatRub(data.total_revenue)} hint={`${data.total_postings} отправл.`} />
            <StatCard label="К выплате" value={formatRub(data.total_payout)} hint="payout от Ozon" />
            <StatCard
              label="Комиссия"
              value={formatRub(Math.abs(data.total_commission))}
              hint={data.total_revenue > 0 ? `${((Math.abs(data.total_commission) / data.total_revenue) * 100).toFixed(1)}% от выручки` : ""}
            />
            <StatCard label="Средний чек" value={formatRub(Math.round(data.aov))} hint="по периоду" />
          </section>

          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <StatCard label="Сегодня" value={formatRub(data.today_revenue)} hint="с 00:00 МСК" />
            <StatCard label="Неделя" value={formatRub(data.week_revenue)} hint="последние 7 дн." />
            <StatCard label="Месяц" value={formatRub(data.month_revenue)} hint="с 1-го числа" />
            <StatCard label="Отмены" value={formatPct(data.cancel_rate * 100)} hint={`${data.cancelled_count} отправл.`} />
          </section>

          {/* === Дополнительные KPI: возвраты, акции, локальность === */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <StatCard
              label="Возвраты"
              value={formatNum(data.returns_count || 0)}
              hint={`${formatRub(data.returns_value || 0)} · только настоящие (ClientReturn)`}
            />
            <StatCard
              label="Через акции"
              value={`${(data.promotion_share_pct || 0).toFixed(0)}%`}
              hint={`${formatRub(data.promotion_revenue || 0)} в ${formatNum(data.promotion_postings || 0)} отправл.`}
            />
            <StatCard
              label="Локальные продажи"
              value={`${(data.local_share_pct || 0).toFixed(0)}%`}
              hint={`${formatRub(data.local_revenue || 0)} из родного кластера`}
            />
            <StatCard
              label="Премиум-аудитория"
              value={`${(data.premium_share_pct || 0).toFixed(0)}%`}
              hint="заказов от Ozon Premium-покупателей"
            />
          </section>

          {/* === Динамика выручки === */}
          <section className="mt-6 animate-slide-up-fast">
            <Sparkline data={data.daily_revenue} height={180} />
          </section>

          {/* === Возвраты: причины + кластеры + акции === */}
          {((data.top_return_reasons?.length || 0) > 0 || (data.cluster_breakdown?.length || 0) > 0) && (
            <section className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-3 animate-slide-up-fast">
              {data.top_return_reasons && data.top_return_reasons.length > 0 && (
                <BarList
                  title="Топ причин возврата"
                  variant="neutral"
                  items={data.top_return_reasons.map(([reason, n]) => ({ label: reason, value: n }))}
                  unit="шт"
                />
              )}
              {data.cluster_breakdown && data.cluster_breakdown.length > 0 && (
                <div className="card p-4 lg:col-span-2">
                  <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted mb-2">
                    Кластеры → локальность
                    <span className="ml-2 text-[10px] text-ink-subtle normal-case font-normal">
                      высокая локальность = склад рядом с покупателями
                    </span>
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-[12px]">
                      <thead className="text-ink-muted text-[10px] uppercase tracking-wider border-b border-line">
                        <tr>
                          <th className="text-left py-1.5">Кластер</th>
                          <th className="text-right py-1.5">Выручка</th>
                          <th className="text-right py-1.5">Заказов</th>
                          <th className="text-right py-1.5">Локальных</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.cluster_breakdown.slice(0, 10).map((c) => (
                          <tr key={c.cluster} className="border-t border-line-soft">
                            <td className="py-1.5 text-ink">{c.cluster}</td>
                            <td className="py-1.5 text-right tabular-nums">{formatRub(c.revenue)}</td>
                            <td className="py-1.5 text-right tabular-nums text-ink-muted">{c.orders}</td>
                            <td className={`py-1.5 text-right tabular-nums font-medium ${
                              c.local_pct >= 70 ? "text-emerald-700 dark:text-emerald-300"
                              : c.local_pct >= 50 ? "text-amber-700 dark:text-amber-300"
                              : "text-rose-700 dark:text-rose-300"
                            }`}>
                              {c.local_pct.toFixed(0)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </section>
          )}

          {/* === Топ акций === */}
          {data.top_actions && data.top_actions.length > 0 && (
            <section className="mt-3 animate-slide-up-fast">
              <BarList
                title="Топ акций по выручке"
                variant="neutral"
                items={data.top_actions.map((a) => ({ label: a.name, value: a.revenue }))}
                unit="₽"
              />
            </section>
          )}

          {/* === Если товар выбран — детали === */}
          {product && filteredProduct && (
            <>
              <section className="mt-6 animate-slide-up-fast">
                <div className="card p-5">
                  <h2 className="text-base font-semibold tracking-tightish mb-1">{product}</h2>
                  <div className="text-[12px] text-ink-muted mb-4">
                    {formatNum(filteredProduct.orders)} заказов · {formatNum(filteredProduct.units)} единиц ·{" "}
                    {formatRub(filteredProduct.revenue)} выручки
                  </div>
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
                    <Donut
                      title="По цветам"
                      slices={filteredProduct.colors.map(([n, v]) => ({ label: n, value: v }))}
                      centerLabel={{
                        primary: formatNum(filteredProduct.units),
                        secondary: "единиц",
                      }}
                    />
                    <BarList
                      title="По размерам"
                      items={filteredProduct.sizes.map(([s, v]) => ({ label: s, value: v }))}
                      unit="ед"
                    />
                    <BarList
                      title="Топ городов"
                      items={(filteredProduct.cities || []).map(([c, v]) => ({ label: c, value: v }))}
                      unit="зак."
                      variant="neutral"
                    />
                  </div>
                </div>
              </section>
            </>
          )}

          {/* === Если товар НЕ выбран — все товары рядом === */}
          {!product && data.products.length > 0 && (
            <section className="mt-6 animate-slide-up-fast">
              <div className="mb-3 flex items-baseline justify-between">
                <h2 className="text-base font-semibold tracking-tightish">Товары — нажмите для подробностей</h2>
                <span className="text-[11px] text-ink-subtle">
                  {data.products.length} {data.products.length === 1 ? "позиция" : "позиций"}
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.products.map((p) => (
                  <ProductCard
                    key={p.name}
                    p={p}
                    active={false}
                    onClick={() => setProduct(p.name)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* === Схема + статусы === */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-slide-up-fast">
            <Donut
              title="Схема работы"
              slices={Object.entries(data.scheme_counts).map(([s, c]) => ({ label: s, value: c }))}
              centerLabel={{
                primary: Object.values(data.scheme_counts).reduce((s, n) => s + n, 0).toString(),
                secondary: "отправл.",
              }}
            />
            <BarList
              title="Распределение по статусам"
              variant="neutral"
              items={Object.entries(data.status_counts)
                .sort((a, b) => b[1] - a[1])
                .map(([s, c]) => ({ label: OZON_STATUS_LABELS[s] ?? s, value: c }))}
            />
          </section>

          {/* === Города и склады отгрузки (по всему срезу) === */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-slide-up-fast">
            <BarList
              title="Топ городов"
              items={data.top_cities.map(([c, v]) => ({ label: c, value: v }))}
              variant="neutral"
              unit="зак."
            />
            <BarList
              title="Топ складов Ozon"
              items={data.top_warehouses.map(([w, v]) => ({ label: w, value: v }))}
              variant="neutral"
              unit="зак."
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}
