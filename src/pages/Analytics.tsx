import { useEffect, useState } from "react";
import { api, ApiError, type AnalyticsResponse } from "../api";
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

const DELIVERY_LABELS: Record<string, string> = {
  ozon_pvz: "Ozon ПВЗ",
  yandex_pvz: "Яндекс ПВЗ",
  yandex_courier: "Яндекс курьер",
  sdek_pvz: "СДЭК ПВЗ",
  sdek_courier: "СДЭК курьер",
  "5post_pvz": "5Post",
  post_russia: "Почта России",
  self_pickup: "Самовывоз",
};

const STATUS_LABELS: Record<string, string> = {
  new: "Новые",
  confirmed: "Подтвержденные",
  in_pack: "В сборке",
  shipped: "Отгруженные",
  delivered: "Доставленные",
  refunded: "Возвраты",
  cancelled: "Отмененные",
};

export function Analytics() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasApi) {
      setError("Сервис временно недоступен.");
      return;
    }
    api
      .analytics()
      .then(setData)
      .catch(() => {
        setError("Не удалось загрузить аналитику. Попробуйте обновить страницу.");
      });
  }, []);

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1200px] animate-slide-up">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Аналитика</h1>
        <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
          В выручке учитываем только реальные продажи — без отмен и возвратов.
        </p>
      </header>

      {error && (
        <div className="mb-4 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 animate-fade-in">
          {error}
        </div>
      )}

      {!data ? (
        error ? (
          <div className="card p-8 text-center text-ink-muted">Нет данных</div>
        ) : (
          <StatCardsSkeleton />
        )
      ) : (
        <>
          {/* === Финансы === */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Сегодня" value={formatRub(data.today_revenue)} hint="с 00:00" />
            <StatCard
              label="Эта неделя"
              value={formatRub(data.week_revenue)}
              hint="с понедельника"
            />
            <StatCard
              label="Этот месяц"
              value={formatRub(data.month_revenue)}
              hint="с 1-го числа"
            />
            <StatCard
              label="Средний чек"
              value={formatRub(Math.round(data.aov))}
              hint="за все время"
            />
          </section>

          {/* === Конверсия / клиенты / возвраты === */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-3">
            <StatCard
              label="Конверсия"
              value={formatPct(data.conversion_rate)}
              hint="дошли до покупателя"
            />
            <StatCard
              label="Возвраты"
              value={formatPct(data.refund_rate)}
              hint="отмены и возвраты"
            />
            <StatCard
              label="Клиенты"
              value={data.unique_customers}
              hint="разных покупателей"
            />
            <StatCard
              label="Повторные"
              value={`${data.repeat_customers} · ${formatPct(data.repeat_rate)}`}
              hint="купили несколько раз"
            />
          </section>

          {/* === Динамика выручки === */}
          <section className="mt-6 animate-slide-up-fast">
            <Sparkline data={data.daily_revenue} height={180} />
          </section>

          {/* === Товары + размеры === */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-slide-up-fast">
            <BarList
              title="Топ товаров"
              items={data.top_products.map(([name, count]) => ({ label: name, value: count }))}
              emptyText="Заказов с товарами пока нет."
              unit="шт"
            />
            <BarList
              title="Размеры"
              items={data.top_sizes.map(([size, count]) => ({ label: size, value: count }))}
              emptyText="Размеров пока нет."
              unit="шт"
            />
          </section>

          {/* === Доставка + статусы === */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-slide-up-fast">
            <Donut
              title="Способ доставки"
              slices={data.delivery_methods.map(([method, count]) => ({
                label: DELIVERY_LABELS[method] ?? method,
                value: count,
              }))}
              centerLabel={{
                primary: data.delivery_methods.reduce((s, [, n]) => s + n, 0).toString(),
                secondary: "заказов",
              }}
            />
            <BarList
              title="Распределение по статусам"
              variant="neutral"
              items={Object.entries(data.status_counts)
                .sort((a, b) => b[1] - a[1])
                .map(([status, count]) => ({
                  label: STATUS_LABELS[status] ?? status,
                  value: count,
                }))}
            />
          </section>

          {/* === География + ожидают отгрузки === */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3 animate-slide-up-fast">
            <BarList
              title="Топ городов"
              items={data.top_cities.map(([city, count]) => ({ label: city, value: count }))}
              variant="neutral"
              unit="зак."
            />

            <div className="card card-hover p-4 flex flex-col justify-between transition-transform duration-200 hover:-translate-y-px">
              <div>
                <div className="text-sm font-semibold tracking-tightish">Ожидают отгрузки</div>
                <div className="text-[12px] text-ink-muted mt-0.5">
                  новые, подтвержденные, в сборке
                </div>
              </div>
              <div className="mt-4 flex items-baseline gap-2">
                <div className="text-4xl font-semibold tracking-tighter2 tabular-nums text-brand-dark">
                  {data.pending_count}
                </div>
                <div className="text-ink-subtle text-[12px]">из {data.total_orders} всего</div>
              </div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}
