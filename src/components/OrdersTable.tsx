import type { Order } from "../api";
import { StatusBadge } from "./StatusBadge";

function formatRub(value: string | number): string {
  const n = typeof value === "string" ? Number(value.replace(/[^\d.,-]/g, "").replace(",", ".")) : value;
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

export function OrdersTable({ orders }: { orders: Order[] }) {
  if (orders.length === 0) {
    return (
      <div className="card p-8 text-center text-ink-muted">
        <div className="text-base font-medium text-ink">Заказов пока нет</div>
        <div className="mt-1 text-[13px]">
          Когда подключим Tilda webhook, новые заказы будут появляться здесь автоматически.
        </div>
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <table className="w-full text-[13px]">
        <thead className="bg-surface-alt border-b border-line text-ink-muted">
          <tr>
            <Th>Заказ</Th>
            <Th>Создан</Th>
            <Th>Статус</Th>
            <Th>Клиент</Th>
            <Th>Доставка</Th>
            <Th align="right">Сумма</Th>
            <Th>Трек</Th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.order_id} className="border-t border-line hover:bg-surface-hover">
              <Td><span className="font-mono text-[12px]">{o.order_id}</span></Td>
              <Td>{formatDate(o.created_at)}</Td>
              <Td><StatusBadge status={o.status} /></Td>
              <Td>
                <div className="truncate max-w-[180px]">{o.customer_name || "—"}</div>
                {o.city && <div className="text-ink-subtle text-[11px]">{o.city}</div>}
              </Td>
              <Td>
                <div className="truncate max-w-[200px]">{o.delivery_method || "—"}</div>
                {(o.pickup_point || o.delivery_address) && (
                  <div className="text-ink-subtle text-[11px] truncate max-w-[200px]">
                    {o.pickup_point || o.delivery_address}
                  </div>
                )}
              </Td>
              <Td align="right" className="tabular-nums">{formatRub(o.total)}</Td>
              <Td>
                {o.track_number ? (
                  <span className="font-mono text-[11px]">{o.track_number}</span>
                ) : (
                  <span className="text-ink-subtle">—</span>
                )}
              </Td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 py-2 font-medium text-[11px] uppercase tracking-wide ${align === "right" ? "text-right" : "text-left"}`}>
      {children}
    </th>
  );
}

function Td({ children, align = "left", className = "" }: { children: React.ReactNode; align?: "left" | "right"; className?: string }) {
  return <td className={`px-3 py-2 align-top ${align === "right" ? "text-right" : ""} ${className}`}>{children}</td>;
}
