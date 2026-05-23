import React, { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import {
  AlertTriangle, ArrowDownUp, ArrowDownRight, ArrowUpRight, Eye, Flame,
  Lightbulb, PackageX, Search, ShieldAlert, Sparkles, Target,
  TrendingDown, TrendingUp, X,
} from "lucide-react";
import {
  api, type ExecSummaryItem, type ExecSummaryKind,
  type ModelCross, type OzonCard, type OzonCardsResponse,
} from "../api";
import { StatCard } from "../components/StatCard";
import { StatCardsSkeleton } from "../components/Skeleton";
import { hasApi } from "../env";

function formatNum(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
}
function formatRub(n: number): string {
  return formatNum(n) + " ₽";
}
function formatPct(n: number, fractionDigits = 0): string {
  return `${(n * 100).toFixed(fractionDigits).replace(/\.0$/, "")}%`;
}

type PeriodKey = "today" | "week" | "month" | "year" | "all" | "custom";

const PRESETS: Array<{ key: PeriodKey; label: string }> = [
  { key: "today", label: "Сегодня" },
  { key: "week", label: "Неделя" },
  { key: "month", label: "Месяц" },
  { key: "year", label: "Год" },
  { key: "all", label: "Всё время" },
  { key: "custom", label: "Период" },
];

type SortBy =
  | "revenue" | "units" | "velocity" | "cancel" | "available"
  | "days_to_stockout" | "search_users" | "position" | "position_delta" | "conversion";

const SORT_LABEL: Record<SortBy, string> = {
  revenue: "Выручка ↓",
  units: "Продано ↓",
  velocity: "Velocity ↓",
  cancel: "% отмен ↓",
  available: "Остаток ↑",
  days_to_stockout: "Дней до 0 ↑",
  search_users: "Показы ↓",
  position: "Позиция ↑",
  position_delta: "Падение позиции ↓",
  conversion: "Конверсия ↓",
};

// Тэги для подсветки в таблице
const TAG_LABEL: Record<string, { text: string; cls: string }> = {
  silent: { text: "молчит", cls: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
  high_cancel: { text: "много отмен", cls: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800" },
  stock_risk: { text: "заканчивается", cls: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800" },
  out_of_stock: { text: "распродан", cls: "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600" },
  position_dropping: { text: "падает в поиске", cls: "bg-orange-50 text-orange-800 border-orange-200 dark:bg-orange-900/30 dark:text-orange-200 dark:border-orange-800" },
  position_rising: { text: "растёт в поиске", cls: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800" },
  low_ctr: { text: "слабая поисковая воронка", cls: "bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800" },
};

export function OzonTraffic() {
  const [data, setData] = useState<OzonCardsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<PeriodKey>("month");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("revenue");
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [selected, setSelected] = useState<OzonCard | null>(null);

  useEffect(() => {
    if (!hasApi) {
      setError("Сервис временно недоступен.");
      return;
    }
    setLoading(true);
    // КРИТИЧНО: period="custom" должен передаваться явно (см. фикс 23.05).
    const opts =
      period === "custom"
        ? { period: "custom", from: from || undefined, to: to || undefined }
        : { period };
    api
      .ozonCards(opts)
      .then((d) => {
        setData(d);
        setError(null);
      })
      .catch(() => setError("Не удалось загрузить трафик карточек."))
      .finally(() => setLoading(false));
  }, [period, from, to]);

  const filtered = useMemo(() => {
    if (!data) return null;
    let list = data.cards;
    const query = q.trim().toLowerCase();
    if (query) {
      list = list.filter(
        (c) =>
          c.sku.toLowerCase().includes(query) ||
          c.model.toLowerCase().includes(query) ||
          c.color.toLowerCase().includes(query) ||
          c.size.toLowerCase().includes(query),
      );
    }
    if (tagFilter) {
      list = list.filter((c) => c.tags.includes(tagFilter));
    }
    const sorted = [...list];
    const safe = (v: number | null | undefined, fallback: number) => (v == null ? fallback : v);
    switch (sortBy) {
      case "revenue":
        sorted.sort((a, b) => b.revenue_realized - a.revenue_realized);
        break;
      case "units":
        sorted.sort(
          (a, b) => (b.units_delivered + b.units_delivering) - (a.units_delivered + a.units_delivering),
        );
        break;
      case "velocity":
        sorted.sort((a, b) => b.velocity_per_day - a.velocity_per_day);
        break;
      case "cancel":
        sorted.sort((a, b) => b.cancel_rate - a.cancel_rate);
        break;
      case "available":
        sorted.sort((a, b) => a.available - b.available);
        break;
      case "days_to_stockout":
        sorted.sort((a, b) => safe(a.days_to_stockout, 99999) - safe(b.days_to_stockout, 99999));
        break;
      case "search_users":
        sorted.sort((a, b) => safe(b.search_users, 0) - safe(a.search_users, 0));
        break;
      case "position":
        sorted.sort((a, b) => safe(a.position, 99999) - safe(b.position, 99999));
        break;
      case "position_delta":
        // Самые сильные падения (отрицательная дельта) первыми
        sorted.sort((a, b) => safe(a.position_delta, 99999) - safe(b.position_delta, 99999));
        break;
      case "conversion":
        sorted.sort((a, b) => safe(b.view_conversion_pct, 0) - safe(a.view_conversion_pct, 0));
        break;
    }
    return sorted;
  }, [data, q, sortBy, tagFilter]);

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1280px] animate-slide-up">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Селект · Трафик карточек</h1>
        <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
          Поведение каждой карточки на Ozon: продажи, отмены, остатки, позиция в поиске,
          топ поисковых запросов, Ozon-грейд. Поисковая воронка (Premium) показывает
          <b> только данные из поиска</b> — рекомендательные полки и прямой трафик
          в неё не входят (Ozon API не отдаёт сейчас эти метрики никому, депрекейтили).
        </p>
      </header>

      {/* Период */}
      <section className="mb-5 flex flex-wrap gap-1.5">
        {PRESETS.map(({ key, label }) => (
          <button
            key={key}
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
        {period === "custom" && (
          <div className="flex gap-2 items-center text-[12px] ml-2">
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)}
              className="border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand" />
            <span className="text-ink-muted">→</span>
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)}
              className="border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand" />
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
          {/* === Executive summary === */}
          {data.executive_summary && data.executive_summary.length > 0 && (
            <ExecutiveSummary items={data.executive_summary} onSkuClick={(sku) => {
              const c = data.cards.find((c) => c.sku === sku);
              if (c) setSelected(c);
            }} />
          )}

          {/* KPI */}
          <section className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <StatCard
              label="Активные SKU"
              value={`${data.active_skus} / ${data.total_skus}`}
              hint={`выручка ${formatRub(data.total_revenue)}`}
            />
            <StatCard
              label="Молчат"
              value={data.silent_skus}
              hint="нет продаж >14 дн."
            />
            <StatCard
              label="Высокий % отмен"
              value={data.high_cancel_skus}
              hint="> 50% отмен (≥4 заказа)"
            />
            <StatCard
              label="Скоро out-of-stock"
              value={data.stock_risk_skus}
              hint="хватит < чем на неделю"
            />
          </section>

          {/* Инсайты — 4 блока */}
          <section className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-3">
            <InsightBlock
              icon={<Flame size={14} />}
              title="🔥 Лидеры продаж"
              hint="держим в наличии, не теряем темп"
              items={data.top_movers}
              renderRow={(c) => (
                <>
                  <ItemLabel c={c} />
                  <div className="text-right tabular-nums">
                    <div className="text-ink font-medium">{c.units_delivered + c.units_delivering} шт.</div>
                    <div className="text-[10px] text-ink-subtle">
                      {c.velocity_per_day.toFixed(2)}/день
                    </div>
                  </div>
                </>
              )}
              onItemClick={setSelected}
            />
            <InsightBlock
              icon={<TrendingDown size={14} />}
              title="🐌 Медленные с остатком"
              hint="кандидаты на скидку / новые фото / удаление"
              items={data.slow_movers}
              renderRow={(c) => (
                <>
                  <ItemLabel c={c} />
                  <div className="text-right tabular-nums">
                    <div className="text-ink font-medium">остаток {c.available}</div>
                    <div className="text-[10px] text-ink-subtle">
                      {c.days_since_last_sale === null
                        ? "не продаётся"
                        : `тишина ${c.days_since_last_sale} дн.`}
                    </div>
                  </div>
                </>
              )}
              onItemClick={setSelected}
            />
            <InsightBlock
              icon={<ShieldAlert size={14} />}
              title="⚠️ Высокая отмена"
              hint="что-то не так с карточкой — фото/размерная сетка/описание"
              items={data.high_cancel}
              renderRow={(c) => (
                <>
                  <ItemLabel c={c} />
                  <div className="text-right tabular-nums">
                    <div className="text-rose-700 dark:text-rose-300 font-medium">
                      {formatPct(c.cancel_rate)}
                    </div>
                    <div className="text-[10px] text-ink-subtle">
                      {c.units_cancelled} из {c.units_total}
                    </div>
                  </div>
                </>
              )}
              onItemClick={setSelected}
            />
            <InsightBlock
              icon={<PackageX size={14} />}
              title="🔴 Закончатся скоро"
              hint="срочно пополнить — потеряем продажи"
              items={data.at_risk}
              renderRow={(c) => (
                <>
                  <ItemLabel c={c} />
                  <div className="text-right tabular-nums">
                    <div className="text-amber-700 dark:text-amber-300 font-medium">
                      {c.days_to_stockout?.toFixed(1)} дн.
                    </div>
                    <div className="text-[10px] text-ink-subtle">
                      остаток {c.available} · {c.velocity_per_day.toFixed(2)}/день
                    </div>
                  </div>
                </>
              )}
              onItemClick={setSelected}
            />
          </section>

          {/* === Premium insights (показы / позиция / конверсия) === */}
          {data.has_premium_data && (
            <section className="mt-3 grid grid-cols-1 lg:grid-cols-2 gap-3">
              <InsightBlock
                icon={<ArrowDownRight size={14} />}
                title="📉 Падают в выдаче"
                hint="алгоритм Ozon опускает карточку — теряем естественный трафик"
                items={data.position_dropping}
                renderRow={(c) => (
                  <>
                    <ItemLabel c={c} />
                    <div className="text-right tabular-nums">
                      <div className="text-orange-700 dark:text-orange-300 font-medium">
                        Δ {c.position_delta}
                      </div>
                      <div className="text-[10px] text-ink-subtle">
                        позиция {c.position}
                      </div>
                    </div>
                  </>
                )}
                onItemClick={setSelected}
              />
              <InsightBlock
                icon={<Target size={14} />}
                title="🎯 Много показов, низкий CTR"
                hint="карточка появляется в поиске, но клиенты не кликают — фото / название / цена"
                items={data.low_ctr}
                renderRow={(c) => {
                  const ctr = c.search_users && c.view_users != null
                    ? (c.view_users / c.search_users) * 100
                    : null;
                  return (
                    <>
                      <ItemLabel c={c} />
                      <div className="text-right tabular-nums">
                        <div className="text-rose-700 dark:text-rose-300 font-medium">
                          {ctr != null ? `${ctr.toFixed(1)}%` : "—"}
                        </div>
                        <div className="text-[10px] text-ink-subtle">
                          {formatNum(c.search_users || 0)} увидели
                        </div>
                      </div>
                    </>
                  );
                }}
                onItemClick={setSelected}
              />
            </section>
          )}

          {/* === Кросс-аналитика по моделям === */}
          {data.models_cross && data.models_cross.length > 0 && (
            <CrossAnalytics models={data.models_cross} hasPremium={data.has_premium_data} />
          )}

          {/* Поиск + фильтры */}
          <section className="mt-8 mb-3">
            <div className="flex flex-col lg:flex-row gap-2">
              <div className="relative flex-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
                <input
                  type="text"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Поиск: артикул, модель, цвет, размер…"
                  className="w-full pl-9 pr-9 py-2 rounded-lg border border-line bg-surface text-[14px] text-ink placeholder:text-ink-soft focus:outline-none focus:border-brand"
                />
                {q && (
                  <button onClick={() => setQ("")} className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-ink-muted hover:text-ink">
                    <X size={14} />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 text-[12px]">
                <label className="flex items-center gap-1.5 text-ink-muted">
                  <ArrowDownUp size={12} />
                  Сортировка:
                  <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortBy)}
                    className="border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand">
                    {(Object.keys(SORT_LABEL) as SortBy[]).map((k) => (
                      <option key={k} value={k}>{SORT_LABEL[k]}</option>
                    ))}
                  </select>
                </label>
                <select value={tagFilter || ""} onChange={(e) => setTagFilter(e.target.value || null)}
                  className="border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand">
                  <option value="">Все теги</option>
                  <option value="silent">Только молчат</option>
                  <option value="high_cancel">Высокий cancel</option>
                  <option value="stock_risk">Stock-risk</option>
                  <option value="out_of_stock">Out-of-stock</option>
                  <option value="position_dropping">Падают в выдаче</option>
                  <option value="position_rising">Растут в выдаче</option>
                  <option value="low_ctr">Низкий CTR</option>
                </select>
              </div>
            </div>
          </section>

          {/* Полная таблица карточек */}
          {filtered && filtered.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] min-w-[1380px]">
                  <thead className="bg-surface-alt border-b border-line text-ink-muted">
                    <tr>
                      <Th>Артикул</Th>
                      <Th>Модель · цвет · размер</Th>
                      <Th align="right">Продано</Th>
                      <Th align="right">Выручка</Th>
                      <Th align="right">Velocity</Th>
                      <Th align="right">% отмен</Th>
                      {data.has_premium_data && (
                        <>
                          <Th align="right" title="Поисковый спрос (Premium API): уник. пользователей искавших по запросам, где карточка попадает в выдачу. Не равно «увидели карточку» — большинство могло не доскроллить.">Спрос</Th>
                          <Th align="right" title="Средняя позиция по топ-10 запросов товара (Premium API). Меньше — выше в выдаче. Зелёная стрелка = поднялась к топу.">Позиция</Th>
                          <Th align="right" title="Доля поиска, дошедшая до карточки = view_users / search_users. Не классический CTR, т.к. большинство search_users могли карточку не увидеть.">Поиск→PDP</Th>
                          <Th align="center" title="Грейд карточки от Ozon (IDC, оборачиваемость). Зелёный — здоровая, красный — проблема.">Грейд</Th>
                        </>
                      )}
                      <Th align="right">Остаток</Th>
                      <Th align="right">До 0</Th>
                      <Th>Теги</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((c) => {
                      const sold = c.units_delivered + c.units_delivering;
                      return (
                        <tr key={c.sku}
                          className="border-t border-line hover:bg-surface-hover cursor-pointer"
                          onClick={() => setSelected(c)}>
                          <Td><span className="font-mono text-[11px]">{c.sku}</span></Td>
                          <Td>
                            <div className="text-ink">{c.model}</div>
                            <div className="text-ink-subtle text-[10px]">
                              {c.color}{c.color !== "—" && c.size !== "—" && " · "}{c.size}
                            </div>
                          </Td>
                          <Td align="right" className="tabular-nums font-medium">{sold}</Td>
                          <Td align="right" className="tabular-nums">{formatRub(c.revenue_realized)}</Td>
                          <Td align="right" className="tabular-nums">{c.velocity_per_day.toFixed(2)}</Td>
                          <Td align="right" className={clsx("tabular-nums", c.cancel_rate > 0.5 && "text-rose-700 dark:text-rose-300 font-medium")}>
                            {formatPct(c.cancel_rate)}
                          </Td>
                          {data.has_premium_data && (
                            <>
                              <Td align="right" className="tabular-nums">
                                {c.search_users != null ? formatNum(c.search_users) : "—"}
                              </Td>
                              <Td align="right" className="tabular-nums whitespace-nowrap">
                                {c.position != null ? (
                                  <>
                                    {c.position}
                                    {c.position_delta != null && c.position_delta !== 0 && (
                                      <span className={clsx(
                                        "ml-1 text-[10px]",
                                        c.position_delta > 0
                                          ? "text-emerald-700 dark:text-emerald-300"
                                          : "text-orange-700 dark:text-orange-300",
                                      )}>
                                        {c.position_delta > 0 ? "↑" : "↓"}{Math.abs(c.position_delta)}
                                      </span>
                                    )}
                                  </>
                                ) : "—"}
                              </Td>
                              <Td align="right" className={clsx(
                                "tabular-nums",
                                c.search_users && c.view_users != null && (c.view_users / c.search_users) * 100 < 5 && "text-rose-700 dark:text-rose-300 font-medium",
                              )}>
                                {c.search_users && c.view_users != null
                                  ? `${((c.view_users / c.search_users) * 100).toFixed(1)}%`
                                  : "—"}
                              </Td>
                              <Td align="right">
                                {c.ozon_grade === "green" ? <span title="Зелёный (здоровая карточка)">🟢</span>
                                  : c.ozon_grade === "yellow" ? <span title="Жёлтый (внимание)">🟡</span>
                                  : c.ozon_grade === "red" ? <span title="Красный (проблемы)">🔴</span>
                                  : <span className="text-ink-soft">—</span>}
                              </Td>
                            </>
                          )}
                          <Td align="right" className="tabular-nums">{c.available}</Td>
                          <Td align="right" className={clsx("tabular-nums", c.days_to_stockout !== null && c.days_to_stockout < 7 && "text-amber-700 dark:text-amber-300 font-medium")}>
                            {c.days_to_stockout !== null ? `${c.days_to_stockout.toFixed(1)} дн.` : "—"}
                          </Td>
                          <Td>
                            <div className="flex gap-1 flex-wrap">
                              {c.tags.map((t) => (
                                <span key={t} className={clsx("px-1.5 py-0.5 text-[10px] rounded border", TAG_LABEL[t]?.cls || "bg-surface text-ink-muted border-line")}>
                                  {TAG_LABEL[t]?.text || t}
                                </span>
                              ))}
                            </div>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="card p-8 text-center text-ink-muted">Ничего не найдено.</div>
          )}
        </div>
      ) : null}

      {selected && createPortal(
        <DetailModal card={selected} onClose={() => setSelected(null)} />,
        document.body,
      )}
    </div>
  );
}

function ExecutiveSummary({
  items, onSkuClick,
}: {
  items: ExecSummaryItem[];
  onSkuClick: (sku: string) => void;
}) {
  const styleByKind: Record<ExecSummaryKind, string> = {
    win: "border-emerald-200 bg-emerald-50/50 dark:border-emerald-800 dark:bg-emerald-900/10",
    urgent: "border-rose-200 bg-rose-50/50 dark:border-rose-800 dark:bg-rose-900/10",
    warning: "border-orange-200 bg-orange-50/50 dark:border-orange-800 dark:bg-orange-900/10",
    opportunity: "border-brand/30 bg-brand-tint/30 dark:border-brand/50 dark:bg-brand/10",
    info: "border-line bg-surface-alt",
  };
  return (
    <section className="mb-6 card p-5 border-2 border-brand/20 bg-gradient-to-br from-brand-tint/30 to-surface">
      <header className="mb-3 flex items-baseline gap-2">
        <Sparkles size={14} className="text-brand" />
        <h2 className="text-[14px] font-semibold tracking-tightish">Что важно прямо сейчас</h2>
        <span className="text-[11px] text-ink-subtle">авто-сводка по данным</span>
      </header>
      <ul className="flex flex-col gap-2">
        {items.map((it, i) => (
          <li key={i}>
            <button
              type="button"
              onClick={() => it.sku && onSkuClick(it.sku)}
              disabled={!it.sku}
              className={clsx(
                "w-full text-left flex items-start gap-2.5 p-2.5 rounded-md border text-[13px] leading-snug transition-colors",
                styleByKind[it.kind],
                it.sku && "hover:bg-surface-hover cursor-pointer",
                !it.sku && "cursor-default",
              )}
            >
              <span className="text-[15px] shrink-0 leading-none mt-0.5">{it.icon}</span>
              <span className="flex-1 text-ink">{it.text}</span>
              {it.sku && (
                <span className="text-[10px] text-ink-soft font-mono shrink-0">
                  открыть →
                </span>
              )}
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}


function CrossAnalytics({
  models, hasPremium,
}: {
  models: ModelCross[];
  hasPremium: boolean;
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  return (
    <section className="mt-8">
      <header className="mb-3 flex items-baseline justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold tracking-tightish">Кросс-аналитика по моделям</h2>
          <p className="text-[12px] text-ink-subtle mt-0.5">
            Какие модели тянут, какие тормозят. Кликни строку чтобы увидеть распределение по цветам и размерам.
          </p>
        </div>
      </header>
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-[12px] min-w-[900px]">
            <thead className="bg-surface-alt border-b border-line text-ink-muted">
              <tr>
                <th className="px-3 py-2 text-left font-medium text-[10px] uppercase tracking-wider">Модель</th>
                <th className="px-3 py-2 text-right font-medium text-[10px] uppercase tracking-wider">SKU</th>
                <th className="px-3 py-2 text-right font-medium text-[10px] uppercase tracking-wider">Продано</th>
                <th className="px-3 py-2 text-right font-medium text-[10px] uppercase tracking-wider">Выручка</th>
                <th className="px-3 py-2 text-right font-medium text-[10px] uppercase tracking-wider">Ср. чек</th>
                <th className="px-3 py-2 text-right font-medium text-[10px] uppercase tracking-wider">% отмен</th>
                {hasPremium && (
                  <>
                    <th className="px-3 py-2 text-right font-medium text-[10px] uppercase tracking-wider">Показы</th>
                    <th className="px-3 py-2 text-right font-medium text-[10px] uppercase tracking-wider">Ср. позиция</th>
                    <th className="px-3 py-2 text-right font-medium text-[10px] uppercase tracking-wider">Ср. конв.</th>
                  </>
                )}
                <th className="px-3 py-2 text-left font-medium text-[10px] uppercase tracking-wider">Лидер</th>
              </tr>
            </thead>
            <tbody>
              {models.map((m) => {
                const isOpen = expanded === m.name;
                return (
                  <React.Fragment key={m.name}>
                    <tr
                      onClick={() => setExpanded(isOpen ? null : m.name)}
                      className={clsx(
                        "border-t border-line cursor-pointer transition-colors",
                        isOpen ? "bg-surface-hover" : "hover:bg-surface-hover",
                      )}
                    >
                      <td className="px-3 py-2.5 align-middle">
                        <div className="text-ink font-medium">{m.name}</div>
                        <div className="text-[10px] text-ink-subtle">
                          {m.sku_count} SKU
                          {m.skus_silent > 0 && (
                            <span className="text-amber-700 dark:text-amber-300"> · {m.skus_silent} silent</span>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{m.sku_count}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums font-medium">{m.units_sold}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{formatRub(m.revenue)}</td>
                      <td className="px-3 py-2.5 text-right tabular-nums">{m.avg_ticket > 0 ? formatRub(Math.round(m.avg_ticket)) : "—"}</td>
                      <td className={clsx(
                        "px-3 py-2.5 text-right tabular-nums",
                        m.cancel_rate > 0.6 && "text-rose-700 dark:text-rose-300 font-medium",
                      )}>
                        {formatPct(m.cancel_rate)}
                      </td>
                      {hasPremium && (
                        <>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {m.search_users > 0 ? formatNum(m.search_users) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {m.avg_position !== null ? m.avg_position.toFixed(0) : "—"}
                          </td>
                          <td className="px-3 py-2.5 text-right tabular-nums">
                            {m.avg_conversion_pct !== null ? `${m.avg_conversion_pct.toFixed(2)}%` : "—"}
                          </td>
                        </>
                      )}
                      <td className="px-3 py-2.5 align-middle">
                        <div className="text-[11px] text-ink">
                          {m.top_color ? `${m.top_color[0]} (${m.top_color[1]})` : "—"}
                        </div>
                        <div className="text-[10px] text-ink-subtle">
                          размер {m.top_size ? `${m.top_size[0]} (${m.top_size[1]})` : "—"}
                        </div>
                      </td>
                    </tr>
                    {isOpen && (
                      <tr>
                        <td colSpan={hasPremium ? 10 : 7} className="p-0 bg-surface-alt border-t border-line-soft">
                          <ModelDetail m={m} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}


function ModelDetail({ m }: { m: ModelCross }) {
  return (
    <div className="p-4 grid grid-cols-1 lg:grid-cols-2 gap-4">
      <Distribution title="По цветам" items={m.colors} totalLabel="единиц" />
      <Distribution title="По размерам" items={m.sizes} totalLabel="единиц" />
    </div>
  );
}


function Distribution({
  title, items, totalLabel,
}: {
  title: string;
  items: Array<[string, number]>;
  totalLabel: string;
}) {
  const total = items.reduce((s, [, v]) => s + v, 0);
  if (total === 0) {
    return (
      <div className="card p-3">
        <h4 className="text-[12px] font-semibold mb-1.5">{title}</h4>
        <div className="text-[11px] text-ink-subtle">Нет продаж — нечего распределять.</div>
      </div>
    );
  }
  return (
    <div className="card p-3">
      <header className="mb-2 flex items-baseline justify-between">
        <h4 className="text-[12px] font-semibold">{title}</h4>
        <span className="text-[10px] text-ink-subtle">{total} {totalLabel}</span>
      </header>
      <ul className="flex flex-col gap-1.5">
        {items.map(([name, count]) => {
          const pct = (count / total) * 100;
          return (
            <li key={name} className="flex items-center gap-2 text-[11px]">
              <span className="w-16 truncate text-ink">{name}</span>
              <div className="flex-1 h-2 bg-surface rounded-full overflow-hidden">
                <div
                  className="h-full bg-brand"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <span className="w-12 text-right text-ink-muted tabular-nums">
                {count}
                <span className="text-ink-subtle ml-1 text-[10px]">{pct.toFixed(0)}%</span>
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}


function ItemLabel({ c }: { c: OzonCard }) {
  return (
    <div className="min-w-0">
      <div className="text-ink text-[13px] truncate">
        {c.model}
        {c.color !== "—" && <span className="text-ink-subtle"> · {c.color}</span>}
        {c.size !== "—" && <span className="text-ink-subtle"> · {c.size}</span>}
      </div>
      <div className="font-mono text-[10px] text-ink-soft">{c.sku}</div>
    </div>
  );
}

function InsightBlock({
  icon, title, hint, items, renderRow, onItemClick,
}: {
  icon: React.ReactNode;
  title: string;
  hint: string;
  items: OzonCard[];
  renderRow: (c: OzonCard) => React.ReactNode;
  onItemClick: (c: OzonCard) => void;
}) {
  return (
    <div className="card p-4">
      <header className="mb-3">
        <h3 className="text-[13px] font-semibold tracking-tightish flex items-center gap-1.5">
          {icon} {title}
        </h3>
        <p className="text-[11px] text-ink-subtle mt-0.5">{hint}</p>
      </header>
      {items.length === 0 ? (
        <div className="text-[12px] text-ink-subtle py-3">Пусто — это хорошо ✓</div>
      ) : (
        <ul className="flex flex-col gap-1">
          {items.map((c) => (
            <li key={c.sku}>
              <button
                onClick={() => onItemClick(c)}
                className="w-full flex items-center justify-between gap-2 py-1.5 px-2 rounded hover:bg-surface-hover text-left"
              >
                {renderRow(c)}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function DetailModal({ card, onClose }: { card: OzonCard; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    // Блокируем прокрутку фона пока модалка открыта (особенно важно на мобильных)
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  const sold = card.units_delivered + card.units_delivering;

  // Простые рекомендации в зависимости от тэгов
  const recommendations: string[] = [];
  if (card.tags.includes("stock_risk") && card.days_to_stockout !== null) {
    recommendations.push(`Закончится через ~${card.days_to_stockout.toFixed(1)} дней — срочно пополни (минимум на 2-3 недели × ${card.velocity_per_day.toFixed(2)} = ${Math.ceil(card.velocity_per_day * 21)} единиц).`);
  }
  if (card.tags.includes("position_dropping") && card.position_delta != null) {
    // position_delta = prev - current. Отрицательная delta = карточка опустилась вниз
    // (число позиции стало больше). prev = current + delta.
    const prevPos = (card.position ?? 0) + card.position_delta;
    recommendations.push(`Позиция в выдаче упала на ${Math.abs(card.position_delta)} мест за неделю (с ${prevPos} на ${card.position}, чем больше число — тем ниже в выдаче). Это среднее по топ-10 поисковых запросов твоего товара. Алгоритм Ozon опускает карточку — изучи: упали отзывы? Закончился рекламный буст? Появились более активные конкуренты?`);
  }
  // Используем НАШ click-conversion (view_users / search_users), а не view_conversion из API
  // (API даёт конверсию в покупку через поиск, а не CTR показ→PDP).
  const realCtrPct = card.search_users && card.view_users
    ? (card.view_users / card.search_users) * 100
    : null;
  if (card.tags.includes("low_ctr") && realCtrPct != null && card.search_users != null) {
    recommendations.push(`${formatNum(card.search_users)} уникальных пользователей увидели карточку в поиске, но открыли её только ${formatNum(card.view_users ?? 0)} — CTR ${realCtrPct.toFixed(1)}%. Карточка показывается, но не цепляет. Проверь: главное фото зацепляющее? Цена в норме относительно конкурентов? Название содержит ключевые слова?`);
  }
  if (card.tags.includes("silent") && card.available > 0) {
    recommendations.push(`Нет продаж ${card.days_since_last_sale === null ? "никогда" : `>${card.days_since_last_sale} дней`}, при этом ${card.available} шт. на складе. Проверь: фото / описание / цена адекватная? Может, нужна скидка или совсем убрать карточку.`);
  }
  if (card.tags.includes("high_cancel")) {
    recommendations.push(`${formatPct(card.cancel_rate)} отмен — каждый второй заказ отменяется. Возможные причины: не та размерная сетка, фото не отражает реальность, плохие отзывы. Стоит прочитать отзывы и пересмотреть карточку.`);
  }
  if (card.tags.includes("out_of_stock")) {
    recommendations.push(`Остаток 0. Если продажи были (${sold} шт.) — пополнить, иначе теряем выручку. Если нет — карточку можно скрыть на Ozon.`);
  }
  if (recommendations.length === 0 && sold > 0) {
    recommendations.push(`Карточка стабильно работает: ${sold} продаж, ${formatRub(card.revenue_realized)} выручки, ${formatPct(card.cancel_rate)} отмен.`);
  }

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4 animate-fade-in" onClick={onClose}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-2xl card p-6 max-h-[85vh] overflow-y-auto animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <header className="mb-4 flex items-start justify-between gap-3">
          <div>
            <div className="font-mono text-[11px] text-ink-muted">{card.sku}</div>
            <h2 className="text-lg font-semibold tracking-tightish mt-1">
              {card.model}
              {card.color !== "—" && <span className="text-ink-muted"> · {card.color}</span>}
              {card.size !== "—" && <span className="text-ink-muted"> · {card.size}</span>}
            </h2>
            <div className="flex gap-1 flex-wrap mt-2">
              {card.tags.map((t) => (
                <span key={t} className={clsx("px-1.5 py-0.5 text-[10px] rounded border", TAG_LABEL[t]?.cls || "bg-surface text-ink-muted border-line")}>
                  {TAG_LABEL[t]?.text || t}
                </span>
              ))}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-ink-muted hover:text-ink hover:bg-surface-hover rounded">
            <X size={16} />
          </button>
        </header>

        {/* Recommendations */}
        <div className="mb-4 card bg-surface-alt p-3 border-l-4 border-brand">
          <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted mb-2 flex items-center gap-1.5">
            <Sparkles size={12} /> Что делать
          </h3>
          <ul className="space-y-1.5 text-[13px]">
            {recommendations.map((r, i) => (
              <li key={i} className="text-ink leading-relaxed">• {r}</li>
            ))}
          </ul>
        </div>

        {/* Metrics grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
          <Metric label="Продано" value={`${sold} шт.`} hint={`+ ${card.units_cancelled} отменены`} />
          <Metric label="Выручка" value={formatRub(card.revenue_realized)} hint={`payout ${formatRub(card.payout)}`} />
          <Metric label="Velocity" value={`${card.velocity_per_day.toFixed(2)}/день`} />
          <Metric
            label="Отмены"
            value={formatPct(card.cancel_rate)}
            hint={`${card.units_cancelled} из ${card.units_total}`}
            warning={card.cancel_rate > 0.5}
          />
          <Metric
            label="Остаток"
            value={card.available}
            hint={card.stock !== card.available ? `физически ${card.stock}` : ""}
            warning={card.available <= 0}
          />
          <Metric
            label="Дней до 0"
            value={card.days_to_stockout !== null ? `${card.days_to_stockout.toFixed(1)}` : "—"}
            warning={card.days_to_stockout !== null && card.days_to_stockout < 7}
          />
          <Metric label="Топ-город" value={card.top_city} hint={`${card.distinct_cities} городов`} />
          <Metric label="Первая продажа" value={card.first_sale || "—"} />
          <Metric label="Посл. продажа" value={card.last_sale || "—"} hint={card.days_since_last_sale !== null ? `${card.days_since_last_sale} дн. назад` : ""} />
        </div>

        {/* Поисковая воронка (Premium) */}
        {card.search_users != null && card.premium_history.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted mb-2 flex items-center gap-1.5">
              <Search size={12} /> Поисковая воронка (Premium)
              <span className="text-[10px] text-ink-subtle normal-case font-normal">
                · {card.premium_period}
              </span>
            </h3>
            <div className="rounded-md bg-amber-50/40 dark:bg-amber-900/10 border border-amber-200/60 dark:border-amber-800/40 p-2.5 mb-3 text-[11px] text-amber-900 dark:text-amber-200 leading-relaxed">
              <b>⚠️ Только поисковый канал.</b> Не включает показы из рекомендательных полок
              («с этим покупают», «похожие»), прямой трафик и рекламу. Ozon депрекейтил
              эти метрики в общем Analytics API — общая воронка карточки не доступна никому.
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
              <Metric
                label="Поисковый спрос"
                value={formatNum(card.search_users)}
                hint="уник. искавших по запросам, где карточка попадает в выдачу"
              />
              <Metric
                label="Дошли до карточки"
                value={formatNum(card.view_users || 0)}
                hint="из поиска (без рекомендаций / рекламы)"
              />
              <Metric
                label="Поиск→карточка"
                value={realCtrPct != null ? `${realCtrPct.toFixed(1)}%` : "—"}
                hint="доля поисковой аудитории, дошедшей до карточки"
                warning={realCtrPct != null && realCtrPct < 5}
              />
              <Metric
                label="Позиция в поиске"
                value={
                  <>
                    {card.position}
                    {card.position_delta != null && card.position_delta !== 0 && (
                      <span className={clsx(
                        "ml-1.5 text-[11px]",
                        // delta > 0 = позиция стала меньше = поднялась к топу (улучшение)
                        // delta < 0 = позиция стала больше = упала вниз (ухудшение)
                        card.position_delta > 0
                          ? "text-emerald-700 dark:text-emerald-300"
                          : "text-orange-700 dark:text-orange-300",
                      )}>
                        {card.position_delta > 0 ? "↑" : "↓"}{Math.abs(card.position_delta)}
                      </span>
                    )}
                  </>
                }
                hint="средняя по топ-10 запросов · меньше = выше"
                warning={(card.position_delta ?? 0) <= -10}
              />
            </div>
            <HistoryChart history={card.premium_history} />
          </div>
        )}

        {/* Топ поисковых запросов */}
        {card.top_queries && card.top_queries.length > 0 && (
          <div className="mb-4">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-ink-muted mb-2 flex items-center gap-1.5">
              <Target size={12} /> Топ поисковых запросов
              <span className="text-[10px] text-ink-subtle normal-case font-normal">
                · по каким словам нас находят
              </span>
            </h3>
            <div className="rounded-md border border-line overflow-hidden">
              <table className="w-full text-[12px]">
                <thead className="bg-surface-alt text-ink-muted text-[10px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left px-2.5 py-1.5">Запрос</th>
                    <th className="text-right px-2.5 py-1.5" title="Позиция в выдаче по этому запросу. Меньше = выше.">Поз.</th>
                    <th className="text-right px-2.5 py-1.5" title="Уник. пользователей, искавших по этому запросу">Искало</th>
                    <th className="text-right px-2.5 py-1.5" title="Из них уникальных, дошедших до нашей карточки">Дошли</th>
                  </tr>
                </thead>
                <tbody>
                  {card.top_queries.map((q, i) => (
                    <tr key={i} className="border-t border-line-soft">
                      <td className="px-2.5 py-1.5 text-ink">{q.query}</td>
                      <td className={clsx(
                        "px-2.5 py-1.5 text-right tabular-nums",
                        q.position <= 30 ? "text-emerald-700 dark:text-emerald-300 font-medium"
                          : q.position <= 100 ? "text-amber-700 dark:text-amber-300"
                          : "text-rose-700 dark:text-rose-300 font-medium",
                      )}>{q.position}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums text-ink-muted">{formatNum(q.search_users)}</td>
                      <td className="px-2.5 py-1.5 text-right tabular-nums">{formatNum(q.view_users)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Ozon-грейд + оборачиваемость + content rating */}
        {(card.ozon_grade || card.turnover_days != null || card.content_rating != null) && (
          <div className="mb-4 grid grid-cols-2 lg:grid-cols-4 gap-3">
            {card.ozon_grade && (
              <Metric
                label="Грейд Ozon"
                value={
                  <span className={clsx(
                    card.ozon_grade === "green" ? "text-emerald-700 dark:text-emerald-300"
                      : card.ozon_grade === "yellow" ? "text-amber-700 dark:text-amber-300"
                      : "text-rose-700 dark:text-rose-300"
                  )}>
                    {card.ozon_grade === "green" ? "🟢 Зелёный"
                      : card.ozon_grade === "yellow" ? "🟡 Жёлтый"
                      : "🔴 Красный"}
                  </span>
                }
                hint="оценка карточки Ozon (IDC)"
              />
            )}
            {card.turnover_days != null && (
              <Metric
                label="Оборачиваемость"
                value={`${card.turnover_days.toFixed(1)} дн.`}
                hint="средний срок продажи остатка"
                warning={card.turnover_days > 60}
              />
            )}
            {card.ads_per_day != null && (
              <Metric
                label="Средн. продаж/день"
                value={card.ads_per_day.toFixed(2)}
                hint="из API Ozon (ADS)"
              />
            )}
            {card.content_rating != null && (
              <Metric
                label="Контент карточки"
                value={`${card.content_rating}/100`}
                hint={`📷 ${card.content_media || 0} · 📝 ${card.content_text || 0} · 📋 ${card.content_attributes || 0}`}
                warning={card.content_rating < 80}
              />
            )}
          </div>
        )}

        {/* Возвраты по этому SKU */}
        {(card.returned_count || 0) > 0 && (
          <div className="mb-4 card bg-rose-50/40 dark:bg-rose-900/10 border-rose-200/60 dark:border-rose-800/40 p-3">
            <h3 className="text-[12px] font-semibold uppercase tracking-wider text-rose-700 dark:text-rose-300 mb-2 flex items-center gap-1.5">
              ⬅️ Возвраты за период
              <span className="text-[10px] text-ink-subtle normal-case font-normal">
                · только настоящие (после получения товара)
              </span>
            </h3>
            <div className="grid grid-cols-2 gap-3 mb-2">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-muted">Количество</div>
                <div className="text-[15px] font-semibold text-rose-700 dark:text-rose-300 tabular-nums">{card.returned_count} шт.</div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-muted">Сумма</div>
                <div className="text-[15px] font-semibold text-rose-700 dark:text-rose-300 tabular-nums">{formatRub(card.returned_value)}</div>
              </div>
            </div>
            {card.top_return_reasons && card.top_return_reasons.length > 0 && (
              <div>
                <div className="text-[10px] uppercase tracking-wider text-ink-muted mb-1">Причины</div>
                <ul className="space-y-0.5 text-[12px]">
                  {card.top_return_reasons.map(([reason, n], i) => (
                    <li key={i} className="text-ink">• {reason} <span className="text-ink-subtle">({n})</span></li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        <div className="text-[11px] text-ink-subtle">
          Комиссия Ozon: {formatRub(card.commission)} · отправлений по этому SKU: {card.postings_count}
        </div>
      </div>
    </div>
  );
}

function HistoryChart({ history }: { history: OzonCard["premium_history"] }) {
  if (history.length < 2) {
    return (
      <div className="text-[11px] text-ink-subtle">
        История: {history.length} {history.length === 1 ? "запись" : "записей"} — графика будет больше через пару недель.
      </div>
    );
  }
  // История идёт от свежей к старой — переворачиваем для отображения слева направо по времени
  const data = [...history].reverse();
  const positions = data.map((w) => w.position || 999);
  // CTR показ→PDP по неделям (наш расчёт = view_users / search_users * 100).
  // НЕ используем conversion_pct из API — там конверсия в покупку через поиск, не CTR.
  const convs = data.map((w) =>
    w.search_users > 0 ? (w.view_users / w.search_users) * 100 : 0
  );
  const maxPos = Math.max(...positions);
  const minPos = Math.min(...positions);
  const maxConv = Math.max(0.1, ...convs);

  const w = 400, h = 100, padX = 8, padTop = 8, padBottom = 22;
  const innerW = w - padX * 2;
  const innerH = h - padTop - padBottom;
  const xAt = (i: number) => padX + (data.length === 1 ? innerW / 2 : (i / (data.length - 1)) * innerW);
  // Позиция: меньше = лучше = выше на графике → инвертируем шкалу
  const yPos = (p: number) => {
    if (maxPos === minPos) return padTop + innerH / 2;
    return padTop + ((p - minPos) / (maxPos - minPos)) * innerH;
  };
  const yConv = (c: number) => padTop + innerH - (c / maxConv) * innerH;

  const linePath = (vals: number[], yFn: (v: number) => number) =>
    vals.map((v, i) => `${i === 0 ? "M" : "L"} ${xAt(i).toFixed(1)} ${yFn(v).toFixed(1)}`).join(" ");

  return (
    <div className="card bg-surface-alt p-3">
      <header className="mb-2 flex items-baseline justify-between text-[11px]">
        <span className="font-semibold tracking-tightish">История по неделям</span>
        <span className="text-ink-subtle">{data.length} нед.</span>
      </header>
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" height={h} preserveAspectRatio="none">
        {/* Позиция — оранжевая */}
        <path d={linePath(positions, yPos)} fill="none" stroke="#ea580c" strokeWidth="2" />
        {positions.map((p, i) => (
          <circle key={`p-${i}`} cx={xAt(i)} cy={yPos(p)} r="3" fill="#ea580c" />
        ))}
        {/* Конверсия — синяя */}
        <path d={linePath(convs, yConv)} fill="none" stroke="#1a0088" strokeWidth="2" strokeDasharray="4 2" />
        {convs.map((c, i) => (
          <circle key={`c-${i}`} cx={xAt(i)} cy={yConv(c)} r="3" fill="#1a0088" />
        ))}
      </svg>
      <div className="flex justify-between text-[9px] text-ink-subtle px-1 mt-0.5 tabular-nums">
        {data.map((w, i) => (
          <span key={i}>{w.period_from.slice(5)}</span>
        ))}
      </div>
      <div className="flex gap-3 text-[10px] mt-2">
        <span className="flex items-center gap-1">
          <span className="w-3 h-0.5 bg-orange-600" /> позиция (вверх = хуже)
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 inline-block" style={{ borderTop: "1px dashed #1a0088" }} /> CTR показ→PDP %
        </span>
      </div>
    </div>
  );
}

function Metric({
  label, value, hint, warning,
}: { label: string; value: React.ReactNode; hint?: string; warning?: boolean }) {
  return (
    <div className={clsx("p-3 rounded-lg border", warning ? "bg-amber-50/30 border-amber-200 dark:bg-amber-900/10 dark:border-amber-800" : "bg-surface border-line")}>
      <div className="text-[10px] uppercase tracking-wider text-ink-muted font-medium">{label}</div>
      <div className={clsx("mt-1 text-[15px] font-semibold tabular-nums tracking-tighter2", warning ? "text-amber-700 dark:text-amber-300" : "text-ink")}>
        {value}
      </div>
      {hint && <div className="text-[10px] text-ink-subtle mt-0.5">{hint}</div>}
    </div>
  );
}

function Th({ children, align = "left", title }: { children?: React.ReactNode; align?: "left" | "right" | "center"; title?: string }) {
  return (
    <th
      title={title}
      className={clsx(
        "px-3 py-2 font-medium text-[10px] uppercase tracking-wider",
        align === "right" ? "text-right" : align === "center" ? "text-center" : "text-left",
        title && "cursor-help underline decoration-dotted decoration-ink-soft underline-offset-2",
      )}
    >
      {children}
    </th>
  );
}

function Td({ children, align = "left", className = "" }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={clsx("px-3 py-2 align-middle", align === "right" && "text-right", className)}>{children}</td>
  );
}
