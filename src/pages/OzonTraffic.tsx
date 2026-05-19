import { useEffect, useMemo, useState } from "react";
import clsx from "clsx";
import {
  AlertTriangle, ArrowDownUp, Flame, MoonStar, PackageX,
  Search, ShieldAlert, Sparkles, TrendingDown, TrendingUp, X,
} from "lucide-react";
import { api, type OzonCard, type OzonCardsResponse } from "../api";
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
  | "revenue" | "units" | "velocity" | "cancel" | "available" | "days_to_stockout";

const SORT_LABEL: Record<SortBy, string> = {
  revenue: "Выручка ↓",
  units: "Продано ↓",
  velocity: "Velocity ↓",
  cancel: "% отмен ↓",
  available: "Остаток ↑",
  days_to_stockout: "Дней до 0 ↑",
};

// Тэги для подсветки в таблице
const TAG_LABEL: Record<string, { text: string; cls: string }> = {
  silent: { text: "молчит", cls: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700" },
  high_cancel: { text: "много отмен", cls: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800" },
  stock_risk: { text: "заканчивается", cls: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800" },
  out_of_stock: { text: "распродан", cls: "bg-slate-100 text-slate-500 border-slate-300 dark:bg-slate-700 dark:text-slate-400 dark:border-slate-600" },
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
    const opts =
      period === "custom"
        ? { from: from || undefined, to: to || undefined }
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
        sorted.sort((a, b) => {
          const av = a.days_to_stockout ?? 99999;
          const bv = b.days_to_stockout ?? 99999;
          return av - bv;
        });
        break;
    }
    return sorted;
  }, [data, q, sortBy, tagFilter]);

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1280px] animate-slide-up">
      <header className="mb-5">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Селект · Трафик карточек</h1>
        <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
          Поведение каждой карточки на Ozon: что продаётся, что простаивает, где
          высокий процент отмен, кто закончится через несколько дней. Анализ строится
          по реальным заказам — Ozon API не даёт показы/сессии без Premium, поэтому
          здесь — практическая аналитика «движения» товара.
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
                </select>
              </div>
            </div>
          </section>

          {/* Полная таблица карточек */}
          {filtered && filtered.length > 0 ? (
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-[12px] min-w-[900px]">
                  <thead className="bg-surface-alt border-b border-line text-ink-muted">
                    <tr>
                      <Th>Артикул</Th>
                      <Th>Модель · цвет · размер</Th>
                      <Th align="right">Продано</Th>
                      <Th align="right">Выручка</Th>
                      <Th align="right">Velocity</Th>
                      <Th align="right">% отмен</Th>
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

      {selected && <DetailModal card={selected} onClose={() => setSelected(null)} />}
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
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const sold = card.units_delivered + card.units_delivering;

  // Простые рекомендации в зависимости от тэгов
  const recommendations: string[] = [];
  if (card.tags.includes("stock_risk") && card.days_to_stockout !== null) {
    recommendations.push(`Закончится через ~${card.days_to_stockout.toFixed(1)} дней — срочно пополни (минимум на 2-3 недели × ${card.velocity_per_day.toFixed(2)} = ${Math.ceil(card.velocity_per_day * 21)} единиц).`);
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

        <div className="text-[11px] text-ink-subtle">
          Комиссия Ozon: {formatRub(card.commission)} · отправлений по этому SKU: {card.postings_count}
        </div>
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

function Th({ children, align = "left" }: { children?: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={clsx("px-3 py-2 font-medium text-[10px] uppercase tracking-wider", align === "right" ? "text-right" : "text-left")}>
      {children}
    </th>
  );
}

function Td({ children, align = "left", className = "" }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return (
    <td className={clsx("px-3 py-2 align-middle", align === "right" && "text-right", className)}>{children}</td>
  );
}
