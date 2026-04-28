import { useEffect, useState } from "react";
import { api, ApiError, type AnalyticsResponse } from "../api";
import { StatCard } from "../components/StatCard";
import { hasApi } from "../env";

function formatRub(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";
}

export function Analytics() {
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasApi) {
      setError("VITE_API_BASE_URL не задан — данные API не подключены.");
      return;
    }
    api
      .analytics()
      .then(setData)
      .catch((e: unknown) => {
        if (e instanceof ApiError) setError(`API: ${e.message}`);
        else setError(String(e));
      });
  }, []);

  return (
    <div className="px-8 py-8 max-w-[1200px]">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Аналитика</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Выручка считается по заказам в статусах confirmed, in_pack, shipped, delivered.
        </p>
      </header>

      {error && (
        <div className="mb-4 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
          {error}
        </div>
      )}

      {!data ? (
        <div className="card p-8 text-center text-ink-muted">{error ? "Нет данных" : "Загрузка…"}</div>
      ) : (
        <>
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard label="Сегодня" value={formatRub(data.today_revenue)} hint="с 00:00" />
            <StatCard label="Эта неделя" value={formatRub(data.week_revenue)} hint="с понедельника" />
            <StatCard label="Этот месяц" value={formatRub(data.month_revenue)} hint="с 1-го числа" />
            <StatCard label="Средний чек" value={formatRub(Math.round(data.aov))} hint="за всё время" />
          </section>

          <section className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div className="card p-4">
              <h2 className="text-sm font-semibold mb-3">Распределение по статусам</h2>
              {Object.keys(data.status_counts).length === 0 ? (
                <Empty />
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {Object.entries(data.status_counts)
                    .sort((a, b) => b[1] - a[1])
                    .map(([status, count]) => (
                      <li key={status} className="flex items-center justify-between text-[13px]">
                        <span className="text-ink">{status}</span>
                        <span className="text-ink-muted tabular-nums">{count}</span>
                      </li>
                    ))}
                </ul>
              )}
            </div>

            <div className="card p-4">
              <h2 className="text-sm font-semibold mb-3">Топ городов</h2>
              {data.top_cities.length === 0 ? (
                <Empty />
              ) : (
                <ul className="flex flex-col gap-1.5">
                  {data.top_cities.map(([city, count]) => (
                    <li key={city} className="flex items-center justify-between text-[13px]">
                      <span className="text-ink truncate">{city}</span>
                      <span className="text-ink-muted tabular-nums">{count}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>

          <section className="mt-8">
            <div className="card p-4 flex items-center justify-between">
              <div>
                <div className="text-sm font-semibold">Ожидают отгрузки</div>
                <div className="text-[12px] text-ink-muted mt-0.5">статусы new / confirmed / in_pack</div>
              </div>
              <div className="text-3xl font-semibold tabular-nums">{data.pending_count}</div>
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Empty() {
  return <div className="text-[13px] text-ink-subtle">Данных пока нет.</div>;
}
