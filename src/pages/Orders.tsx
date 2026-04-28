import { useEffect, useState } from "react";
import { api, ApiError, type Order } from "../api";
import { OrdersTable } from "../components/OrdersTable";
import { OrdersSkeleton } from "../components/Skeleton";
import { hasApi } from "../env";

export function Orders() {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hasApi) {
      setError("VITE_API_BASE_URL не задан — данные API не подключены.");
      setOrders([]);
      return;
    }
    api
      .orders()
      .then((data) => {
        data.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
        setOrders(data);
      })
      .catch((e: unknown) => {
        if (e instanceof ApiError) setError(`API: ${e.message}`);
        else setError(String(e));
        setOrders([]);
      });
  }, []);

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1200px] animate-slide-up">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Заказы</h1>
        {orders && (
          <div className="text-[13px] text-ink-muted tabular-nums">
            {orders.length} {orders.length === 1 ? "заказ" : "заказов"}
          </div>
        )}
      </header>

      {error && (
        <div className="mb-4 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 animate-fade-in">
          {error}
        </div>
      )}

      {orders === null ? <OrdersSkeleton /> : <OrdersTable orders={orders} />}
    </div>
  );
}
