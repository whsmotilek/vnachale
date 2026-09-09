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
import { api, type Hypothesis, type HypothesesResponse, type CoverTest } from "../api";
import { StatCard } from "../components/StatCard";
import { StatCardsSkeleton } from "../components/Skeleton";
import { hasApi, env } from "../env";

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

/** Обложка до и после правки.
 *
 *  Без картинок фиксация теста бессмысленна: через месяц по строке «главное
 *  фото» никто не вспомнит, о какой именно обложке шла речь. Ссылки берутся из
 *  журнала изменений — снимок карточек идёт ежечасно и хранит их строками,
 *  поэтому старые фото остаются доступными и после замены. */
function BeforeAfter({ v }: { v: { before: string; after: string; changed_at: string; sku: string } }) {
  // Картинки берём через наш прокси, а не прямой ссылкой на CDN Ozon: прямая
  // ссылка открывается с сервера, но не грузится в браузере у пользователя.
  const via = (u: string) =>
    u ? `${env.apiBaseUrl}/img/ozon?u=${encodeURIComponent(u)}` : "";
  const cell = (label: string, src: string) => (
    <figure className="min-w-0">
      <figcaption className="mb-1 text-[10px] uppercase tracking-wider text-ink-muted">{label}</figcaption>
      {src ? (
        <a href={via(src)} target="_blank" rel="noreferrer">
          <img src={via(src)} alt={label} loading="lazy"
               className="aspect-[3/4] w-full rounded-lg border border-line object-cover bg-surface-alt" />
        </a>
      ) : (
        <div className="flex aspect-[3/4] w-full items-center justify-center rounded-lg border border-dashed border-line text-[11px] text-ink-subtle">
          обложки не было
        </div>
      )}
    </figure>
  );
  return (
    <div className="mt-4 rounded-xl border border-line bg-surface-alt p-3">
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h4 className="text-[12px] font-semibold text-ink">Обложка: было и стало</h4>
        <span className="text-[10px] text-ink-subtle">
          {v.sku} · правка {fmtDate(v.changed_at)}
        </span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {cell("было", v.before)}
        {cell("стало", v.after)}
      </div>
    </div>
  );
}


function Detail({ h, onClose, onDeleted }: {
  h: Hypothesis; onClose: () => void; onDeleted: () => void;
}) {
  const [deleting, setDeleting] = useState(false);

  async function remove() {
    if (!confirm(
      `Удалить гипотезу #${h.id} «${h.product} · ${h.object}»?\n\n` +
      "Она исчезнет из журнала и из статистики «что срабатывало», " +
      "замороженные метрики тоже удалятся. Отменить это будет нельзя.",
    )) return;
    setDeleting(true);
    try {
      await api.deleteHypothesis(h.id);
      onDeleted();
      onClose();
    } catch (e) {
      alert(`Не удалось удалить: ${e instanceof Error ? e.message : "ошибка"}`);
      setDeleting(false);
    }
  }
  return <DetailBody h={h} onClose={onClose} onRemove={remove} deleting={deleting} />;
}

