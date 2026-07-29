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
  Beaker, CalendarClock, Check, ChevronRight, Sparkles, TrendingUp, X,
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
function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso.slice(0, 10)
    : d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

/** Цвет по вердикту: смысл читается до текста. */
function verdictTone(v: string): string {
  if (v.includes("НЕ СРАБОТАЛО")) return "text-rose-600 dark:text-rose-400";
  if (v.includes("СРАБОТАЛО")) return "text-emerald-600 dark:text-emerald-400";
  if (v.includes("НЕОДНОЗНАЧНО")) return "text-amber-600 dark:text-amber-400";
  return "text-ink-muted";
}

function daysLeft(checkAt: string): string {
  if (!checkAt) return "";
  const d = new Date(checkAt);
  if (Number.isNaN(d.getTime())) return "";
  const diff = Math.ceil((d.getTime() - Date.now()) / 86_400_000);
  if (diff < 0) return "пора проверять";
  if (diff === 0) return "сегодня";
  return `через ${diff} дн.`;
}

const METRIC_ROWS: Array<{ key: keyof NonNullable<Hypothesis["metrics"]["before"]>; label: string; unit?: string }> = [
  { key: "revenue", label: "Выручка", unit: " ₽" },
  { key: "orders", label: "Заказы" },
  { key: "views", label: "Показы" },
  { key: "sessions", label: "В карточку" },
  { key: "carts", label: "Корзины" },
  { key: "ctr", label: "CTR", unit: " %" },
  { key: "drr", label: "ДРР", unit: " %" },
];

