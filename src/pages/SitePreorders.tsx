import { useEffect, useMemo, useState } from "react";
import { Clock, Search, X } from "lucide-react";
import { api, type Order, type PreorderOrder } from "../api";
import { OrdersTable } from "../components/OrdersTable";
import { OrdersSkeleton } from "../components/Skeleton";
import { hasApi } from "../env";

function normalizePhone(s: string): string {
  return (s || "").replace(/\D+/g, "");
}

function matchesQuery(o: PreorderOrder, q: string): boolean {
  const query = q.trim().toLowerCase();
  if (!query) return true;
  const digits = normalizePhone(query);
  if (digits.length >= 3 && normalizePhone(o.customer_phone).includes(digits)) {
    return true;
  }
  const hay = [
    o.order_id, o.customer_name, o.customer_email, o.items, o.preorder_items,
    o.delivery_method, o.pickup_point, o.delivery_address, o.city,
    o.customer_comment, o.track_number,
  ].filter(Boolean).join("   ").toLowerCase();
  return hay.includes(query);
}

type Kind = "all" | "full" | "mixed";

/**
 * «Сайт → Предзаказы» — оплаченные заказы, товар для которых ещё не приехал.
 *
 * Заказ попадает сюда, только пока он ОТКРЫТ (новый / подтверждён / в сборке).
 * Отгруженный предзаказом уже не считается: его собрали из реального наличия.
 * Без этого условия признак считался по сегодняшнему остатку и задним числом
 * красил давно доставленные заказы.
 *
 * В карточке показываем предзаказные позиции — то, чего ждём. Позиции, которые
 * можно отгрузить уже сейчас, живут на обычных страницах заказов.
 */
export function SitePreorders({ readOnly = false }: { readOnly?: boolean }) {
  const [orders, setOrders] = useState<PreorderOrder[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [kind, setKind] = useState<Kind>("all");

  useEffect(() => {
    if (!hasApi) {
      setError("Сервис временно недоступен.");
      setOrders([]);
      return;
    }
    api.preorders()
      .then((d) => setOrders(d.items))
      .catch(() => {
        setError("Не удалось загрузить предзаказы.");
        setOrders([]);
      });
  }, []);

  const byKind = useMemo(
    () => (orders ? orders.filter((o) => kind === "all" || o.kind === kind) : null),
    [orders, kind],
  );
  const filtered = useMemo(
    () => (byKind ? byKind.filter((o) => matchesQuery(o, q)) : null),
    [byKind, q],
  );

  function updateOrder(orderId: string, patch: Partial<Order>) {
    setOrders((prev) =>
      prev ? prev.map((o) => (o.order_id === orderId ? { ...o, ...patch } : o)) : prev,
    );
  }

  // В карточке показываем ровно то, чего ждём: состав заказа подменяем на
  // предзаказную часть, иначе у смешанного заказа склад видел бы и то, что
  // уже уехало первой посылкой.
  const forTable: Order[] = (filtered ?? []).map((o) => ({ ...o, items: o.preorder_items }));

  const counts = {
    all: orders?.length ?? 0,
    full: orders?.filter((o) => o.kind === "full").length ?? 0,
    mixed: orders?.filter((o) => o.kind === "mixed").length ?? 0,
  };
  const eta = orders?.find((o) => o.preorder_eta)?.preorder_eta ?? "";

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1200px] animate-slide-up">
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tighter2 text-ink flex items-center gap-2">
            <Clock size={18} className="text-amber-600 dark:text-amber-400" />
            Предзаказы
          </h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Оплачено, товар ещё не приехал{eta ? ` — ждём ${eta}` : ""}. Поставка
            придёт на фулфилмент, уведомлений складу по таким заказам нет.
            «Две отгрузки» — часть заказа уже уехала, здесь только остаток.
          </p>
        </div>
        {filtered && byKind && (
          <div className="text-[13px] text-ink-muted tabular-nums shrink-0">
            {filtered.length}
            {q && filtered.length !== byKind.length ? ` из ${byKind.length}` : ""}
            {filtered.length === 1 ? " заказ" : " заказов"}
          </div>
        )}
      </header>

      <div className="mb-4 flex flex-wrap gap-2 text-[13px]">
        {([["all", "все", counts.all], ["full", "целиком предзаказ", counts.full],
           ["mixed", "две отгрузки", counts.mixed]] as const).map(([k, label, n]) => (
          <button key={k} type="button" onClick={() => setKind(k)}
                  className={`rounded-full border px-3 py-1 transition-colors ${kind === k
                    ? "border-brand bg-brand-tint text-brand-dark dark:text-white"
                    : "border-line text-ink-muted hover:text-ink"}`}>
            {label} <span className="tabular-nums">{n}</span>
          </button>
        ))}
      </div>

      <div className="relative mb-4">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none" />
        <input
          type="text"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Поиск: имя, телефон, адрес, артикул…"
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
          <Clock size={28} className="mx-auto mb-3 text-amber-500/60" />
          <div className="text-base font-medium text-ink tracking-tightish">
            {q ? "Ничего не найдено" : "Предзаказов нет"}
          </div>
          <div className="mt-1 text-[13px]">
            {q
              ? <>Поиск «<span className="text-ink">{q}</span>» — нет совпадений.</>
              : <>Сюда попадают оплаченные заказы, товар для которых ещё в пути.</>
            }
          </div>
        </div>
      ) : (
        <OrdersTable orders={forTable} onUpdate={updateOrder} readOnly={readOnly} />
      )}
    </div>
  );
}
