import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowLeft, GripVertical, Search, X } from "lucide-react";
import clsx from "clsx";
import { api, type Order, orderWarehouse } from "../api";
import { ItemsList } from "../components/ItemsList";
import { WarehouseBadge } from "../components/OrdersTable";
import { OrdersSkeleton } from "../components/Skeleton";
import { hasApi } from "../env";

/** Колонки канбана = статусы заказа, в логическом порядке движения слева-направо. */
const COLUMNS: Array<{ key: string; label: string; dot: string; bar: string }> = [
  { key: "new", label: "Новый", dot: "bg-amber-400", bar: "bg-amber-400" },
  { key: "confirmed", label: "В обработке", dot: "bg-brand", bar: "bg-brand" },
  { key: "in_pack", label: "Направлено на склад", dot: "bg-violet-400", bar: "bg-violet-400" },
  { key: "shipped", label: "Отгружено", dot: "bg-emerald-400", bar: "bg-emerald-400" },
  { key: "delivered", label: "Доставлено", dot: "bg-emerald-600", bar: "bg-emerald-600" },
  { key: "refunded", label: "Возврат", dot: "bg-rose-400", bar: "bg-rose-400" },
  { key: "cancelled", label: "Отменён", dot: "bg-slate-400", bar: "bg-slate-400" },
];

const LABEL: Record<string, string> = Object.fromEntries(COLUMNS.map((c) => [c.key, c.label]));

// Для каких статусов есть email-шаблон → показываем галочку «Уведомить клиента».
const STATUSES_WITH_EMAIL = new Set(["confirmed", "in_pack", "shipped", "delivered", "cancelled", "refunded"]);

type WhFilter = "all" | "our" | "ff";

function num(v: string | number): number {
  const n = typeof v === "string" ? Number(v.replace(/[^\d.,-]/g, "").replace(",", ".")) : v;
  return Number.isFinite(n) ? n : 0;
}
function formatRub(v: string | number): string {
  const n = num(v);
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";
}
function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
  }).format(d);
}
function normalizePhone(s: string): string {
  return (s || "").replace(/\D+/g, "");
}
function matchesQuery(o: Order, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const digits = normalizePhone(query);
  if (digits && digits.length >= 3) {
    if (normalizePhone(o.customer_phone).includes(digits)) return true;
    if (o.order_id.includes(digits)) return true;
  }
  const hay = [o.order_id, o.customer_name, o.customer_email, o.items, o.delivery_method, o.city, o.track_number]
    .filter(Boolean).join("   ").toLowerCase();
  return hay.includes(query);
}

/**
 * Канбан-доска заказов сайта: колонки = статусы, карточки перетаскиваются
 * мышью между колонками. Дроп открывает подтверждение смены статуса — та же
 * операция и та же склад-логика, что и в списке (StatusSelect), поэтому склад
 * двигается корректно. Данные и их набор не меняются — только представление.
 */
