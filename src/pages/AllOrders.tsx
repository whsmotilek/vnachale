import { useEffect, useMemo, useState } from "react";
import { Columns3, Search, X } from "lucide-react";
import clsx from "clsx";
import { api, type Order, orderWarehouse } from "../api";
import { OrdersTable } from "../components/OrdersTable";
import { OrdersSkeleton } from "../components/Skeleton";
import { hasApi } from "../env";

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
    if (o.track_number && normalizePhone(o.track_number).includes(digits)) return true;
  }
  const hay = [
    o.order_id, o.customer_name, o.customer_email, o.items,
    o.delivery_method, o.pickup_point, o.delivery_address, o.city,
    o.customer_comment, o.track_number,
  ].filter(Boolean).join("   ").toLowerCase();
  return hay.includes(query);
}

type WhFilter = "all" | "our" | "ff";

// Группы статусов для сводки «состояние заказов» + быстрый фильтр по клику.
const STATUS_GROUPS: Array<{ key: string; label: string; set: string[]; dot: string }> = [
  { key: "new", label: "Новые", set: ["new"], dot: "bg-amber-400" },
  { key: "toship", label: "К отгрузке", set: ["confirmed", "in_pack"], dot: "bg-brand" },
  { key: "shipped", label: "Отгружено", set: ["shipped"], dot: "bg-emerald-400" },
  { key: "delivered", label: "Доставлено", set: ["delivered"], dot: "bg-emerald-600" },
  { key: "refunded", label: "Возврат", set: ["refunded"], dot: "bg-rose-400" },
  { key: "cancelled", label: "Отменён", set: ["cancelled"], dot: "bg-slate-400" },
];
const _STATUS_TO_GROUP: Record<string, string> = {};
for (const g of STATUS_GROUPS) for (const s of g.set) _STATUS_TO_GROUP[s] = g.key;
function statusGroup(o: Order): string {
  return _STATUS_TO_GROUP[(o.status || "").toLowerCase().trim()] ?? "";
}

/**
 * Общая страница «Заказы» (owner + менеджер заказов): все заказы обоих складов
 * в одном списке с бейджем + меткой склада, сводка по статусам («на что обратить
 * внимание») и быстрый фильтр. Статусы меняются прямо в списке.
 */
