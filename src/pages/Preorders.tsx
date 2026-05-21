import { useEffect, useMemo, useState } from "react";
import { Search, X, Sparkles } from "lucide-react";
import { api, type Order, orderHasPreorder, parseOrderItems } from "../api";
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

/**
 * Показывает только заказы с предзаказными позициями (SKU начинается с PRE-).
 * Items внутри каждого заказа фильтруются — видны только предзаказные позиции,
 * остальные скрываются (это видно в OrderDetails через preorderOnly режим).
 *
 * Для этого передаём на OrdersTable модифицированный список заказов: items
 * заменяем на строку только из preorder-позиций, total — сумма preorder-частей.
 */
export function Preorders({ readOnly = false }: { readOnly?: boolean }) {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!hasApi) {
      setError("Сервис временно недоступен.");
      setOrders([]);
      return;
    }
    api.orders()
      .then((data) => {
        data.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setOrders(data);
      })
      .catch(() => {
        setError("Не удалось загрузить заказы.");
        setOrders([]);
      });
  }, []);

  // Фильтр: только заказы с PRE-* позициями
  const preorderOrders = useMemo(() => {
    if (!orders) return null;
    return orders
      .filter((o) => orderHasPreorder(o.items))
      .map((o) => {
        // Заменяем items на строку только из preorder-позиций
        const items = parseOrderItems(o.items);
        const preItems = items.filter((it) => it.isPreorder);
        const preItemsStr = preItems.map((it) => it.raw).join("; ");
        const preTotal = preItems.reduce((s, it) => s + (it.total || 0), 0);
        return {
          ...o,
          items: preItemsStr,
          total: String(preTotal),
        };
      });
  }, [orders]);

  const filtered = useMemo(
    () => (preorderOrders ? preorderOrders.filter((o) => matchesQuery(o, q)) : null),
    [preorderOrders, q],
  );

  function updateOrder(orderId: string, patch: Partial<Order>) {
    setOrders((prev) =>
      prev ? prev.map((o) => (o.order_id === orderId ? { ...o, ...patch } : o)) : prev,
    );
  }

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1200px] animate-slide-up">
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tighter2 text-ink flex items-center gap-2">
            <Sparkles size={18} className="text-amber-600 dark:text-amber-400" />
            Предзаказы
          </h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Заказы с позициями, артикул которых начинается с <code className="text-[11px] bg-surface-alt px-1 rounded">PRE-</code>.
            Показаны только предзаказные позиции — обычные товары в заказе не отображаются.
            Отгружать можно <b>после прибытия товара</b>.
          </p>
        </div>
        {filtered && preorderOrders && (
          <div className="text-[13px] text-ink-muted tabular-nums shrink-0">
            {filtered.length}
            {q && filtered.length !== preorderOrders.length ? ` из ${preorderOrders.length}` : ""}
            {filtered.length === 1 ? " заказ" : " заказов"}
          </div>
        )}
      </header>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск: имя, телефон, адрес, артикул PRE-…"
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
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-ink-muted">
          <Sparkles size={28} className="mx-auto mb-3 text-amber-500/60" />
          <div className="text-base font-medium text-ink tracking-tightish">
            {q ? "Ничего не найдено" : "Предзаказов пока нет"}
          </div>
          <div className="mt-1 text-[13px]">
            {q
              ? <>Поиск «<span className="text-ink">{q}</span>» — нет совпадений.</>
              : <>Заказ становится «предзаказом», если в нём есть артикул вида <code className="text-[11px] bg-surface-alt px-1 rounded">PRE-MSK-BLK-L</code>.</>
            }
          </div>
        </div>
      ) : (
        <OrdersTable orders={filtered} onUpdate={updateOrder} readOnly={readOnly} />
      )}
    </div>
  );
}
