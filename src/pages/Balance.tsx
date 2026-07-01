import { useEffect, useState } from "react";
import { Snowflake, TrendingUp, TrendingDown } from "lucide-react";
import clsx from "clsx";
import { api, ApiError, type BalanceResponse } from "../api";
import { StatCard } from "../components/StatCard";
import { Sparkline } from "../components/charts/Sparkline";
import { StatCardsSkeleton } from "../components/Skeleton";
import { hasApi } from "../env";

function rub(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";
}

export function Balance() {
  const [data, setData] = useState<BalanceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasApi) {
      setError("Сервис временно недоступен.");
      return;
    }
    api
      .inventoryBalance()
      .then(setData)
      .catch((e) =>
        setError(e instanceof ApiError ? `Ошибка ${e.status}` : "Не удалось загрузить баланс."),
      );
  }, []);

  const maxModelValue = data ? Math.max(...data.models.map((m) => m.value), 1) : 1;

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1200px] animate-slide-up">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Баланс товара</h1>
        <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
          Сколько денег вложено в товарные остатки (по себестоимости): наш склад + ФФ + Ozon FBO.
          {data?.updated_at && (
            <span className="text-ink-subtle"> · Ozon обновлён {data.updated_at.slice(0, 16).replace("T", " ")}</span>
          )}
        </p>
      </header>

      {error && (
        <div className="mb-4 text-[13px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          {error}
        </div>
      )}

      {!data && !error ? (
        <StatCardsSkeleton />
      ) : data ? (
        <>
          {/* Hero: всего денег в товаре */}
          <section className="mb-6">
            <div className="card relative overflow-hidden">
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background:
                    "radial-gradient(800px 240px at 0% 0%, rgba(218,5,0,0.08), transparent 60%)",
                }}
              />
              <div className="relative p-5 lg:p-7">
                <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium">
                  Всего денег в товаре
                </div>
                <div className="mt-2 text-4xl lg:text-5xl font-semibold tracking-tighter2 tabular-nums text-brand-dark dark:text-white">
                  {rub(data.total_value)}
                </div>
                <div className="mt-2 text-[13px] text-ink-muted tabular-nums">
                  {data.total_units.toLocaleString("ru-RU")} единиц на складах
                </div>
              </div>
            </div>
          </section>

          {/* По складам */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
            {data.warehouses.map((w) => {
              const pct = data.total_value ? Math.round((w.value / data.total_value) * 100) : 0;
              return (
                <StatCard
                  key={w.key}
                  label={w.label}
                  value={rub(w.value)}
                  hint={`${w.units.toLocaleString("ru-RU")} ед · ${pct}% капитала`}
                />
              );
            })}
          </section>

          {/* Замороженный капитал */}
          {data.frozen_value > 0 && (
            <section className="mb-6">
              <div className="card p-4 border-l-4 border-l-sky-400 dark:border-l-sky-500 flex items-start gap-3">
                <Snowflake size={20} className="text-sky-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-[14px] font-semibold text-ink">
                    Заморожено в куртках: {rub(data.frozen_value)}
                  </div>
                  <div className="text-[12px] text-ink-muted mt-0.5">
                    {data.total_value
                      ? `${Math.round((data.frozen_value / data.total_value) * 100)}% всего товарного капитала`
                      : ""}{" "}
                    в позициях с минимальными продажами. Кандидат на распродажу / снижение цены.
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Динамика капитала */}
          <section className="mb-6">
            <div className="text-[12px] text-ink-subtle mb-2 uppercase tracking-wider font-medium">
              Динамика капитала в товаре
            </div>
            {data.snapshots.length >= 2 ? (
              (() => {
                const first = data.snapshots[0].total;
                const last = data.snapshots[data.snapshots.length - 1].total;
                const delta = last - first;
                return (
                  <div className="card p-4">
                    <div className="flex items-center gap-2 mb-2 text-[13px]">
                      <span className="text-ink-muted">За период:</span>
                      <span
                        className={clsx(
                          "inline-flex items-center gap-1 font-medium tabular-nums",
                          delta >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300",
                        )}
                      >
                        {delta >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                        {delta >= 0 ? "+" : ""}
                        {rub(delta)}
                      </span>
                    </div>
                    <Sparkline
                      data={data.snapshots.map((s) => ({ date: s.date, revenue: s.total, orders: s.total }))}
                      height={160}
                    />
                  </div>
                );
              })()
            ) : (
              <div className="card p-5 text-center text-[13px] text-ink-muted">
                📈 График динамики появится со следующего дня — снапшот баланса
                делается автоматически каждое утро. Сейчас накоплена 1 точка.
              </div>
            )}
          </section>

          {/* По моделям */}
          <section>
            <div className="text-[12px] text-ink-subtle mb-2 uppercase tracking-wider font-medium">
              Деньги в товаре по моделям
            </div>
            <div className="card overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-surface-alt border-b border-line text-ink-muted">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-[10px] uppercase tracking-wider">Модель</th>
                    <th className="px-3 py-2 text-left font-medium text-[10px] uppercase tracking-wider">Цвет</th>
                    <th className="px-3 py-2 text-right font-medium text-[10px] uppercase tracking-wider">Ед.</th>
                    <th className="px-3 py-2 text-right font-medium text-[10px] uppercase tracking-wider">Сумма</th>
                  </tr>
                </thead>
                <tbody>
                  {data.models.map((m) => (
                    <tr
                      key={m.model}
                      className={clsx(
                        "border-t border-line",
                        m.frozen && "bg-sky-50/50 dark:bg-sky-900/10",
                      )}
                    >
                      <td className="px-3 py-2.5">
                        <span className="text-ink">{m.display}</span>
                        {m.frozen && (
                          <span className="ml-1.5 inline-flex items-center gap-0.5 text-[10px] text-sky-700 dark:text-sky-300">
                            <Snowflake size={10} /> заморожено
                          </span>
                        )}
                        {/* мини-бар доли */}
                        <div className="mt-1 h-1 rounded-full bg-surface-alt overflow-hidden max-w-[160px]">
                          <div
                            className={clsx("h-full rounded-full", m.frozen ? "bg-sky-400" : "bg-brand/60")}
                            style={{ width: `${Math.round((m.value / maxModelValue) * 100)}%` }}
                          />
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-ink-muted">{m.color}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums text-ink-muted">{m.units}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium text-ink">{rub(m.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
