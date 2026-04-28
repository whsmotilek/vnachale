import { useEffect, useState } from "react";
import { api, ApiError, type Order } from "../api";
import { OrdersTable } from "../components/OrdersTable";
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
    <div className="px-8 py-8 max-w-[1200px]">
      <header className="mb-6 flex items-baseline justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Заказы</h1>
        {orders && (
          <div className="text-[13px] text-ink-muted">
            {orders.length} {orders.length === 1 ? "заказ" : "заказов"}
          </div>
        )}
      </header>

      {error && (
        <div className="mb-4 text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-3">
          {error}
        </div>
      )}

      {orders === null ? (
        <div className="card p-8 text-center text-ink-muted">Загрузка…</div>
      ) : (
        <OrdersTable orders={orders} />
      )}
    </div>
  );
}
