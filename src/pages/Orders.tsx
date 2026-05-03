import { useEffect, useMemo, useState } from "react";
import { Search, X } from "lucide-react";
import { api, ApiError, type Order } from "../api";
import { OrdersTable } from "../components/OrdersTable";
import { OrdersSkeleton } from "../components/Skeleton";
import { hasApi } from "../env";

/** Нормализация телефона для поиска: оставляем только цифры. */
function normalizePhone(s: string): string {
  return (s || "").replace(/\D+/g, "");
}

/** Ищем подстроку (case-insensitive) во ВСЕХ значимых полях заказа. */
function matchesQuery(o: Order, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;

  // Если запрос состоит только из цифр (или почти) — пробуем как телефон/order_id
  const digitsQuery = normalizePhone(query);
  if (digitsQuery && digitsQuery.length >= 3) {
    const digitsPhone = normalizePhone(o.customer_phone);
    if (digitsPhone.includes(digitsQuery)) return true;
    if (o.order_id.includes(digitsQuery)) return true;
    if (o.track_number && normalizePhone(o.track_number).includes(digitsQuery)) return true;
  }

  // Полнотекстовый поиск по строковым полям
  const haystack = [
    o.order_id,
    o.customer_name,
    o.customer_email,
    o.items,
    o.delivery_method,
    o.pickup_point,
    o.delivery_address,
    o.city,
    o.customer_comment,
    o.track_number,
  ]
    .filter(Boolean)
    .join("   ")
    .toLowerCase();

  return haystack.includes(query);
}

export function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");

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
        setError("Не удалось загрузить заказы. Попробуйте обновить страницу.");
        setOrders([]);
      });
  }, []);

  const filtered = useMemo(
    () => (orders ? orders.filter((o) => matchesQuery(o, q)) : null),
    [orders, q],
  );

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1200px] animate-slide-up">
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Заказы</h1>
        {filtered && (
          <div className="text-[13px] text-ink-muted tabular-nums">
            {filtered.length}
            {q && orders ? ` из ${orders.length}` : ""}
            {(filtered.length === 1 ? " заказ" : " заказов")}
          </div>
        )}
      </header>

      {/* Поиск */}
      <div className="relative mb-4">
        <Search
          size={15}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none"
        />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск: имя, телефон, адрес, № заказа, товар…"
          className="w-full pl-9 pr-9 py-2 rounded-lg border border-line bg-surface text-[14px] text-ink placeholder:text-ink-soft focus:outline-none focus:border-brand transition-colors"
        />
        {q && (
          <button
            onClick={() => setQ("")}
            type="button"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-ink-muted hover:text-ink hover:bg-surface-hover transition-colors"
            aria-label="Очистить"
            title="Очистить"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {error && (
        <div className="mb-4 text-[13px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3 animate-fade-in">
          {error}
        </div>
      )}

      {filtered === null ? (
        <OrdersSkeleton />
      ) : filtered.length === 0 && q ? (
        <div className="card p-10 text-center text-ink-muted animate-fade-in">
          <div className="text-base font-medium text-ink tracking-tightish">Ничего не найдено</div>
          <div className="mt-1 text-[13px]">
            Поиск «<span className="text-ink">{q}</span>» — нет совпадений.
          </div>
        </div>
      ) : (
        <OrdersTable orders={filtered} />
      )}
    </div>
  );
}
