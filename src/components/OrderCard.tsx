import type { Order } from "../api";
import { StatusSelect } from "./StatusSelect";

function formatRub(value: string | number): string {
  const n =
    typeof value === "string" ? Number(value.replace(/[^\d.,-]/g, "").replace(",", ".")) : value;
  if (!Number.isFinite(n)) return "—";
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n) + " ₽";
}

function formatDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

/** Компактная карточка заказа — для мобилы. На десктопе показываем таблицу. */
export function OrderCard({
  order,
  onStatusChange,
}: {
  order: Order;
  onStatusChange?: (orderId: string, newStatus: string) => void;
}) {
  return (
    <article className="card p-3.5 transition-shadow duration-200 hover:shadow-cardHover">
      <header className="flex items-start justify-between gap-3 mb-2">
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-ink-muted">{order.order_id}</div>
          <div className="text-[14px] text-ink font-medium truncate mt-0.5">
            {order.customer_name || "—"}
          </div>
        </div>
        <StatusSelect
          orderId={order.order_id}
          current={order.status}
          onChanged={(s) => onStatusChange?.(order.order_id, s)}
        />
      </header>

      {order.items && (
        <div className="text-[12px] text-ink-muted mb-2 line-clamp-2 leading-snug">
          {order.items}
        </div>
      )}

      <div className="flex items-baseline justify-between gap-2 mb-1.5">
        <div className="text-[15px] font-semibold tabular-nums tracking-tighter2 text-ink">
          {formatRub(order.total)}
        </div>
        <div className="text-[11px] text-ink-subtle tabular-nums">{formatDate(order.created_at)}</div>
      </div>

      <div className="flex items-center justify-between gap-2 text-[11px] text-ink-subtle pt-1.5 border-t border-line-soft">
        <span className="truncate">
          {order.delivery_method || "—"}
          {order.city && <span> · {order.city}</span>}
        </span>
        {order.track_number && (
          <span className="font-mono shrink-0 truncate max-w-[100px]">{order.track_number}</span>
        )}
      </div>
    </article>
  );
}
