/** Селект → Гипотезы: журнал тестов Ozon и накопленное знание.
 *
 * Данные заводит бот, вердикты пишет крон. Здесь только чтение — страница
 * отвечает на вопрос «что вообще работало», ради которого модуль и строился:
 * в прежней ручной таблице было 129 действий и ноль зафиксированных итогов.
 */
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import {
  Archive, Beaker, CalendarClock, Filter, Sparkles, ThumbsDown, ThumbsUp,
  TrendingUp, X,
} from "lucide-react";
import { api, type Hypothesis, type HypothesesResponse } from "../api";
import { StatCard } from "../components/StatCard";
import { StatCardsSkeleton } from "../components/Skeleton";
import { hasApi } from "../env";

function fmtNum(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
}
function fmtRub(n: number): string {
  return `${n > 0 ? "+" : ""}${fmtNum(n)} ₽`;
}
function fmtShortRub(n: number): string {
  const a = Math.abs(n);
  if (a >= 1_000_000) return `${n > 0 ? "+" : "−"}${(a / 1_000_000).toFixed(1)} млн ₽`;
  if (a >= 1000) return `${n > 0 ? "+" : "−"}${Math.round(a / 1000)} тыс ₽`;
  return fmtRub(n);
}
function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso.slice(0, 10)
    : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

type Kind = "ok" | "bad" | "unclear" | "nodata" | "running";

function kindOf(h: Hypothesis): Kind {
  if (h.status === "активна") return "running";
  const v = h.verdict || "";
  if (v.includes("НЕ СРАБОТАЛО")) return "bad";
  if (v.includes("СРАБОТАЛО")) return "ok";
  if (v.includes("НЕДОСТАТОЧНО")) return "nodata";
  return "unclear";
}

