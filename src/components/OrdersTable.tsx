import { useState } from "react";
import { ChevronDown } from "lucide-react";
import clsx from "clsx";
import type { Order } from "../api";
import { StatusSelect } from "./StatusSelect";
import { OrderCard } from "./OrderCard";
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

export function OrdersTable({ orders: initialOrders }: { orders: Order[] }) {
  const [orders, setOrders] = useState(initialOrders);
  if (orders !== initialOrders && orders.length === 0) setOrders(initialOrders);

  // ID раскрытого заказа (десктоп и мобила работают синхронно).
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function updateStatus(orderId: string, newStatus: string) {
    setOrders((prev) =>
      prev.map((o) => (o.order_id === orderId ? { ...o, status: newStatus } : o)),
    );
  }

  function toggleExpand(id: string) {
    setExpandedId((cur) => (cur === id ? null : id));
  }

  if (orders.length === 0) {
    return (
      <div className="card p-10 text-center text-ink-muted animate-slide-up-fast">
        <div className="mx-auto mb-3 w-10 h-10 rounded-full bg-brand-tint flex items-center justify-center">
          <span className="text-brand-dark text-base">∅</span>
        </div>
        <div className="text-base font-medium text-ink tracking-tightish">Заказов пока нет</div>
        <div className="mt-1 text-[13px] max-w-xs mx-auto">
          Заказы появятся здесь сразу после оформления на сайте.
        </div>
      </div>
    );
  }
  return (
    <>
      {/* === Мобильная верстка: стек карточек === */}
      <div className="lg:hidden flex flex-col gap-2 animate-slide-up-fast">
        {orders.map((o) => (
          <OrderCard
            key={o.order_id}
            order={o}
            expanded={expandedId === o.order_id}
            onToggle={() => toggleExpand(o.order_id)}
            onStatusChange={updateStatus}
          />
        ))}
      </div>

      {/* === Десктопная верстка: таблица === */}
      <div className="hidden lg:block card overflow-hidden animate-slide-up-fast">
        <table className="w-full text-[13px]">
          <thead className="bg-surface-alt border-b border-line text-ink-muted">
            <tr>
              <Th />
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
            {orders.map((o) => {
              const expanded = expandedId === o.order_id;
              return (
                <tr key={o.order_id}>
                  <td colSpan={8} className="p-0">
                    <div
                      className={clsx(
                        "border-t border-line transition-colors cursor-pointer",
                        expanded ? "bg-surface-hover" : "hover:bg-surface-hover",
                      )}
                      onClick={() => toggleExpand(o.order_id)}
                    >
                      <table className="w-full text-[13px]">
                        <tbody>
                          <tr>
                            <Td className="w-8 text-center">
                              <ChevronDown
                                size={14}
                                className={clsx(
                                  "inline-block text-ink-soft transition-transform duration-200",
                                  expanded && "rotate-180 text-brand",
                                )}
                              />
                            </Td>
                            <Td>
                              <span className="font-mono text-[12px] text-ink-muted">{o.order_id}</span>
                            </Td>
                            <Td>{formatDate(o.created_at)}</Td>
                            <Td onClick={(e) => e.stopPropagation()}>
                              <StatusSelect
                                orderId={o.order_id}
                                current={o.status}
                                onChanged={(s) => updateStatus(o.order_id, s)}
                              />
                            </Td>
                            <Td>
                              <div className="truncate max-w-[180px] text-ink">
                                {o.customer_name || "—"}
                              </div>
                              {o.city && (
                                <div className="text-ink-subtle text-[11px]">{o.city}</div>
                              )}
                            </Td>
                            <Td>
                              <div className="truncate max-w-[200px] text-ink">
                                {o.delivery_method || "—"}
                              </div>
                              {(o.pickup_point || o.delivery_address) && (
                                <div className="text-ink-subtle text-[11px] truncate max-w-[200px]">
                                  {o.pickup_point || o.delivery_address}
                                </div>
                              )}
                            </Td>
                            <Td align="right" className="tabular-nums font-medium">
                              {formatRub(o.total)}
                            </Td>
                            <Td>
                              {o.track_number ? (
                                <span className="font-mono text-[11px] text-ink-muted">
                                  {o.track_number}
                                </span>
                              ) : (
                                <span className="text-ink-soft">—</span>
                              )}
                            </Td>
                          </tr>
                        </tbody>
                      </table>
                      {expanded && <OrderDetails order={o} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Th({
  children,
  align = "left",
}: {
  children?: React.ReactNode;
  align?: "left" | "right";
}) {
  return (
    <th
      className={clsx(
        "px-3 py-2 font-medium text-[10px] uppercase tracking-wider",
        align === "right" ? "text-right" : "text-left",
      )}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  align = "left",
  className = "",
  onClick,
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
}) {
  return (
    <td
      onClick={onClick}
      className={clsx(
        "px-3 py-2.5 align-top",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}
