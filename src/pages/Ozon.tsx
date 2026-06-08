import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { api, ApiError, type OzonDashboard } from "../api";
import { StatCard } from "../components/StatCard";
import { StatCardsSkeleton } from "../components/Skeleton";
import { hasApi } from "../env";

function rub(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";
}
function num(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n);
}

type Tab = "clusters" | "articles";
type SortKey = "revenue" | "orders" | "views" | "ctr" | "conv_order";

export function Ozon() {
  const [data, setData] = useState<OzonDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("clusters");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");

  useEffect(() => {
    if (!hasApi) {
      setError("Сервис временно недоступен.");
      return;
    }
    api.ozonDashboard().then(setData).catch((e) =>
      setError(e instanceof ApiError ? `Ошибка ${e.status}` : "Не удалось загрузить дашборд."),
    );
  }, []);

  const rows = useMemo(() => {
    if (!data) return [];
    const src = tab === "clusters" ? data.clusters : data.articles;
    return [...src].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
  }, [data, tab, sortKey]);

  const maxRev = useMemo(() => (data ? Math.max(...data.dynamics.map((d) => d.revenue), 1) : 1), [data]);
  const maxSpent = useMemo(() => (data ? Math.max(...data.dynamics.map((d) => d.spent), 1) : 1), [data]);

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1280px] animate-slide-up">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Селект · Аналитика</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Сквозная воронка Ozon + реклама за 30 дней.
          {data?.period_from && (
            <span className="text-ink-subtle"> {data.period_from} — {data.period_to}</span>
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
          {/* KPI — приоритетные показатели */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <StatCard label="Выручка" value={rub(data.kpi.revenue)} hint={`${num(data.kpi.orders)} заказов`} accent />
            <StatCard label="Показы" value={num(data.kpi.views)} hint={`CTR ${data.kpi.ctr}%`} />
            <StatCard label="Расход рекламы" value={rub(data.kpi.ad_spent)} hint={`ДРР ${data.kpi.drr}%`} />
            <StatCard label="Отмены / Возвраты" value={`${data.kpi.cancellations} / ${data.kpi.returns}`} hint="за период" />
          </section>

          {/* Воронка конверсии */}
          <section className="card p-4 lg:p-5 mb-3">
            <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium mb-3">Воронка конверсии</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <FunnelStep label="Показы" value={num(data.kpi.views)} sub="" />
              <FunnelStep label="Карточка" value={num(data.kpi.pdp)} sub={`CTR ${data.kpi.ctr}%`} />
              <FunnelStep label="В корзину" value={num(data.kpi.carts)} sub={`${data.kpi.conv_cart}% из карточки`} />
              <FunnelStep label="Заказы" value={num(data.kpi.orders)} sub={`${data.kpi.conv_order}% из корзины`} accent />
            </div>
          </section>

          {/* Динамика выручка + расход */}
          <section className="card p-4 lg:p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium">Динамика по дням</div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-brand-dark dark:text-white">
                  <span className="w-2.5 h-2.5 rounded-sm bg-brand inline-block" /> выручка
                </span>
                <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300">
                  <span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> реклама
                </span>
              </div>
            </div>
            <div className="flex gap-[3px] h-32">
              {data.dynamics.map((d) => (
                <div
                  key={d.date}
                  className="flex-1 h-full flex flex-col justify-end gap-[2px] relative"
                  title={`${d.date}: выручка ${rub(d.revenue)}, реклама ${rub(d.spent)}`}
                >
                  <div className="w-full bg-brand/70 rounded-sm min-h-[1px]" style={{ height: `${(d.revenue / maxRev) * 70}%` }} />
                  <div className="w-full bg-amber-400/70 rounded-sm min-h-[1px]" style={{ height: `${(d.spent / maxSpent) * 25}%` }} />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-1.5 text-[10px] text-ink-subtle">
              <span>{data.dynamics[0]?.date.slice(5)}</span>
              <span>{data.dynamics[data.dynamics.length - 1]?.date.slice(5)}</span>
            </div>
          </section>

          {/* Таблица: склейки / артикулы */}
          <section>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex gap-1.5">
                {(["clusters", "articles"] as Tab[]).map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={clsx(
                      "px-3 py-1.5 text-[12px] rounded-md border transition-colors",
                      tab === t ? "bg-brand text-white border-brand" : "bg-surface border-line text-ink-muted hover:bg-surface-hover",
                    )}
                  >
                    {t === "clusters" ? "По склейкам (модели)" : "По артикулам"}
                  </button>
                ))}
              </div>
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="text-[12px] border border-line rounded-md px-2 py-1.5 bg-surface text-ink focus:outline-none focus:border-brand"
              >
                <option value="revenue">Сортировка: выручка</option>
                <option value="orders">Заказы</option>
                <option value="views">Показы</option>
                <option value="ctr">CTR</option>
                <option value="conv_order">Конверсия в заказ</option>
              </select>
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full text-[12px] min-w-[760px]">
                <thead className="bg-surface-alt border-b border-line text-ink-muted">
                  <tr>
                    <Th>{tab === "clusters" ? "Модель" : "Артикул"}</Th>
                    <Th align="right">Показы</Th>
                    <Th align="right">Карточка</Th>
                    <Th align="right">CTR</Th>
                    <Th align="right">Корзины</Th>
                    <Th align="right">Заказы</Th>
                    <Th align="right">Конв.</Th>
                    <Th align="right">Выручка</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isCluster = "model" in r;
                    const key = isCluster ? (r as { model: string }).model : (r as { offer_id: string }).offer_id;
                    const lowCtr = r.ctr < 0.5 && r.views > 5000;
                    return (
                      <tr key={key} className="border-t border-line hover:bg-surface-hover">
                        <Td>
                          <div className="text-ink truncate max-w-[260px]">
                            {isCluster
                              ? `${(r as { display: string }).display} · ${(r as { color: string }).color}`
                              : (r as { name: string; offer_id: string }).name || (r as { offer_id: string }).offer_id}
                          </div>
                          <div className="text-ink-subtle text-[10px] font-mono">
                            {isCluster
                              ? `${(r as { model: string }).model} · ${(r as { skus: number }).skus} SKU`
                              : (r as { offer_id: string }).offer_id}
                          </div>
                        </Td>
                        <Td align="right" className="tabular-nums">{num(r.views)}</Td>
                        <Td align="right" className="tabular-nums">{num(r.pdp)}</Td>
                        <Td align="right" className={clsx("tabular-nums", lowCtr && "text-rose-600 dark:text-rose-400 font-medium")}>
                          {r.ctr}%
                        </Td>
                        <Td align="right" className="tabular-nums">{num(r.carts)}</Td>
                        <Td align="right" className="tabular-nums font-medium">{num(r.orders)}</Td>
                        <Td align="right" className="tabular-nums text-ink-muted">{r.conv_order}%</Td>
                        <Td align="right" className="tabular-nums font-medium">{rub(r.revenue)}</Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-ink-subtle">
              <span className="text-rose-600 dark:text-rose-400">Красный CTR</span> — много показов, мало кликов: проблема с главным фото или ценой.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function FunnelStep({ label, value, sub, accent = false }: { label: string; value: string; sub: string; accent?: boolean }) {
  return (
    <div className={clsx("rounded-lg p-3 border", accent ? "bg-brand-tint border-brand/30" : "bg-surface-alt border-line")}>
      <div className="text-[11px] text-ink-muted">{label}</div>
      <div className="text-lg font-semibold tracking-tight tabular-nums text-ink mt-0.5">{value}</div>
      {sub && <div className="text-[10px] text-ink-subtle mt-0.5">{sub}</div>}
    </div>
  );
}

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={clsx("px-3 py-2 font-medium text-[10px] uppercase tracking-wider", align === "right" ? "text-right" : "text-left")}>
      {children}
    </th>
  );
}
function Td({ children, align = "left", className = "" }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={clsx("px-3 py-2.5 align-top", align === "right" && "text-right", className)}>{children}</td>;
}