const KIND_META: Record<Kind, { dot: string; text: string; label: string }> = {
  ok: { dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", label: "Сработало" },
  bad: { dot: "bg-rose-500", text: "text-rose-600 dark:text-rose-400", label: "Не сработало" },
  unclear: { dot: "bg-amber-500", text: "text-amber-600 dark:text-amber-400", label: "Неоднозначно" },
  nodata: { dot: "bg-neutral-400", text: "text-ink-muted", label: "Мало данных" },
  running: { dot: "bg-brand", text: "text-brand", label: "Идёт" },
};

function daysLeft(checkAt: string): string {
  if (!checkAt) return "";
  const d = new Date(checkAt);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (diff < 0) return "пора проверять";
  if (diff === 0) return "сегодня";
  return `через ${diff} дн.`;
}

const METRIC_ROWS = [
  { key: "revenue", label: "Выручка", unit: " ₽" },
  { key: "orders", label: "Заказы", unit: "" },
  { key: "views", label: "Показы", unit: "" },
  { key: "sessions", label: "Переходы в карточку", unit: "" },
  { key: "carts", label: "Корзины", unit: "" },
  { key: "ctr", label: "CTR", unit: " %" },
  { key: "ad_spent", label: "Расход рекламы", unit: " ₽" },
  { key: "drr", label: "ДРР", unit: " %" },
] as const;

/** Текст вердикта приходит с telegram-разметкой: моноширинный блок с таблицей
 *  нельзя показывать обычным шрифтом — колонки разъезжаются. */
function VerdictText({ raw }: { raw: string }) {
  const blocks = raw.split(/<\/?code>/g);
  return (
    <div className="space-y-2 text-[13px] leading-relaxed">
      {blocks.map((b, i) => {
        const clean = b.replace(/<[^>]+>/g, "").trim();
        if (!clean) return null;
        return i % 2 === 1 ? (
          <pre key={i} className="overflow-x-auto rounded-lg bg-black/[.04] p-2.5 font-mono text-[11.5px] leading-snug dark:bg-white/[.07]">
            {clean}
          </pre>
        ) : (
          <p key={i} className="whitespace-pre-wrap">{clean}</p>
        );
      })}
    </div>
  );
}

function Detail({ h, onClose }: { h: Hypothesis; onClose: () => void }) {
  const b = h.metrics?.before as Record<string, number> | undefined;
  const a = h.metrics?.after as Record<string, number> | undefined;
  const k = kindOf(h);
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/50 p-3 sm:p-4" onClick={onClose}>
      <div
        className="card max-h-[88vh] w-full max-w-2xl overflow-y-auto p-4 sm:p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs text-ink-muted">
              #{h.id} · {h.author} · {fmtDate(h.created_at)}
              {h.auto_detected && " · найдено автоматически"}
            </div>
            <h3 className="truncate text-lg font-semibold">{h.product}</h3>
            <div className="text-sm text-ink-muted">{h.object}</div>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium",
            "bg-black/[.04] dark:bg-white/[.08]", KIND_META[k].text)}>
            <span className={clsx("h-1.5 w-1.5 rounded-full", KIND_META[k].dot)} />
            {KIND_META[k].label}
          </span>
          {h.status !== "активна" && h.effect_rub !== 0 && (
            <span className={clsx("text-sm font-semibold tabular-nums",
              h.effect_rub > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
              {fmtRub(h.effect_rub)}
            </span>
          )}
          {h.status === "активна" && (
            <span className="text-sm text-ink-muted">
              проверка {fmtDate(h.check_at)} — {daysLeft(h.check_at)}
            </span>
          )}
          <span className="text-xs text-ink-muted">окно {h.window_days} дн.</span>
        </div>

        {h.comment && (
          <div className="mb-3 rounded-lg bg-black/[.03] px-3 py-2 text-sm italic dark:bg-white/[.06]">
            «{h.comment}»
          </div>
        )}

        <div className="mb-3 flex flex-wrap gap-1">
          {h.skus.map((s) => (
            <span key={s} className="rounded bg-black/[.05] px-1.5 py-0.5 font-mono text-[11px] dark:bg-white/10">
              {s}
            </span>
          ))}
        </div>

        {(b || a) && (
          <div className="mb-3 overflow-x-auto">
            <table className="w-full text-sm tabular-nums">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th className="pb-1.5 font-medium">метрика</th>
                  <th className="pb-1.5 text-right font-medium">до</th>
                  <th className="pb-1.5 text-right font-medium">после</th>
                  <th className="pb-1.5 text-right font-medium">Δ</th>
                </tr>
              </thead>
              <tbody>
                {METRIC_ROWS.map(({ key, label, unit }) => {
                  const bv = b?.[key];
                  const av = a?.[key];
                  if (bv === undefined && av === undefined) return null;
                  const delta = bv ? ((av ?? 0) - bv) / bv * 100 : null;
                  return (
                    <tr key={key} className="border-t border-black/5 dark:border-white/5">
                      <td className="py-1.5">{label}</td>
                      <td className="py-1.5 text-right">{bv === undefined ? "—" : fmtNum(bv) + unit}</td>
                      <td className="py-1.5 text-right">{av === undefined ? "—" : fmtNum(av) + unit}</td>
                      <td className={clsx("py-1.5 text-right font-medium",
                        delta !== null && delta > 0 && "text-emerald-600 dark:text-emerald-400",
                        delta !== null && delta < 0 && "text-rose-600 dark:text-rose-400")}>
                        {delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta.toFixed(0)}%`}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {h.verdict_text && <VerdictText raw={h.verdict_text} />}
      </div>
    </div>,
    document.body,
  );
}

export function Hypotheses() {
  const [data, setData] = useState<HypothesesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Hypothesis | null>(null);
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [product, setProduct] = useState<string>("all");

  useEffect(() => {
    if (!hasApi) { setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const d = await api.hypotheses();
        if (alive) setData(d);
      } catch (e) {
        if (alive) setErr(e instanceof Error ? e.message : "не удалось загрузить");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  const items = data?.items ?? [];
  const s = data?.stats;

  /** Сводка по товарам: где тестировали и что из этого вышло. */
  const byProduct = useMemo(() => {
    const m = new Map<string, { product: string; total: number; ok: number; effect: number }>();
    for (const h of items) {
      if (h.status === "активна") continue;
      const e = m.get(h.product) ?? { product: h.product, total: 0, ok: 0, effect: 0 };
      e.total += 1;
      if (kindOf(h) === "ok") e.ok += 1;
      e.effect += h.effect_rub;
      m.set(h.product, e);
    }
    return [...m.values()].sort((x, y) => y.effect - x.effect);
  }, [items]);

  const best = useMemo(
    () => items.filter((h) => kindOf(h) === "ok").sort((a, b) => b.effect_rub - a.effect_rub).slice(0, 3),
    [items],
  );
  const worst = useMemo(
    () => items.filter((h) => kindOf(h) === "bad").sort((a, b) => a.effect_rub - b.effect_rub).slice(0, 3),
    [items],
  );

  const products = useMemo(
    () => [...new Set(items.map((h) => h.product))].sort(),
    [items],
  );

  const shown = useMemo(
    () => items.filter((h) =>
      (filter === "all" || kindOf(h) === filter) &&
      (product === "all" || h.product === product)),
    [items, filter, product],
  );

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.length };
    for (const h of items) {
      const k = kindOf(h);
      c[k] = (c[k] ?? 0) + 1;
    }
    return c;
  }, [items]);

  if (loading) return <StatCardsSkeleton />;
  if (err) return <div className="card p-4 text-sm text-rose-600">{err}</div>;

  const empty = items.length === 0;
  const successRate = s && s.done ? Math.round((s.worked / s.done) * 100) : null;

  return (
    // Отступы и ширина — как на соседних страницах Селекта (Ozon, OzonTraffic),
    // иначе контент прилипает к краям на десктопе и на мобильном.
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1280px] animate-slide-up space-y-4">
      <header className="mb-1">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Селект · Гипотезы</h1>
        <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
          Что меняли на Ozon, что из этого вышло и сколько это стоило в деньгах.
          Метрики до и после снимаются автоматически, вердикт — с поправкой на общий фон.
        </p>
      </header>

      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Тестов идёт" value={s.active} accent={s.active > 0}
                    hint={s.active ? "проверю сам по окончании окна" : "заведи в боте"} />
          <StatCard label="Завершено" value={s.done}
                    hint={s.done
                      ? `🟢 ${s.worked} · 🔴 ${s.failed} · 🟡 ${s.unclear}`
                      : s.retro ? `+ ${s.retro.total} перенесённых ниже` : undefined} />
          <StatCard label="Доля удачных" value={successRate === null ? "—" : `${successRate}%`}
                    hint={s.done ? `${s.worked} из ${s.done}` : "считается по живым тестам"} />
          <StatCard label="Эффект накоплен"
                    value={s.effect_total ? fmtShortRub(s.effect_total) : "—"}
                    accent={s.effect_total > 0}
                    hint={s.done ? "сумма чистых эффектов" : "появится после первых вердиктов"} />
        </div>
      )}

      {empty ? (
        <div className="card p-6 text-center">
          <Beaker className="mx-auto mb-2 h-8 w-8 text-ink-muted" />
          <div className="font-medium">Пока ни одной гипотезы</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Тесты заводятся в Telegram-боте: «🧪 Новая гипотеза» или просто строкой —
            «запустила рк на KRB-DGR-S поиск и пир авто». Метрики до и после
            система снимет сама.
          </p>
        </div>
      ) : (
        <>
          {(best.length > 0 || worst.length > 0) && (
            <div className="grid gap-3 lg:grid-cols-2">
              {best.length > 0 && (
                <div className="card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <ThumbsUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                    <h2 className="text-sm font-medium">Лучшие тесты</h2>
                    {s?.retro && <span className="text-[10px] text-ink-muted">включая перенос</span>}
                  </div>
                  <div className="space-y-1.5">
                    {best.map((h) => (
                      <button key={h.id} onClick={() => setOpen(h)}
                        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-black/[.03] dark:hover:bg-white/[.06]">
                        <span className="min-w-0 flex-1 truncate">{h.product} · <span className="text-ink-muted">{h.object}</span></span>
                        <span className="shrink-0 font-medium tabular-nums text-emerald-600 dark:text-emerald-400">
                          {fmtShortRub(h.effect_rub)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {worst.length > 0 && (
                <div className="card p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <ThumbsDown className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                    <h2 className="text-sm font-medium">Что не сработало</h2>
                    {s?.retro && <span className="text-[10px] text-ink-muted">включая перенос</span>}
                  </div>
                  <div className="space-y-1.5">
                    {worst.map((h) => (
                      <button key={h.id} onClick={() => setOpen(h)}
                        className="flex w-full items-center gap-2 rounded-lg px-1 py-1 text-left text-sm hover:bg-black/[.03] dark:hover:bg-white/[.06]">
                        <span className="min-w-0 flex-1 truncate">{h.product} · <span className="text-ink-muted">{h.object}</span></span>
                        <span className="shrink-0 font-medium tabular-nums text-rose-600 dark:text-rose-400">
                          {fmtShortRub(h.effect_rub)}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="card p-3">
            <div className="mb-2 flex items-center gap-1.5 text-xs text-ink-muted">
              <Filter className="h-3.5 w-3.5" /> Фильтр
            </div>
            <div className="flex flex-wrap gap-1.5">
              {([["all", `Все (${counts.all})`],
                 ["running", `Идут (${counts.running ?? 0})`],
                 ["ok", `🟢 Сработало (${counts.ok ?? 0})`],
                 ["bad", `🔴 Нет (${counts.bad ?? 0})`],
                 ["unclear", `🟡 Спорно (${counts.unclear ?? 0})`],
                 ["nodata", `⚪ Мало данных (${counts.nodata ?? 0})`]] as const)
                .filter(([k]) => k === "all" || (counts[k] ?? 0) > 0)
                .map(([k, label]) => (
                  <button key={k} onClick={() => setFilter(k as Kind | "all")}
                    className={clsx("rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
                      filter === k ? "bg-brand text-white" : "bg-black/[.05] hover:bg-black/[.09] dark:bg-white/[.08] dark:hover:bg-white/[.14]")}>
                    {label}
                  </button>
                ))}
            </div>
            {products.length > 1 && (
              <select value={product} onChange={(e) => setProduct(e.target.value)}
                className="mt-2 w-full rounded-lg border border-black/10 bg-transparent px-2 py-1.5 text-sm dark:border-white/15 sm:w-64">
                <option value="all">Все товары</option>
                {products.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>

          <div className="space-y-2">
            {shown.length === 0 && (
              <div className="card p-4 text-center text-sm text-ink-muted">
                Под фильтр ничего не попало.
              </div>
            )}
            {shown.map((h) => {
              const k = kindOf(h);
              return (
                <button key={h.id} onClick={() => setOpen(h)}
                  className="card card-hover flex w-full items-start gap-3 p-3 text-left">
                  <span className={clsx("mt-1.5 h-2 w-2 shrink-0 rounded-full", KIND_META[k].dot)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs text-ink-muted">#{h.id}</span>
                      <span className="truncate font-medium">{h.product}</span>
                      {h.auto_detected && <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand" />}
                      {h.source === "retro" && (
                        <span className="shrink-0 rounded bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-700 dark:text-amber-400">перенос</span>
                      )}
                    </div>
                    <div className="truncate text-sm text-ink-muted">{h.object}</div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-muted">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="h-3 w-3" />
                        {h.status === "активна"
                          ? `проверка ${fmtDate(h.check_at)} — ${daysLeft(h.check_at)}`
                          : fmtDate(h.created_at)}
                      </span>
                      <span>· {h.skus.length} SKU</span>
                      {h.overlap_ids && <span className="text-amber-600 dark:text-amber-400">· пересечение</span>}
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <div className={clsx("text-xs font-medium", KIND_META[k].text)}>{KIND_META[k].label}</div>
                    {h.status !== "активна" && h.effect_rub !== 0 && (
                      <div className={clsx("text-sm font-semibold tabular-nums",
                        h.effect_rub > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                        {fmtShortRub(h.effect_rub)}
                      </div>
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </>
      )}

      {s && s.by_action.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand" />
            <h2 className="font-medium">Что срабатывало — по типам изменений</h2>
          </div>
          <div className="space-y-2.5">
            {s.by_action.map((a) => (
              <div key={a.action} className="flex items-center gap-2 text-sm sm:gap-3">
                <span className="w-28 shrink-0 truncate sm:w-40">{a.action}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/10">
                  <div className="h-full rounded-full bg-brand"
                       style={{ width: `${a.total ? (a.worked / a.total) * 100 : 0}%` }} />
                </div>
                <span className="w-12 shrink-0 text-right tabular-nums text-xs text-ink-muted">
                  {a.worked}/{a.total}
                </span>
                <span className={clsx("w-20 shrink-0 text-right text-xs tabular-nums sm:w-24",
                  a.effect > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {fmtShortRub(a.effect)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Доля тестов, признанных удачными, и суммарный чистый эффект по каждому типу.
          </p>
        </div>
      )}

      {byProduct.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 font-medium">Что срабатывало — по товарам</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-muted">
                  <th className="pb-1.5 font-medium">товар</th>
                  <th className="pb-1.5 text-right font-medium">тестов</th>
                  <th className="pb-1.5 text-right font-medium">удачных</th>
                  <th className="pb-1.5 text-right font-medium">эффект</th>
                </tr>
              </thead>
              <tbody>
                {byProduct.map((p) => (
                  <tr key={p.product} className="border-t border-black/5 dark:border-white/5">
                    <td className="py-1.5 pr-2">{p.product}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.total}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.ok}</td>
                    <td className={clsx("py-1.5 text-right font-medium tabular-nums",
                      p.effect > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                      {fmtShortRub(p.effect)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {s?.retro && (
        <div className="card border-amber-500/25 p-4">
          <div className="mb-1 flex items-center gap-2">
            <Archive className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            <h2 className="font-medium">Перенос из старой таблицы</h2>
          </div>
          <p className="mb-3 text-xs text-ink-muted">
            {s.retro.total} записей за {fmtDate(s.retro.period[0])} — {fmtDate(s.retro.period[1])}.
            Метрики пересчитаны задним числом, поэтому в общую статистику выше они не входят:
            в те дни неизвестно, что ещё менялось, и часть движения — это сезон, а не тест.
            Смотреть стоит на <b>структуру</b> — что чаще тестировали, — а не на итоговую сумму.
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            {([["Записей", s.retro.total, ""],
               ["🟢 Сработало", s.retro.worked, "text-emerald-600 dark:text-emerald-400"],
               ["🔴 Нет", s.retro.failed, "text-rose-600 dark:text-rose-400"],
               ["🟡 Спорно", s.retro.unclear, "text-amber-600 dark:text-amber-400"]] as const).map(
              ([label, val, cls]) => (
                <div key={label} className="rounded-lg bg-black/[.03] px-2.5 py-1.5 dark:bg-white/[.06]">
                  <div className="text-[11px] text-ink-muted">{label}</div>
                  <div className={clsx("text-lg font-semibold tabular-nums", cls)}>{val}</div>
                </div>
              ),
            )}
          </div>
          <div className="space-y-2">
            {s.retro.by_action.map((a) => (
              <div key={a.action} className="flex items-center gap-2 text-sm sm:gap-3">
                <span className="w-28 shrink-0 truncate sm:w-40">{a.action}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/10">
                  <div className="h-full rounded-full bg-amber-500"
                       style={{ width: `${a.total ? (a.worked / a.total) * 100 : 0}%` }} />
                </div>
                <span className="w-12 shrink-0 text-right text-xs tabular-nums text-ink-muted">
                  {a.worked}/{a.total}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Главное, что видно: <b>реклама — 19 из 56 записей</b>, но удачных среди них лишь
            {" "}{s.retro.by_action.find((a) => a.action.includes("Реклама"))?.worked ?? 0}.
            Дальше сравнение пойдёт уже на живых тестах, где известно окно и контроль.
          </p>
        </div>
      )}

      {data?.events && data.events.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 font-medium">Правки карточек</h2>
          <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {data.events.map((e, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-black/5 py-1 last:border-0 dark:border-white/5">
                <span className="w-12 shrink-0 text-xs text-ink-muted">{e.date.slice(5)}</span>
                <span className="w-36 shrink-0 truncate font-mono text-[11px]">{e.sku}</span>
                <span className="truncate text-ink-muted">{e.field}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Состав карточек снимается ежедневно. Эти правки учитываются как конкурирующие
            причины, если попали в окно теста.
          </p>
        </div>
      )}

      {open && <Detail h={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