function DetailBody({ h, onClose, onRemove, deleting }: {
  h: Hypothesis; onClose: () => void; onRemove: () => void; deleting: boolean;
}) {
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
          {h.status !== "активна" && h.effect_rub === null && (
            <span className="text-sm text-ink-muted">эффект не измерен</span>
          )}
          {h.status !== "активна" && !!h.effect_rub && (
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

        {h.visual && <BeforeAfter v={h.visual} />}

        {h.verdict_text && <VerdictText raw={h.verdict_text} />}

        <div className="mt-4 flex items-center justify-between gap-3 border-t border-black/5 pt-3 dark:border-white/10">
          <p className="text-[11px] leading-snug text-ink-muted">
            Завели по ошибке или это дубль? Удалите — гипотеза перестанет
            учитываться в статистике и у ассистента.
          </p>
          <button
            onClick={onRemove}
            disabled={deleting}
            className="shrink-0 rounded-lg border border-rose-500/30 px-3 py-1.5 text-xs
                       font-medium text-rose-600 transition-colors hover:bg-rose-500/10
                       disabled:opacity-50 dark:text-rose-400"
          >
            {deleting ? "Удаляю…" : "Удалить гипотезу"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Ход теста обложек: какой кандидат сколько провисел и что принёс.
 *
 *  Считаем заказами, а не кликабельностью: показы Ozon отдаёт только суточной
 *  суммой, а за сутки успевает отработать два десятка обложек — разложить их по
 *  вариантам невозможно. Время создания отправления мы знаем сами.
 */
function CoverTestBlock({ c }: { c: CoverTest }) {
  const [all, setAll] = useState(false);
  const byOrders = c.metric !== "ctr";
  const vs = c.variants ?? [];
  const shown = all ? vs : vs.slice(0, 6);
  const started = c.started_at ? fmtDate(c.started_at) : "—";
  return (
    <section className="rounded-xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2 mb-1">
        <h2 className="text-[14px] font-semibold text-ink">
          Тест обложек · {c.title} <span className="text-ink-subtle">({c.product})</span>
        </h2>
        <span className="text-[11px] text-ink-subtle">
          с {started} · смена {c.cadence}
          {byOrders
            ? ` · заказов ${c.orders_total}`
            : ` · показов ${(c.views_total ?? 0).toLocaleString("ru")}`}
        </span>
      </div>
      <p className="text-[12px] text-ink-muted leading-relaxed mb-3">
        {byOrders ? (
          <>
            Обложка меняется каждый час в окне {c.window}: {c.candidates_total} кандидатов
            и нынешняя обложка делят {(c.test_days ?? 3) * 12} часовых слотов за
            {" "}{c.test_days} дня, и каждый попадает в разные часы, а не
            приклеивается к одному. Считаем долю к контролю
            ({(c.control ?? []).join(" и ")}) в те же часы — так видно, обложка это
            сработала или рынок качнулся.
          </>
        ) : (
          <>
            Обложка стоит ровно сутки: кликабельность Ozon отдаёт только дневной
            суммой, и при более частой смене день не разложить. {c.candidates_total} фото
            — {c.test_days} дней. У товара мало заказов, зато много показов, поэтому
            меряем переходы, а не покупки. Контроль — {(c.control ?? []).join(" и ")}:
            обложку ему не трогаем. Нынешняя обложка слот не занимает, её
            кликабельность уже известна из истории показов.
          </>
        )}
      </p>

      {!c.enough_data && (
        <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2
                        text-[12px] text-amber-900 dark:border-amber-800
                        dark:bg-amber-900/20 dark:text-amber-200">
          Победителя пока нет: данных хватило у {c.measured ?? 0} обложек из
          {" "}{(c.candidates_total ?? 0) + (c.with_base ? 1 : 0)}. Нужно{" "}
          {byOrders
            ? `${c.min_orders ?? 30} заказов`
            : `${(c.min_views ?? 3000).toLocaleString("ru")} показов`} на каждую.
          Пока интервал не оторвался от нуля, порядок в таблице — это шум.
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {shown.map((v, i) => (
          <figure key={v.variant} className="min-w-0">
            <div className="relative">
              {v.image ? (
                <img src={v.image} alt={v.variant} loading="lazy"
                     className="aspect-[3/4] w-full rounded-lg border border-line
                                object-cover bg-surface-alt" />
              ) : (
                <div className="aspect-[3/4] w-full rounded-lg border border-dashed border-line" />
              )}
              {v.wins && (
                <span className="absolute top-1 left-1 rounded bg-brand px-1.5 py-0.5
                                 text-[10px] font-medium text-white">лидер</span>
              )}
              {v.is_base && (
                <span className="absolute top-1 right-1 rounded bg-ink/70 px-1.5 py-0.5
                                 text-[10px] font-medium text-white">нынешняя</span>
              )}
            </div>
            <figcaption className="mt-1">
              <div className="text-[11px] text-ink-muted">
                {v.is_base ? "нынешняя обложка" : v.variant}
              </div>
              {v.lift != null ? (
                <div className="text-[12px] tabular-nums text-ink">
                  <span className={v.lift >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-rose-600 dark:text-rose-400"}>
                    {v.lift >= 0 ? "+" : ""}{v.lift}%
                  </span>
                  {v.lift_se != null && (
                    <span className="text-ink-subtle"> ± {v.lift_se}</span>
                  )}
                </div>
              ) : (
                <div className="text-[12px] text-ink-subtle">
                  {v.is_base ? "точка отсчёта" : "нет данных"}
                </div>
              )}
              <div className="text-[11px] tabular-nums text-ink-subtle">
                {byOrders
                  ? `${v.orders} зак · контроль ${v.control_orders} · ${v.hours} ч`
                  : `${v.views.toLocaleString("ru")} показов · ${v.clicks} переходов`}
              </div>
            </figcaption>
          </figure>
        ))}
      </div>

      {vs.length > 6 && (
        <button onClick={() => setAll((x) => !x)}
                className="mt-3 text-[12px] text-ink-muted hover:text-ink">
          {all ? "свернуть" : `показать все ${vs.length}`}
        </button>
      )}
    </section>
  );
}


export function Hypotheses() {
  const [data, setData] = useState<HypothesesResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [open, setOpen] = useState<Hypothesis | null>(null);
  const [filter, setFilter] = useState<Kind | "all">("all");
  const [product, setProduct] = useState<string>("all");
  const [covers, setCovers] = useState<CoverTest[]>([]);

  useEffect(() => {
    if (!hasApi) { setLoading(false); return; }
    let alive = true;
    (async () => {
      try {
        const d = await api.hypotheses();
        if (alive) setData(d);
        // Тест обложек грузим отдельно: он из другого источника, и его сбой
        // не должен ронять журнал гипотез.
        api.coverTest().then((c) => { if (alive) setCovers(c.tests ?? []); }).catch(() => {});
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
    const m = new Map<string, { product: string; total: number; measured: number; ok: number; effect: number }>();
    for (const h of items) {
      if (h.status === "активна") continue;
      const e = m.get(h.product) ?? { product: h.product, total: 0, measured: 0, ok: 0, effect: 0 };
      e.total += 1;
      // Неизмеримый тест не участвует ни в сумме, ни в «сколько удачных»:
      // иначе он молча засчитывается как неудача.
      if (h.effect_rub !== null) {
        e.measured += 1;
        e.effect += h.effect_rub;
        if (kindOf(h) === "ok") e.ok += 1;
      }
      m.set(h.product, e);
    }
    return [...m.values()].sort((x, y) => y.effect - x.effect);
  }, [items]);

  const best = useMemo(
    () => items.filter((h) => kindOf(h) === "ok" && h.effect_rub !== null)
      .sort((a, b) => (b.effect_rub as number) - (a.effect_rub as number)).slice(0, 3),
    [items],
  );
  const worst = useMemo(
    () => items.filter((h) => kindOf(h) === "bad" && h.effect_rub !== null)
      .sort((a, b) => (a.effect_rub as number) - (b.effect_rub as number)).slice(0, 3),
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
  // Знаменатель — измеримые тесты, а не все завершённые: тест со сломанным
  // замером не «неудачный», он просто ничего не сказал.
  const successRate = s && s.measured ? Math.round((s.worked / s.measured) * 100) : null;

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

      {covers.filter((c) => c.running).map((c) => (
        <CoverTestBlock key={c.key} c={c} />
      ))}

      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Тестов идёт" value={s.active} accent={s.active > 0}
                    hint={s.active ? "проверю сам по окончании окна" : "заведи в боте"} />
          <StatCard label="Завершено" value={s.done}
                    hint={s.done
                      ? `🟢 ${s.worked} · 🔴 ${s.failed} · 🟡 ${s.unclear}`
                      : s.retro ? `+ ${s.retro.total} перенесённых ниже` : undefined} />
          <StatCard label="Доля удачных" value={successRate === null ? "—" : `${successRate}%`}
                    hint={s.measured
                      ? `${s.worked} из ${s.measured}${s.unmeasurable ? ` · ${s.unmeasurable} не измерено` : ""}`
                      : s.done ? "эффект пока ни у одного не измерен" : "считается по живым тестам"} />
          <StatCard label="Эффект накоплен"
                    value={s.effect_total ? fmtShortRub(s.effect_total) : "—"}
                    accent={s.effect_total > 0}
                    hint={s.measured
                      ? `сумма по ${s.measured} тестам с измеримым эффектом`
                      : "появится после первых измеримых вердиктов"} />
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
                          {fmtShortRub(h.effect_rub ?? 0)}
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
                          {fmtShortRub(h.effect_rub ?? 0)}
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
                    {h.status !== "активна" && h.effect_rub === null && (
                      <div className="text-xs text-ink-muted">не измерен</div>
                    )}
                    {h.status !== "активна" && !!h.effect_rub && (
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
                       style={{ width: `${a.measured ? (a.worked / a.measured) * 100 : 0}%` }} />
                </div>
                <span className="w-12 shrink-0 text-right tabular-nums text-xs text-ink-muted"
                      title={a.measured < a.total ? `${a.total - a.measured} без измеримого эффекта` : undefined}>
                  {a.measured ? `${a.worked}/${a.measured}` : "—"}
                </span>
                <span className={clsx("w-20 shrink-0 text-right text-xs tabular-nums sm:w-24",
                  a.effect > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400")}>
                  {fmtShortRub(a.effect)}
                </span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Доля удачных и суммарный чистый эффект — по тестам, у которых эффект удалось измерить.
            Тесты со сломанным замером (нет товара, оборвалась реклама, база «до» рушилась) в счёт не идут.
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
                  <th className="pb-1.5 text-right font-medium">измерено</th>
                  <th className="pb-1.5 text-right font-medium">удачных</th>
                  <th className="pb-1.5 text-right font-medium">эффект</th>
                </tr>
              </thead>
              <tbody>
                {byProduct.map((p) => (
                  <tr key={p.product} className="border-t border-black/5 dark:border-white/5">
                    <td className="py-1.5 pr-2">{p.product}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.total}</td>
                    <td className="py-1.5 text-right tabular-nums text-ink-muted">{p.measured}</td>
                    <td className="py-1.5 text-right tabular-nums">{p.measured ? p.ok : "—"}</td>
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

      {open && (
        <Detail
          h={open}
          onClose={() => setOpen(null)}
          onDeleted={() => {
            setData((d) => (d ? { ...d, items: d.items.filter((x) => x.id !== open.id) } : d));
            api.hypotheses().then(setData).catch(() => {});
          }}
        />
      )}
    </div>
  );
}
