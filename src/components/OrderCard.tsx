import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import type { Order } from "../api";
import { StatusSelect } from "./StatusSelect";
import { OrderDetails } from "./OrderDetails";

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

export function OrderCard({
  order,
  expanded,
  onToggle,
  onUpdate,
}: {
  order: Order;
  expanded: boolean;
  onToggle: () => void;
  onUpdate?: (patch: Partial<Order>) => void;
}) {
  return (
    <article
      onClick={onToggle}
      className={clsx(
        "card overflow-hidden transition-shadow duration-200 cursor-pointer",
        "hover:shadow-cardHover",
      )}
    >
      <div className="p-3.5">
        <header className="flex items-start justify-between gap-3 mb-2">
          <div className="min-w-0">
            <div className="font-mono text-[11px] text-ink-muted">{order.order_id}</div>
            <div className="text-[14px] text-ink font-medium truncate mt-0.5">
              {order.customer_name || "—"}
            </div>
          </div>
          <div onClick={(e) => e.stopPropagation()}>
            <StatusSelect
              orderId={order.order_id}
              current={order.status}
              onChanged={(s) => onUpdate?.({ status: s })}
            />
          </div>
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
          <div className="text-[11px] text-ink-subtle tabular-nums">
            {formatDate(order.created_at)}
          </div>
        </div>

        <div className="flex items-center justify-between gap-2 text-[11px] text-ink-subtle pt-1.5 border-t border-line-soft">
          <span className="truncate flex-1">
            {order.delivery_method || "—"}
            {order.city && <span> · {order.city}</span>}
          </span>
          {order.track_number && (
            <span className="font-mono shrink-0 truncate max-w-[100px]">{order.track_number}</span>
          )}
          <ChevronDown
            size={14}
            className={clsx(
              "shrink-0 transition-transform duration-200",
              expanded ? "rotate-180 text-brand" : "text-ink-soft",
            )}
          />
        </div>
      </div>

      {expanded && <OrderDetails order={order} onUpdate={onUpdate} />}
    </article>
  );
}