function Detail({ h, onClose }: { h: Hypothesis; onClose: () => void }) {
  const b = h.metrics?.before;
  const a = h.metrics?.after;
  return createPortal(
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="card max-h-[85vh] w-full max-w-2xl overflow-y-auto p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <div className="text-xs text-ink-muted">
              #{h.id} · {h.author} · {fmtDate(h.created_at)}
              {h.auto_detected && " · найдено автоматически"}
            </div>
            <h3 className="text-lg font-semibold">{h.product}</h3>
            <div className="text-sm text-ink-muted">{h.object}</div>
          </div>
          <button onClick={onClose} className="rounded-lg p-1 hover:bg-black/5 dark:hover:bg-white/10">
            <X className="h-5 w-5" />
          </button>
        </div>

        {h.comment && (
          <div className="mb-3 rounded-lg bg-black/[.03] px-3 py-2 text-sm italic dark:bg-white/[.06]">
            «{h.comment}»
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
          <span className={clsx("font-semibold", verdictTone(h.verdict))}>
            {h.verdict || "тест идёт"}
          </span>
          {h.status === "завершена" && h.effect_rub !== 0 && (
            <span className="tabular-nums font-medium">{fmtRub(h.effect_rub)}</span>
          )}
          {h.status === "активна" && (
            <span className="text-ink-muted">проверка {fmtDate(h.check_at)} — {daysLeft(h.check_at)}</span>
          )}
        </div>

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
                  const delta = bv && av ? ((av - bv) / bv) * 100 : null;
                  return (
                    <tr key={key} className="border-t border-black/5 dark:border-white/5">
                      <td className="py-1.5">{label}</td>
                      <td className="py-1.5 text-right">{bv === undefined ? "—" : fmtNum(bv) + (unit ?? "")}</td>
                      <td className="py-1.5 text-right">{av === undefined ? "—" : fmtNum(av) + (unit ?? "")}</td>
                      <td className={clsx("py-1.5 text-right",
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

        {h.verdict_text && (
          <div className="whitespace-pre-wrap rounded-lg bg-black/[.03] p-3 text-[13px] leading-relaxed dark:bg-white/[.06]">
            {h.verdict_text.replace(/<[^>]+>/g, "")}
          </div>
        )}
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
  const [tab, setTab] = useState<"active" | "done">("active");

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

  const active = useMemo(() => data?.items.filter((i) => i.status === "активна") ?? [], [data]);
  const done = useMemo(() => data?.items.filter((i) => i.status !== "активна") ?? [], [data]);
  const s = data?.stats;

  if (loading) return <StatCardsSkeleton />;
  if (err) return <div className="card p-4 text-sm text-rose-600">{err}</div>;

  const empty = !data?.items.length;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold">Гипотезы</h1>
        <p className="text-sm text-ink-muted">
          Что меняли на Ozon, что из этого вышло и сколько это стоило в деньгах.
        </p>
      </div>

      {s && (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <StatCard label="Тестов идёт" value={s.active} accent={s.active > 0} />
          <StatCard label="Завершено" value={s.done} hint={s.done ? `сработало ${s.worked}` : undefined} />
          <StatCard
            label="Сработало"
            value={s.done ? `${Math.round((s.worked / s.done) * 100)}%` : "—"}
            hint={s.done ? `${s.worked} из ${s.done}` : "пока нет данных"}
          />
          <StatCard
            label="Эффект накоплен"
            value={s.effect_total ? fmtRub(s.effect_total) : "—"}
            accent={s.effect_total > 0}
          />
        </div>
      )}

      {empty && (
        <div className="card p-6 text-center">
          <Beaker className="mx-auto mb-2 h-8 w-8 text-ink-muted" />
          <div className="font-medium">Пока ни одной гипотезы</div>
          <p className="mx-auto mt-1 max-w-md text-sm text-ink-muted">
            Тесты заводятся в Telegram-боте: «🧪 Новая гипотеза» или просто строкой —
            «запустила рк на KRB-DGR-S поиск и пир авто». Метрики до и после
            система снимет сама.
          </p>
        </div>
      )}

      {!empty && (
        <>
          <div className="flex gap-1 rounded-xl bg-black/[.04] p-1 dark:bg-white/[.06]">
            {([["active", `Идут (${active.length})`], ["done", `Завершённые (${done.length})`]] as const).map(
              ([k, label]) => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={clsx(
                    "flex-1 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
                    tab === k ? "bg-white shadow-sm dark:bg-neutral-800" : "text-ink-muted",
                  )}
                >
                  {label}
                </button>
              ),
            )}
          </div>

          <div className="space-y-2">
            {(tab === "active" ? active : done).map((h) => (
              <button
                key={h.id}
                onClick={() => setOpen(h)}
                className="card card-hover flex w-full items-center gap-3 p-3 text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-ink-muted">#{h.id}</span>
                    <span className="truncate font-medium">{h.product}</span>
                    {h.auto_detected && <Sparkles className="h-3.5 w-3.5 shrink-0 text-brand" />}
                  </div>
                  <div className="truncate text-sm text-ink-muted">{h.object}</div>
                  <div className="mt-0.5 flex items-center gap-2 text-xs text-ink-muted">
                    <CalendarClock className="h-3 w-3" />
                    {h.status === "активна"
                      ? `проверка ${fmtDate(h.check_at)} — ${daysLeft(h.check_at)}`
                      : `завершён ${fmtDate(h.closed_at)}`}
                    <span className="text-ink-muted/60">· {h.skus.length} SKU</span>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className={clsx("text-sm font-semibold", verdictTone(h.verdict))}>
                    {h.verdict ? h.verdict.split(" ")[0] : "🟡"}
                  </div>
                  {h.status !== "активна" && h.effect_rub !== 0 && (
                    <div className="text-xs tabular-nums text-ink-muted">{fmtRub(h.effect_rub)}</div>
                  )}
                </div>
                <ChevronRight className="h-4 w-4 shrink-0 text-ink-muted" />
              </button>
            ))}
          </div>
        </>
      )}

      {s && s.by_action.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-brand" />
            <h2 className="font-medium">Что срабатывало</h2>
          </div>
          <div className="space-y-2">
            {s.by_action.map((a) => (
              <div key={a.action} className="flex items-center gap-3 text-sm">
                <span className="w-40 shrink-0 truncate">{a.action}</span>
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-black/[.06] dark:bg-white/10">
                  <div
                    className="h-full rounded-full bg-brand"
                    style={{ width: `${a.total ? (a.worked / a.total) * 100 : 0}%` }}
                  />
                </div>
                <span className="w-16 shrink-0 text-right tabular-nums text-ink-muted">
                  {a.worked}/{a.total}
                </span>
                <span className="w-24 shrink-0 text-right tabular-nums">{fmtRub(a.effect)}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-muted">
            Доля тестов, признанных удачными, и суммарный эффект по каждому типу изменений.
          </p>
        </div>
      )}

      {data?.events && data.events.length > 0 && (
        <div className="card p-4">
          <div className="mb-3 flex items-center gap-2">
            <Check className="h-4 w-4 text-ink-muted" />
            <h2 className="font-medium">Правки карточек</h2>
          </div>
          <div className="max-h-64 space-y-1 overflow-y-auto text-sm">
            {data.events.map((e, i) => (
              <div key={i} className="flex items-center gap-2 border-b border-black/5 py-1 last:border-0 dark:border-white/5">
                <span className="w-14 shrink-0 text-xs text-ink-muted">{e.date.slice(5)}</span>
                <span className="w-40 shrink-0 truncate font-mono text-[11px]">{e.sku}</span>
                <span className="truncate text-ink-muted">{e.field}</span>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-muted">
            Система снимает состав карточек ежедневно. Эти правки учитываются как
            конкурирующие причины, если попадают в окно теста.
          </p>
        </div>
      )}

      {open && <Detail h={open} onClose={() => setOpen(null)} />}
    </div>
  );
}