export function Kanban({ onBack }: { onBack: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [whFilter, setWhFilter] = useState<WhFilter>("all");

  const [dragId, setDragId] = useState<string | null>(null);
  const [overCol, setOverCol] = useState<string | null>(null);
  const [move, setMove] = useState<{ order: Order; to: string } | null>(null);

  useEffect(() => {
    if (!hasApi) { setError("Сервис временно недоступен."); setOrders([]); return; }
    api.orders()
      .then((data) => {
        data.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setOrders(data);
      })
      .catch(() => { setError("Не удалось загрузить заказы."); setOrders([]); });
  }, []);

  const counts = useMemo(() => {
    if (!orders) return { all: 0, our: 0, ff: 0 };
    let our = 0, ff = 0;
    for (const o of orders) (orderWarehouse(o.items) === "ff" ? (ff++) : (our++));
    return { all: orders.length, our, ff };
  }, [orders]);

  const filtered = useMemo(() => {
    if (!orders) return null;
    return orders
      .filter((o) => whFilter === "all" || orderWarehouse(o.items) === whFilter)
      .filter((o) => matchesQuery(o, q));
  }, [orders, whFilter, q]);

  // Раскладываем по колонкам; неизвестные статусы кидаем в «Новый», чтобы не терялись.
  const byStatus = useMemo(() => {
    const m: Record<string, Order[]> = {};
    for (const c of COLUMNS) m[c.key] = [];
    if (filtered) {
      for (const o of filtered) {
        const key = (o.status || "").toLowerCase().trim();
        (m[key] ?? m["new"]).push(o);
      }
    }
    return m;
  }, [filtered]);

  function applyMove(orderId: string, to: string) {
    setOrders((prev) => (prev ? prev.map((o) => (o.order_id === orderId ? { ...o, status: to } : o)) : prev));
  }

  function onDrop(e: React.DragEvent, colKey: string) {
    const id = e.dataTransfer.getData("text/plain") || dragId;
    setDragId(null);
    setOverCol(null);
    if (!id || !orders) return;
    const o = orders.find((x) => x.order_id === id);
    if (!o) return;
    if ((o.status || "").toLowerCase().trim() === colKey) return; // тот же статус — ничего
    setMove({ order: o, to: colKey });
  }

  const PILLS: Array<{ key: WhFilter; label: string; count: number }> = [
    { key: "all", label: "Все", count: counts.all },
    { key: "our", label: "Склад", count: counts.our },
    { key: "ff", label: "ФФ", count: counts.ff },
  ];

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-7 animate-slide-up">
      {/* Шапка */}
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="shrink-0 inline-flex items-center gap-1 text-[13px] text-ink-muted hover:text-ink border border-line rounded-md px-2.5 py-1.5 hover:bg-surface-hover transition-colors"
          >
            <ArrowLeft size={15} /> Заказы
          </button>
          <div className="min-w-0">
            <h1 className="text-2xl font-semibold tracking-tighter2 text-ink leading-none">Канбан</h1>
            <p className="mt-1 text-[12px] text-ink-muted">
              Заказы сайта по статусам · перетащите карточку в другую колонку, чтобы сменить статус
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Фильтр по складу */}
          <div className="flex gap-1.5">
            {PILLS.map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => setWhFilter(key)}
                className={clsx(
                  "px-2.5 py-1.5 text-[12px] rounded-md border transition-colors inline-flex items-center gap-1.5",
                  whFilter === key
                    ? "bg-brand text-white border-brand"
                    : "bg-surface border-line text-ink-muted hover:bg-surface-hover hover:text-ink",
                )}
              >
                {label}
                <span className={clsx("tabular-nums", whFilter === key ? "text-white/80" : "text-ink-subtle")}>{count}</span>
              </button>
            ))}
          </div>
          {/* Поиск */}
          <div className="relative">
            <Search size={15} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск…"
              className="w-40 sm:w-56 pl-8 pr-8 py-1.5 rounded-md border border-line bg-surface text-[13px] text-ink placeholder:text-ink-soft focus:outline-none focus:border-brand transition-colors"
            />
            {q && (
              <button onClick={() => setQ("")} type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-ink-muted hover:text-ink">
                <X size={13} />
              </button>
            )}
          </div>
        </div>
      </header>

      {error && (
        <div className="mb-4 text-[13px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          {error}
        </div>
      )}

      {filtered === null ? (
        <OrdersSkeleton />
      ) : (
        <div className="flex gap-3 overflow-x-auto pb-3">
          {COLUMNS.map((col) => {
            const list = byStatus[col.key] ?? [];
            const sum = list.reduce((s, o) => s + num(o.total), 0);
            const isOver = overCol === col.key && dragId !== null;
            return (
              <section
                key={col.key}
                onDragOver={(e) => { e.preventDefault(); setOverCol(col.key); }}
                onDragEnter={(e) => { e.preventDefault(); setOverCol(col.key); }}
                onDrop={(e) => onDrop(e, col.key)}
                className={clsx(
                  "shrink-0 w-[286px] rounded-xl border bg-surface-alt/70 flex flex-col transition-all duration-150",
                  isOver ? "border-brand/60 ring-2 ring-brand/30 bg-brand-tint/40" : "border-line",
                )}
              >
                {/* Верхняя цветная полоска-акцент статуса */}
                <div className={clsx("h-1 rounded-t-xl", col.bar)} />
                <header className="px-3 pt-2.5 pb-2 flex items-center gap-2">
                  <span className={clsx("w-2 h-2 rounded-full shrink-0", col.dot)} />
                  <span className="text-[12.5px] font-semibold text-ink truncate">{col.label}</span>
                  <span className="ml-auto shrink-0 text-[11px] tabular-nums text-ink-muted bg-surface border border-line rounded-full px-1.5 py-0.5">
                    {list.length}
                  </span>
                </header>
                {list.length > 0 && (
                  <div className="px-3 -mt-1 mb-1 text-[11px] text-ink-subtle tabular-nums">{formatRub(sum)}</div>
                )}

                <div className="px-2 pb-2 flex flex-col gap-2 overflow-y-auto min-h-[120px]" style={{ maxHeight: "68vh" }}>
                  {list.length === 0 ? (
                    <div className="flex-1 min-h-[80px] flex items-center justify-center text-[11px] text-ink-soft select-none">
                      {isOver ? "Отпустите здесь" : "Пусто"}
                    </div>
                  ) : (
                    list.map((o) => (
                      <KanbanCard
                        key={o.order_id}
                        order={o}
                        dragging={dragId === o.order_id}
                        onDragStart={() => setDragId(o.order_id)}
                        onDragEnd={() => { setDragId(null); setOverCol(null); }}
                      />
                    ))
                  )}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {move &&
        createPortal(
          <MoveConfirm
            order={move.order}
            to={move.to}
            onDone={(newStatus) => { applyMove(move.order.order_id, newStatus); setMove(null); }}
            onCancel={() => setMove(null)}
          />,
          document.body,
        )}
    </div>
  );
}

function KanbanCard({
  order, dragging, onDragStart, onDragEnd,
}: {
  order: Order;
  dragging: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
}) {
  const isFf = orderWarehouse(order.items) === "ff";
  return (
    <article
      draggable
      onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", order.order_id); onDragStart(); }}
      onDragEnd={onDragEnd}
      className={clsx(
        "group card p-2.5 cursor-grab active:cursor-grabbing select-none border-l-2",
        "hover:shadow-cardHover hover:-translate-y-px transition-all duration-150",
        isFf ? "border-l-amber-400 dark:border-l-amber-500" : "border-l-brand/60",
        dragging && "opacity-40 rotate-[1deg]",
      )}
    >
      <header className="flex items-center gap-1.5 mb-1">
        <GripVertical size={13} className="shrink-0 text-ink-soft group-hover:text-ink-subtle -ml-0.5" />
        <span className="font-mono text-[10.5px] text-ink-muted">{order.order_id}</span>
        <WarehouseBadge items={order.items} />
        <span className="ml-auto text-[13px] font-semibold tabular-nums tracking-tighter2 text-ink">
          {formatRub(order.total)}
        </span>
      </header>

      <div className="text-[13px] text-ink font-medium truncate mb-1">{order.customer_name || "—"}</div>

      {order.items && (
        <div className="mb-1.5">
          <ItemsList items={order.items} compact />
        </div>
      )}

      <div className="flex items-center justify-between gap-2 text-[10.5px] text-ink-subtle pt-1.5 border-t border-line-soft">
        <span className="truncate flex-1">
          {order.delivery_method || "—"}
          {order.city && <span> · {order.city}</span>}
        </span>
        <span className="shrink-0 tabular-nums">{formatDate(order.created_at)}</span>
      </div>
      {order.track_number && (
        <div className="mt-1 font-mono text-[10px] text-ink-soft truncate">{order.track_number}</div>
      )}
    </article>
  );
}

/** Модалка подтверждения перемещения (смены статуса) — зеркалит StatusSelect. */
function MoveConfirm({
  order, to, onDone, onCancel,
}: {
  order: Order;
  to: string;
  onDone: (newStatus: string) => void;
  onCancel: () => void;
}) {
  const [notify, setNotify] = useState(false);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const fromLabel = LABEL[(order.status || "").toLowerCase().trim()] ?? order.status ?? "—";
  const toLabel = LABEL[to] ?? to;
  const showNotify = STATUSES_WITH_EMAIL.has(to);

  async function confirm() {
    setBusy(true);
    setErr(null);
    try {
      await api.updateOrderStatus(order.order_id, to, notify && showNotify);
      onDone(to);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
      if (e.key === "Enter" && !busy) confirm();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [busy, notify]);

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center px-4 animate-fade-in" onClick={busy ? undefined : onCancel}>
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div className="relative w-full max-w-sm card p-5 animate-scale-in" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-base font-semibold tracking-tightish">Сменить статус заказа?</h2>
        <p className="mt-2 text-[13px] text-ink-muted">
          Заказ <code className="font-mono text-ink">{order.order_id}</code>:
        </p>
        <div className="mt-3 flex items-center gap-2 text-[13px]">
          <span className="px-2 py-0.5 rounded border border-line bg-surface-alt text-ink-muted">{fromLabel}</span>
          <span className="text-ink-subtle">→</span>
          <span className="px-2 py-0.5 rounded border border-brand bg-brand-tint text-brand-dark dark:text-white font-medium">{toLabel}</span>
        </div>

        {showNotify && (
          <label className="mt-4 flex items-start gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={notify} onChange={(e) => setNotify(e.target.checked)} disabled={busy}
              className="mt-0.5 h-4 w-4 rounded border-line text-brand focus:ring-brand cursor-pointer" />
            <span className="text-[13px] text-ink leading-snug">
              📧 Уведомить клиента по email
              <span className="block text-[11px] text-ink-subtle mt-0.5">
                Отправит письмо на email из заказа. По умолчанию выключено.
              </span>
            </span>
          </label>
        )}

        {err && (
          <div className="mt-3 text-[12px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded p-2">
            {err}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-3 py-1.5 text-[13px] rounded-md border border-line text-ink hover:bg-surface-hover transition-colors disabled:opacity-50">
            Отмена
          </button>
          <button type="button" onClick={confirm} disabled={busy}
            className="px-3 py-1.5 text-[13px] rounded-md bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 font-medium">
            {busy ? "Сохраняем…" : "Подтвердить"}
          </button>
        </div>
      </div>
    </div>
  );
}
