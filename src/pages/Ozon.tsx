import { Fragment, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, AlertTriangle, TrendingUp, Flame } from "lucide-react";
import { api, ApiError, type OzonDashboard, type OzonCluster, type OzonTimelinePoint } from "../api";
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
type SortKey = "revenue" | "orders" | "views" | "ctr" | "conv_order" | "drr";

export function Ozon() {
  const [data, setData] = useState<OzonDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("clusters");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Record<string, OzonTimelinePoint[]>>({});

  useEffect(() => {
    if (!hasApi) { setError("Сервис временно недоступен."); return; }
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

  async function toggleRow(key: string) {
    if (openRow === key) { setOpenRow(null); return; }
    setOpenRow(key);
    if (!timeline[key]) {
      try {
        const r = await api.ozonTimeline(key, tab === "clusters" ? "cluster" : "article");
        setTimeline((t) => ({ ...t, [key]: r.daily }));
      } catch { /* ignore */ }
    }
  }

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1280px] animate-slide-up">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Селект · Аналитика</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Сквозная воронка Ozon + реклама/ДРР за 30 дней.
          {data?.period_from && <span className="text-ink-subtle"> {data.period_from} — {data.period_to}</span>}
        </p>
      </header>

      {error && (
        <div className="mb-4 text-[13px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">{error}</div>
      )}

      {!data && !error ? (
        <StatCardsSkeleton />
      ) : data ? (
        <>
          {/* KPI */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
            <StatCard label="Выручка" value={rub(data.kpi.revenue)} hint={`${num(data.kpi.orders)} заказов`} accent />
            <StatCard label="Чистая выручка" value={rub(data.insights.net_revenue)} hint="выручка − реклама" />
            <StatCard label="Расход рекламы" value={rub(data.kpi.ad_spent)} hint={`ДРР ${data.kpi.drr}%`} />
            <StatCard label="Отмены / Возвраты" value={`${data.kpi.cancellations} / ${data.kpi.returns}`} hint="за период" />
          </section>

          {/* Воронка */}
          <section className="card p-4 lg:p-5 mb-3">
            <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium mb-3">Воронка конверсии</div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <FunnelStep label="Показы" value={num(data.kpi.views)} sub="" />
              <FunnelStep label="Карточка" value={num(data.kpi.pdp)} sub={`CTR ${data.kpi.ctr}%`} />
              <FunnelStep label="В корзину" value={num(data.kpi.carts)} sub={`${data.kpi.conv_cart}% из карточки`} />
              <FunnelStep label="Заказы" value={num(data.kpi.orders)} sub={`${data.kpi.conv_order}% из корзины`} accent />
            </div>
          </section>

          {/* Инсайты */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-4">
            <InsightCard icon={<AlertTriangle size={15} />} tone="rose"
              title="Провал воронки — мало кликов"
              sub="Много показов, низкий CTR → проблема главного фото или цены"
              items={data.insights.funnel_leak.map((c) => ({ label: `${c.display} · ${c.color}`, value: `CTR ${c.ctr}%` }))} />
            <InsightCard icon={<Flame size={15} />} tone="rose"
              title="Реклама съедает выручку (ДРР ≥ 30%)"
              sub="Кандидаты урезать рекламный бюджет"
              items={data.insights.high_drr.map((c) => ({ label: `${c.display} · ${c.color}`, value: `ДРР ${c.drr}%` }))} />
            <InsightCard icon={<TrendingUp size={15} />} tone="emerald"
              title="Эффективная реклама (ДРР < 10%)"
              sub="Можно лить больше бюджета — окупается"
              items={data.insights.low_drr.map((c) => ({ label: `${c.display} · ${c.color}`, value: `ДРР ${c.drr}%` }))} />
            <InsightCard icon={<AlertTriangle size={15} />} tone="amber"
              title="Высокие отмены / мёртвый трафик"
              sub="Отмен >30% или показы без заказов"
              items={[...data.insights.high_cancel.map((c) => ({ label: `${c.display}`, value: `${c.cancellations} отмен` })),
                      ...data.insights.zero_orders.map((c) => ({ label: `${c.display}`, value: `0 заказов` }))].slice(0, 5)} />
          </section>

          {/* Динамика */}
          <section className="card p-4 lg:p-5 mb-4">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium">Динамика по дням</div>
              <div className="flex items-center gap-3 text-[11px]">
                <span className="flex items-center gap-1 text-brand-dark dark:text-white"><span className="w-2.5 h-2.5 rounded-sm bg-brand inline-block" /> выручка</span>
                <span className="flex items-center gap-1 text-amber-700 dark:text-amber-300"><span className="w-2.5 h-2.5 rounded-sm bg-amber-400 inline-block" /> реклама</span>
              </div>
            </div>
            <div className="flex gap-[3px] h-32">
              {data.dynamics.map((d) => (
                <div key={d.date} className="flex-1 h-full flex flex-col justify-end gap-[2px]" title={`${d.date}: выручка ${rub(d.revenue)}, реклама ${rub(d.spent)}`}>
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

          {/* Таблица */}
          <section>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <div className="flex gap-1.5">
                {(["clusters", "articles"] as Tab[]).map((t) => (
                  <button key={t} onClick={() => { setTab(t); setOpenRow(null); }}
                    className={clsx("px-3 py-1.5 text-[12px] rounded-md border transition-colors",
                      tab === t ? "bg-brand text-white border-brand" : "bg-surface border-line text-ink-muted hover:bg-surface-hover")}>
                    {t === "clusters" ? "По склейкам (модели)" : "По артикулам"}
                  </button>
                ))}
              </div>
              <select value={sortKey} onChange={(e) => setSortKey(e.target.value as SortKey)}
                className="text-[12px] border border-line rounded-md px-2 py-1.5 bg-surface text-ink focus:outline-none focus:border-brand">
                <option value="revenue">Сортировка: выручка</option>
                <option value="orders">Заказы</option>
                <option value="views">Показы</option>
                <option value="ctr">CTR</option>
                <option value="conv_order">Конверсия в заказ</option>
                <option value="drr">ДРР</option>
              </select>
            </div>

            <div className="card overflow-x-auto">
              <table className="w-full text-[12px] min-w-[860px]">
                <thead className="bg-surface-alt border-b border-line text-ink-muted">
                  <tr>
                    <Th>{tab === "clusters" ? "Модель" : "Артикул"}</Th>
                    <Th align="right">Показы</Th>
                    <Th align="right">CTR</Th>
                    <Th align="right">Заказы</Th>
                    <Th align="right">Конв.</Th>
                    <Th align="right">Выручка</Th>
                    <Th align="right">Реклама</Th>
                    <Th align="right">ДРР</Th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => {
                    const isCluster = "model" in r;
                    const tlKey = isCluster ? (r as OzonCluster).model : (r as { sku_ozon: string }).sku_ozon;
                    const lowCtr = r.ctr < 0.5 && r.views > 5000;
                    const highDrr = r.drr >= 30;
                    const open = openRow === tlKey;
                    const tl = timeline[tlKey];
                    return (
                      <Fragment key={tlKey}>
                        <tr onClick={() => toggleRow(tlKey)}
                          className="border-t border-line hover:bg-surface-hover cursor-pointer">
                          <Td>
                            <div className="flex items-center gap-1.5">
                              <ChevronDown size={12} className={clsx("text-ink-soft transition-transform", open && "rotate-180 text-brand")} />
                              <div>
                                <div className="text-ink truncate max-w-[240px]">
                                  {isCluster ? `${(r as OzonCluster).display} · ${(r as OzonCluster).color}`
                                    : (r as { name: string; offer_id: string }).name || (r as { offer_id: string }).offer_id}
                                </div>
                                <div className="text-ink-subtle text-[10px] font-mono">
                                  {isCluster ? `${(r as OzonCluster).model} · ${(r as OzonCluster).skus} SKU` : (r as { offer_id: string }).offer_id}
                                </div>
                              </div>
                            </div>
                          </Td>
                          <Td align="right" className="tabular-nums">{num(r.views)}</Td>
                          <Td align="right" className={clsx("tabular-nums", lowCtr && "text-rose-600 dark:text-rose-400 font-medium")}>{r.ctr}%</Td>
                          <Td align="right" className="tabular-nums font-medium">{num(r.orders)}</Td>
                          <Td align="right" className="tabular-nums text-ink-muted">{r.conv_order}%</Td>
                          <Td align="right" className="tabular-nums font-medium">{rub(r.revenue)}</Td>
                          <Td align="right" className="tabular-nums text-ink-muted">{rub(r.ad_spent)}</Td>
                          <Td align="right" className={clsx("tabular-nums", highDrr ? "text-rose-600 dark:text-rose-400 font-medium" : r.drr > 0 && r.drr < 10 ? "text-emerald-700 dark:text-emerald-300" : "text-ink-muted")}>
                            {r.drr}%
                          </Td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={8} className="bg-surface-alt border-t border-line-soft px-4 py-3">
                              {tl ? <MiniTimeline data={tl} /> : <div className="text-[12px] text-ink-subtle">Загрузка динамики…</div>}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-ink-subtle">
              Клик по строке — динамика по дням. <span className="text-rose-600 dark:text-rose-400">Красный CTR/ДРР</span> — проблема; <span className="text-emerald-700 dark:text-emerald-300">зелёный ДРР</span> — реклама окупается.
            </p>
          </section>
        </>
      ) : null}
    </div>
  );
}

function MiniTimeline({ data }: { data: OzonTimelinePoint[] }) {
  const maxRev = Math.max(...data.map((d) => d.revenue), 1);
  return (
    <div className="space-y-3">
      {/* мини-график выручки */}
      <div>
        <div className="text-[11px] text-ink-muted mb-1.5">Выручка по дням</div>
        <div className="flex gap-[2px] h-12 items-end">
          {data.map((d) => (
            <div key={d.date} className="flex-1 bg-brand/60 rounded-sm min-h-[1px]"
              style={{ height: `${(d.revenue / maxRev) * 100}%` }}
              title={`${d.date}: ${rub(d.revenue)}`} />
          ))}
        </div>
      </div>
      {/* таблица по дням — показы, посещения, CTR, заказы, выручка, реклама, ДРР */}
      <div className="overflow-x-auto">
        <table className="w-full text-[11px] min-w-[640px]">
          <thead className="text-ink-subtle">
            <tr>
              <Th>Дата</Th><Th align="right">Показы</Th><Th align="right">Карточка</Th>
              <Th align="right">CTR</Th><Th align="right">Заказы</Th><Th align="right">Выручка</Th>
              <Th align="right">Реклама</Th><Th align="right">Клики р.</Th><Th align="right">ДРР</Th>
            </tr>
          </thead>
          <tbody>
            {data.map((d) => (
              <tr key={d.date} className="border-t border-line-soft">
                <Td>{d.date.slice(5)}</Td>
                <Td align="right" className="tabular-nums">{num(d.views)}</Td>
                <Td align="right" className="tabular-nums">{num(d.pdp)}</Td>
                <Td align="right" className="tabular-nums text-ink-muted">{d.ctr}%</Td>
                <Td align="right" className="tabular-nums">{d.orders}</Td>
                <Td align="right" className="tabular-nums font-medium">{rub(d.revenue)}</Td>
                <Td align="right" className="tabular-nums text-ink-muted">{rub(d.ad_spent)}</Td>
                <Td align="right" className="tabular-nums text-ink-muted">{num(d.ad_clicks)}</Td>
                <Td align="right" className={clsx("tabular-nums", d.drr >= 30 ? "text-rose-600 dark:text-rose-400" : "text-ink-muted")}>{d.drr}%</Td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InsightCard({ icon, tone, title, sub, items }: {
  icon: React.ReactNode; tone: "rose" | "emerald" | "amber"; title: string; sub: string;
  items: Array<{ label: string; value: string }>;
}) {
  const toneCls = {
    rose: "text-rose-600 dark:text-rose-400",
    emerald: "text-emerald-700 dark:text-emerald-300",
    amber: "text-amber-700 dark:text-amber-300",
  }[tone];
  return (
    <div className="card p-4">
      <div className={clsx("flex items-center gap-1.5 text-[13px] font-semibold", toneCls)}>{icon}{title}</div>
      <div className="text-[11px] text-ink-subtle mt-0.5 mb-2">{sub}</div>
      {items.length ? (
        <ul className="space-y-1">
          {items.map((it, i) => (
            <li key={i} className="flex justify-between text-[12px]">
              <span className="text-ink truncate mr-2">{it.label}</span>
              <span className={clsx("tabular-nums shrink-0", toneCls)}>{it.value}</span>
            </li>
          ))}
        </ul>
      ) : (
        <div className="text-[12px] text-ink-subtle">— нет (всё в норме)</div>
      )}
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
  return <th className={clsx("px-3 py-2 font-medium text-[10px] uppercase tracking-wider", align === "right" ? "text-right" : "text-left")}>{children}</th>;
}
function Td({ children, align = "left", className = "" }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={clsx("px-3 py-2.5 align-top", align === "right" && "text-right", className)}>{children}</td>;
}