export function AllOrders({ onOpenKanban }: { onOpenKanban?: () => void }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [whFilter, setWhFilter] = useState<WhFilter>("all");
  const [statusFilter, setStatusFilter] = useState<string | null>(null);

  useEffect(() => {
    if (!hasApi) {
      setError("Сервис временно недоступен.");
      setOrders([]);
      return;
    }
    api
      .orders()
      .then((data) => {
        data.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setOrders(data);
      })
      .catch(() => {
        setError("Не удалось загрузить заказы.");
        setOrders([]);
      });
  }, []);

  // Счётчики по складам (по всем заказам, до текстового поиска)
  const counts = useMemo(() => {
    if (!orders) return { all: 0, our: 0, ff: 0 };
    let our = 0, ff = 0;
    for (const o of orders) {
      if (orderWarehouse(o.items) === "ff") ff++;
      else our++;
    }
    return { all: orders.length, our, ff };
  }, [orders]);

  // Заказы выбранного склада (до статус-фильтра и поиска) — база для сводки.
  const whFiltered = useMemo(
    () => (orders ? orders.filter((o) => whFilter === "all" || orderWarehouse(o.items) === whFilter) : null),
    [orders, whFilter],
  );

  // Счётчики по группам статусов в рамках выбранного склада.
  const statusCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const g of STATUS_GROUPS) m[g.key] = 0;
    for (const o of whFiltered ?? []) {
      const gk = statusGroup(o);
      if (gk) m[gk] += 1;
    }
    return m;
  }, [whFiltered]);

  const filtered = useMemo(() => {
    if (!whFiltered) return null;
    return whFiltered
      .filter((o) => !statusFilter || statusGroup(o) === statusFilter)
      .filter((o) => matchesQuery(o, q));
  }, [whFiltered, statusFilter, q]);

  function updateOrder(orderId: string, patch: Partial<Order>) {
    setOrders((prev) =>
      prev ? prev.map((o) => (o.order_id === orderId ? { ...o, ...patch } : o)) : prev,
    );
  }

  const PILLS: Array<{ key: WhFilter; label: string; count: number }> = [
    { key: "all", label: "Все", count: counts.all },
    { key: "our", label: "Склад", count: counts.our },
    { key: "ff", label: "ФФ", count: counts.ff },
  ];

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1200px] animate-slide-up">
      <header className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Заказы</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Все заказы обоих складов. <span className="text-brand-dark dark:text-white font-medium">Склад</span> — наш (Tani),{" "}
            <span className="text-amber-700 dark:text-amber-300 font-medium">ФФ</span> — фулфилмент (Татьяна).
          </p>
        </div>
        {onOpenKanban && (
          <button
            type="button"
            onClick={onOpenKanban}
            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-[13px] font-medium bg-brand text-white hover:bg-brand-hover transition-colors shadow-card"
          >
            <Columns3 size={15} />
            Канбан
          </button>
        )}
      </header>

      {/* Фильтр по складу */}
      <div className="flex flex-wrap gap-1.5 items-center mb-3">
        {PILLS.map(({ key, label, count }) => (
          <button
            key={key}
            type="button"
            onClick={() => setWhFilter(key)}
            className={clsx(
              "px-3 py-1.5 text-[12px] rounded-md border transition-colors inline-flex items-center gap-1.5",
              whFilter === key
                ? "bg-brand text-white border-brand"
                : "bg-surface border-line text-ink-muted hover:bg-surface-hover hover:text-ink",
            )}
          >
            {label}
            <span className={clsx("tabular-nums", whFilter === key ? "text-white/80" : "text-ink-subtle")}>
              {count}
            </span>
          </button>
        ))}
      </div>

      {/* Состояние заказов — на что обратить внимание. Клик по статусу фильтрует список. */}
      {orders && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1.5 items-center">
            <span className="text-[11px] uppercase tracking-wide text-ink-subtle font-medium mr-1">Состояние</span>
            <button
              type="button"
              onClick={() => setStatusFilter(null)}
              className={clsx(
                "px-2.5 py-1 text-[12px] rounded-md border transition-colors",
                statusFilter === null
                  ? "bg-ink text-surface border-ink"
                  : "bg-surface border-line text-ink-muted hover:bg-surface-hover hover:text-ink",
              )}
            >
              Все
            </button>
            {STATUS_GROUPS.map((g) => (
              <button
                key={g.key}
                type="button"
                onClick={() => setStatusFilter(statusFilter === g.key ? null : g.key)}
                className={clsx(
                  "px-2.5 py-1 text-[12px] rounded-md border inline-flex items-center gap-1.5 transition-colors",
                  statusFilter === g.key
                    ? "bg-surface-hover border-line-strong text-ink font-medium"
                    : "bg-surface border-line text-ink-muted hover:bg-surface-hover hover:text-ink",
                )}
              >
                <span className={clsx("w-1.5 h-1.5 rounded-full shrink-0", g.dot)} />
                {g.label}
                <span className="tabular-nums text-ink-subtle">{statusCounts[g.key] ?? 0}</span>
              </button>
            ))}
          </div>
          {statusCounts.toship > 0 && (
            <div className="mt-2 text-[12px] text-brand-dark dark:text-white">
              ⚠️ <b className="tabular-nums">{statusCounts.toship}</b> оплачено и ждёт отгрузки
              {statusCounts.new > 0 && <span className="text-ink-muted"> · новых {statusCounts.new}</span>}
              {statusCounts.refunded > 0 && <span className="text-ink-muted"> · возвратов {statusCounts.refunded}</span>}
            </div>
          )}
        </div>
      )}

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск: имя, телефон, адрес, № заказа, товар…"
          className="w-full pl-9 pr-9 py-2 rounded-lg border border-line bg-surface text-[14px] text-ink placeholder:text-ink-soft focus:outline-none focus:border-brand transition-colors"
        />
        {q && (
          <button onClick={() => setQ("")} type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-ink-muted hover:text-ink hover:bg-surface-hover">
            <X size={14} />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 text-[13px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          {error}
        </div>
      )}

      {filtered === null ? (
        <OrdersSkeleton />
      ) : (
        <OrdersTable orders={filtered} onUpdate={updateOrder} showWarehouseTag />
      )}
    </div>
  );
}
