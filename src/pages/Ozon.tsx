import { Fragment, useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import { ChevronDown, AlertTriangle, TrendingUp, Flame } from "lucide-react";
import { api, ApiError, type OzonDashboard, type OzonCluster, type OzonTimelinePoint, type OzonDailyPoint } from "../api";
import { StatCardsSkeleton } from "../components/Skeleton";
import { hasApi } from "../env";

function rub(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n || 0) + " ₽";
}
function num(n: number): string {
  return new Intl.NumberFormat("ru-RU").format(n || 0);
}
function pct(n: number): string {
  return `${(n ?? 0)}%`;
}
function shiftDate(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

type Tab = "clusters" | "articles";
type SortKey = "revenue" | "orders" | "views" | "ctr" | "conv_order" | "drr";
type Preset = "7" | "14" | "30" | "all" | "custom";
type DayCol = keyof OzonDailyPoint;

export function Ozon() {
  const [data, setData] = useState<OzonDashboard | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [preset, setPreset] = useState<Preset>("all");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  // диапазон доступных дат (приходит из ответа, не зависит от фильтра)
  const [avail, setAvail] = useState<{ from: string; to: string } | null>(null);

  const [tab, setTab] = useState<Tab>("clusters");
  const [sortKey, setSortKey] = useState<SortKey>("revenue");
  const [openRow, setOpenRow] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<Record<string, { daily: OzonTimelinePoint[]; totals: OzonTimelinePoint }>>({});
  // сортировка дневной таблицы
  const [daySort, setDaySort] = useState<{ col: DayCol; dir: 1 | -1 }>({ col: "date", dir: 1 });

  // Считаем запрашиваемый диапазон из пресета + доступных границ
  const range = useMemo<{ from?: string; to?: string }>(() => {
    if (preset === "all") return {};
    if (preset === "custom") return { from: customFrom || undefined, to: customTo || undefined };
    if (!avail) return {};
    const n = Number(preset);
    return { from: shiftDate(avail.to, -(n - 1)), to: avail.to };
  }, [preset, customFrom, customTo, avail]);

  useEffect(() => {
    if (!hasApi) { setError("Сервис временно недоступен."); return; }
    setLoading(true);
    setTimeline({}); setOpenRow(null);  // сброс кэша раскрытий при смене периода
    api.ozonDashboard(range.from, range.to)
      .then((d) => {
        setData(d);
        if (d.available_from && d.available_to) setAvail({ from: d.available_from, to: d.available_to });
        setError(null);
      })
      .catch((e) => setError(e instanceof ApiError ? `Ошибка ${e.status}` : "Не удалось загрузить дашборд."))
      .finally(() => setLoading(false));
  }, [range.from, range.to]);

  const rows = useMemo(() => {
    if (!data) return [];
    const src = tab === "clusters" ? data.clusters : data.articles;
    return [...src].sort((a, b) => (b[sortKey] as number) - (a[sortKey] as number));
  }, [data, tab, sortKey]);

  const dailySorted = useMemo(() => {
    if (!data) return [];
    const { col, dir } = daySort;
    return [...data.daily].sort((a, b) => {
      const av = a[col], bv = b[col];
      if (typeof av === "string" || typeof bv === "string") return String(av).localeCompare(String(bv)) * dir;
      return ((av as number) - (bv as number)) * dir;
    });
  }, [data, daySort]);

  function setDayCol(col: DayCol) {
    setDaySort((s) => (s.col === col ? { col, dir: (s.dir === 1 ? -1 : 1) } : { col, dir: col === "date" ? 1 : -1 }));
  }

  async function toggleRow(key: string) {
    if (openRow === key) { setOpenRow(null); return; }
    setOpenRow(key);
    if (!timeline[key]) {
      try {
        const r = await api.ozonTimeline(key, tab === "clusters" ? "cluster" : "article", range.from, range.to);
        setTimeline((t) => ({ ...t, [key]: r }));
      } catch { /* ignore */ }
    }
  }

  const k = data?.kpi;

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1320px] animate-slide-up">
      <header className="mb-4">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Селект · Аналитика</h1>
        <p className="mt-1 text-[13px] text-ink-muted">
          Сквозная воронка Ozon + реклама/ДРР по дням.
          {data?.period_from && <span className="text-ink-subtle"> {data.period_from} — {data.period_to}</span>}
        </p>
      </header>

      {/* Период */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        {([["7", "7 дней"], ["14", "14 дней"], ["30", "30 дней"], ["all", "Весь период"], ["custom", "Свой"]] as [Preset, string][]).map(([p, label]) => (
          <button key={p} onClick={() => setPreset(p)}
            className={clsx("px-3 py-1.5 text-[12px] rounded-md border transition-colors",
              preset === p ? "bg-brand text-white border-brand" : "bg-surface border-line text-ink-muted hover:bg-surface-hover")}>
            {label}
          </button>
        ))}
        {preset === "custom" && (
          <span className="flex items-center gap-1.5">
            <input type="date" value={customFrom} min={avail?.from} max={avail?.to}
              onChange={(e) => setCustomFrom(e.target.value)}
              className="text-[12px] border border-line rounded-md px-2 py-1 bg-surface text-ink" />
            <span className="text-ink-subtle">—</span>
            <input type="date" value={customTo} min={avail?.from} max={avail?.to}
              onChange={(e) => setCustomTo(e.target.value)}
              className="text-[12px] border border-line rounded-md px-2 py-1 bg-surface text-ink" />
          </span>
        )}
        {loading && <span className="text-[11px] text-ink-subtle">обновляю…</span>}
      </div>

      {error && (
        <div className="mb-4 text-[13px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">{error}</div>
      )}

      {!data && !error ? (
        <StatCardsSkeleton />
      ) : data && k ? (
        <>
          {/* 12 KPI как в плановой таблице */}
          <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 mb-4">
            <Kpi label="Выручка" value={rub(k.revenue)} hint={`${num(k.days)} дн · ср.чек ${rub(k.avg_order)}`} accent />
            <Kpi label="Заказы" value={num(k.orders)} hint="штук" />
            <Kpi label="Показы" value={num(k.views)} hint="всего" />
            <Kpi label="Посещения карточки" value={num(k.pdp)} hint="переходы в карточку" />
            <Kpi label="CTR карточки" value={pct(k.ctr)} hint="посещения / показы" />
            <Kpi label="Добавлено в корзину" value={num(k.carts)} hint="всего" />
            <Kpi label="Конв. карточка→корзина" value={pct(k.conv_cart)} hint="корзины / посещения" />
            <Kpi label="Конв. корзина→заказ" value={pct(k.conv_order)} hint="заказы / корзины" />
            <Kpi label="Расход рекламы" value={rub(k.ad_spent)} hint="Ozon Performance" />
            <Kpi label="ДРР общий" value={pct(k.drr)} hint="расход / выручка"
              tone={k.drr >= 15 ? "rose" : k.drr > 0 && k.drr < 8 ? "emerald" : undefined} />
            <Kpi label="Рекламная выручка" value={rub(k.ad_revenue)} hint="атрибут. рекламе*" />
            <Kpi label="Чистая выручка" value={rub(k.net_revenue)} hint="выручка − реклама" />
          </section>

          {/* ДНЕВНАЯ ТАБЛИЦА — центр страницы */}
          <section className="mb-5">
            <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium mb-2">
              Данные по дням <span className="text-ink-subtle normal-case">(клик по заголовку — сортировка)</span>
            </div>
            <div className="card overflow-x-auto">
              <table className="w-full text-[12px] min-w-[960px]">
                <thead className="bg-surface-alt border-b border-line text-ink-muted sticky top-0">
                  <tr>
                    <DayTh col="date" cur={daySort} onClick={setDayCol} align="left">Дата</DayTh>
                    <DayTh col="revenue" cur={daySort} onClick={setDayCol}>Выручка</DayTh>
                    <DayTh col="orders" cur={daySort} onClick={setDayCol}>Заказы</DayTh>
                    <DayTh col="views" cur={daySort} onClick={setDayCol}>Показы</DayTh>
                    <DayTh col="pdp" cur={daySort} onClick={setDayCol}>Посещ.</DayTh>
                    <DayTh col="ctr" cur={daySort} onClick={setDayCol}>CTR</DayTh>
                    <DayTh col="carts" cur={daySort} onClick={setDayCol}>Корзины</DayTh>
                    <DayTh col="conv_cart" cur={daySort} onClick={setDayCol}>к.карт</DayTh>
                    <DayTh col="conv_order" cur={daySort} onClick={setDayCol}>к.корз</DayTh>
                    <DayTh col="ad_spent" cur={daySort} onClick={setDayCol}>Расход</DayTh>
                    <DayTh col="drr" cur={daySort} onClick={setDayCol}>ДРР</DayTh>
                  </tr>
                </thead>
                <tbody>
                  {dailySorted.map((d) => (
                    <tr key={d.date} className="border-t border-line-soft hover:bg-surface-hover">
                      <Td>{d.date.slice(5)}</Td>
                      <Td align="right" className="tabular-nums font-medium">{rub(d.revenue)}</Td>
                      <Td align="right" className="tabular-nums">{d.orders}</Td>
                      <Td align="right" className="tabular-nums text-ink-muted">{num(d.views)}</Td>
                      <Td align="right" className="tabular-nums text-ink-muted">{num(d.pdp)}</Td>
                      <Td align="right" className="tabular-nums">{pct(d.ctr)}</Td>
                      <Td align="right" className="tabular-nums text-ink-muted">{num(d.carts)}</Td>
                      <Td align="right" className="tabular-nums text-ink-muted">{pct(d.conv_cart)}</Td>
                      <Td align="right" className="tabular-nums text-ink-muted">{pct(d.conv_order)}</Td>
                      <Td align="right" className="tabular-nums text-ink-muted">{rub(d.ad_spent)}</Td>
                      <Td align="right" className={clsx("tabular-nums font-medium", drrCls(d.drr))}>{pct(d.drr)}</Td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-line bg-surface-alt font-semibold">
                    <Td>Итого</Td>
                    <Td align="right" className="tabular-nums">{rub(k.revenue)}</Td>
                    <Td align="right" className="tabular-nums">{k.orders}</Td>
                    <Td align="right" className="tabular-nums">{num(k.views)}</Td>
                    <Td align="right" className="tabular-nums">{num(k.pdp)}</Td>
                    <Td align="right" className="tabular-nums">{pct(k.ctr)}</Td>
                    <Td align="right" className="tabular-nums">{num(k.carts)}</Td>
                    <Td align="right" className="tabular-nums">{pct(k.conv_cart)}</Td>
                    <Td align="right" className="tabular-nums">{pct(k.conv_order)}</Td>
                    <Td align="right" className="tabular-nums">{rub(k.ad_spent)}</Td>
                    <Td align="right" className={clsx("tabular-nums", drrCls(k.drr))}>{pct(k.drr)}</Td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <p className="mt-2 text-[11px] text-ink-subtle">
              * Рекламная выручка приходит из Ozon Performance с «широкой» атрибуцией — ДРР общий (расход/выручка) надёжнее.
            </p>
          </section>

          {/* Инсайты */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-3 mb-5">
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

          {/* Разрез по склейкам / артикулам */}
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
                <span className="self-center text-[11px] text-ink-subtle ml-1">за {data.period_from}—{data.period_to}</span>
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
                          <Td align="right" className={clsx("tabular-nums", drrCls(r.drr))}>{r.drr}%</Td>
                        </tr>
                        {open && (
                          <tr>
                            <td colSpan={8} className="bg-surface-alt border-t border-line-soft px-4 py-3">
                              {tl ? <MatrixView data={tl} /> : <div className="text-[12px] text-ink-subtle">Загрузка матрицы…</div>}
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

function drrCls(drr: number): string {
  if (drr >= 30) return "text-rose-600 dark:text-rose-400";
  if (drr > 0 && drr < 10) return "text-emerald-700 dark:text-emerald-300";
  return "text-ink-muted";
}

function Kpi({ label, value, hint, accent = false, tone }: {
  label: string; value: string; hint?: string; accent?: boolean; tone?: "rose" | "emerald";
}) {
  const toneCls = tone === "rose" ? "text-rose-600 dark:text-rose-400"
    : tone === "emerald" ? "text-emerald-700 dark:text-emerald-300" : "text-ink";
  return (
    <div className={clsx("rounded-lg p-3 border", accent ? "bg-brand-tint border-brand/30" : "bg-surface-alt border-line")}>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted leading-tight">{label}</div>
      <div className={clsx("text-[17px] font-semibold tracking-tight tabular-nums mt-1", toneCls)}>{value}</div>
      {hint && <div className="text-[10px] text-ink-subtle mt-0.5">{hint}</div>}
    </div>
  );
}

// Строки матрицы: метрика → как отформатировать значение дня/итога.
const ORG_ROWS: Array<{ label: string; get: (d: OzonTimelinePoint) => string }> = [
  { label: "Показы", get: (d) => num(d.views) },
  { label: "Посещения карточки", get: (d) => num(d.pdp) },
  { label: "CTR карточки", get: (d) => pct(d.ctr) },
  { label: "Добавлено в корзину", get: (d) => num(d.carts) },
  { label: "Конв. карточка→корзина", get: (d) => pct(d.conv_cart) },
  { label: "Заказы, шт", get: (d) => num(d.orders) },
  { label: "Конв. корзина→заказ", get: (d) => pct(d.conv_order) },
  { label: "Выручка, ₽", get: (d) => num(d.revenue) },
  { label: "ДРР общий", get: (d) => pct(d.drr) },
];
const AD_ROWS: Array<{ label: string; get: (d: OzonTimelinePoint) => string }> = [
  { label: "Реклама: показы", get: (d) => num(d.ad_views) },
  { label: "Реклама: клики", get: (d) => num(d.ad_clicks) },
  { label: "Реклама: CTR", get: (d) => pct(d.ad_ctr) },
  { label: "Реклама: заказы, шт", get: (d) => num(d.ad_orders) },
  { label: "Реклама: расход, ₽", get: (d) => num(d.ad_spent) },
];

function MatrixView({ data }: { data: { daily: OzonTimelinePoint[]; totals: OzonTimelinePoint } }) {
  const { daily, totals } = data;
  if (!daily.length) return <div className="text-[12px] text-ink-subtle">Нет данных за период.</div>;

  const sectionRows = (title: string, rows: typeof ORG_ROWS) => (
    <Fragment key={title}>
      <tr className="bg-surface-alt">
        <td className="px-2 py-1 text-[10px] uppercase tracking-wider text-ink-subtle font-medium sticky left-0 bg-surface-alt"
          colSpan={daily.length + 2}>{title}</td>
      </tr>
      {rows.map((row) => (
        <tr key={row.label} className="border-t border-line-soft">
          <td className="px-3 py-1.5 text-ink whitespace-nowrap sticky left-0 bg-surface min-w-[180px]">{row.label}</td>
          <td className="px-3 py-1.5 text-right tabular-nums font-semibold text-ink bg-surface-alt border-r border-line whitespace-nowrap">{row.get(totals)}</td>
          {daily.map((d) => (
            <td key={d.date} className="px-3 py-1.5 text-right tabular-nums text-ink-muted whitespace-nowrap">{row.get(d)}</td>
          ))}
        </tr>
      ))}
    </Fragment>
  );

  return (
    <div className="overflow-x-auto">
      <table className="text-[11px] border-collapse">
        <thead>
          <tr className="text-ink-subtle border-b border-line">
            <th className="px-3 py-1.5 text-left sticky left-0 bg-surface-alt z-10 min-w-[180px]">Показатель</th>
            <th className="px-3 py-1.5 text-right font-semibold bg-surface-alt border-r border-line min-w-[82px]">Итого</th>
            {daily.map((d) => (
              <th key={d.date} className="px-3 py-1.5 text-right whitespace-nowrap font-medium min-w-[56px]">{d.date.slice(5)}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sectionRows("Общие", ORG_ROWS)}
          {sectionRows("Реклама", AD_ROWS)}
        </tbody>
      </table>
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

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return <th className={clsx("px-3 py-2 font-medium text-[10px] uppercase tracking-wider", align === "right" ? "text-right" : "text-left")}>{children}</th>;
}
function DayTh({ children, col, cur, onClick, align = "right" }: {
  children: React.ReactNode; col: DayCol; cur: { col: DayCol; dir: 1 | -1 }; onClick: (c: DayCol) => void; align?: "left" | "right";
}) {
  const active = cur.col === col;
  return (
    <th onClick={() => onClick(col)}
      className={clsx("px-3 py-2 font-medium text-[10px] uppercase tracking-wider cursor-pointer select-none hover:text-ink",
        align === "right" ? "text-right" : "text-left", active && "text-brand")}>
      {children}{active ? (cur.dir === 1 ? " ↑" : " ↓") : ""}
    </th>
  );
}
function Td({ children, align = "left", className = "" }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={clsx("px-3 py-2 align-top", align === "right" && "text-right", className)}>{children}</td>;
}
