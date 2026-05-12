import { useEffect, useState } from "react";
import clsx from "clsx";
import { api, type OzonAnalyticsResponse } from "../api";
import { StatCard } from "../components/StatCard";
import { StatCardsSkeleton } from "../components/Skeleton";
import { Sparkline } from "../components/charts/Sparkline";
import { BarList } from "../components/charts/BarList";
import { Donut } from "../components/charts/Donut";
import { hasApi } from "../env";

function formatRub(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";
}
function formatPct(n: number): string {
  return `${(n * 100).toFixed(1).replace(/\.0$/, "")}%`;
}

// Ozon-овские status коды → русские лейблы
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

export function Ozon() {
  const [data, setData] = useState<OzonAnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("all");
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
      .ozonAnalytics(opts)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError("Не удалось загрузить аналитику Ozon. Попробуйте обновить страницу."))
      .finally(() => setLoading(false));
  }, [period, from, to]);

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

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1200px] animate-slide-up">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Ozon</h1>
        <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
          Заказы с маркетплейса. Данные обновляются каждый час из Ozon Seller API.
          Выручка — без отменённых.
        </p>
      </header>

      {/* === Hero: общая выручка за все время === */}
      {data && (
        <section className="mb-6 animate-fade-in">
          <div className="card relative overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "radial-gradient(800px 240px at 0% 0%, rgba(26,0,136,0.08), transparent 60%), radial-gradient(600px 200px at 100% 100%, rgba(26,0,136,0.05), transparent 60%)",
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

          {/* === Финансы периода === */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Выручка"
              value={formatRub(data.total_revenue)}
              hint={`${data.total_postings} отправл.`}
            />
            <StatCard
              label="К выплате"
              value={formatRub(data.total_payout)}
              hint="payout от Ozon"
            />
            <StatCard
              label="Комиссия"
              value={formatRub(Math.abs(data.total_commission))}
              hint={
                data.total_revenue > 0
                  ? `${((Math.abs(data.total_commission) / data.total_revenue) * 100).toFixed(1)}% от выручки`
                  : ""
              }
            />
            <StatCard
              label="Средний чек"
              value={formatRub(Math.round(data.aov))}
              hint="по периоду"
            />
          </section>

          {/* === Скользящие окна + отмены === */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <StatCard
              label="Сегодня"
              value={formatRub(data.today_revenue)}
              hint="с 00:00 МСК"
            />
            <StatCard
              label="Неделя"
              value={formatRub(data.week_revenue)}
              hint="последние 7 дн."
            />
            <StatCard
              label="Месяц"
              value={formatRub(data.month_revenue)}
              hint="с 1-го числа"
            />
            <StatCard
              label="Отмены"
              value={formatPct(data.cancel_rate)}
              hint={`${data.cancelled_count} отправл.`}
            />
          </section>

          {/* === Динамика выручки === */}
          <section className="mt-6 animate-slide-up-fast">
            <Sparkline data={data.daily_revenue} height={180} />
          </section>

          {/* === Топ товары + SKU === */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-slide-up-fast">
            <BarList
              title="Топ товаров"
              items={data.top_products.map(([name, count]) => ({ label: name, value: count }))}
              emptyText="Данных пока нет."
              unit="шт"
            />
            <BarList
              title="Топ SKU"
              items={data.top_skus.map(([sku, count]) => ({ label: sku, value: count }))}
              emptyText="Данных пока нет."
              unit="шт"
              variant="neutral"
            />
          </section>

          {/* === Схема + статусы === */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-slide-up-fast">
            <Donut
              title="Схема работы"
              slices={Object.entries(data.scheme_counts).map(([scheme, count]) => ({
                label: scheme,
                value: count,
              }))}
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
                .map(([status, count]) => ({
                  label: OZON_STATUS_LABELS[status] ?? status,
                  value: count,
                }))}
            />
          </section>

          {/* === Города + склады отгрузки === */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-slide-up-fast">
            <BarList
              title="Топ городов"
              items={data.top_cities.map(([city, count]) => ({ label: city, value: count }))}
              variant="neutral"
              unit="зак."
            />
            <BarList
              title="Топ складов Ozon"
              items={data.top_warehouses.map(([wh, count]) => ({ label: wh, value: count }))}
              variant="neutral"
              unit="зак."
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}
