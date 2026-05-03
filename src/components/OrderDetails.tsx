import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Copy, Pencil } from "lucide-react";
import { api, type Order } from "../api";
import { useCopy } from "../hooks/useCopy";

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
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
}

const PAYMENT_LABELS: Record<string, string> = {
  paid: "Оплачен",
  pending: "Ожидает оплаты",
  refunded: "Возврат",
};
const DELIVERY_LABELS: Record<string, string> = {
  ozon_pvz: "Ozon ПВЗ",
  yandex_pvz: "Яндекс ПВЗ",
  yandex_courier: "Яндекс курьер",
  sdek_pvz: "СДЭК ПВЗ",
  sdek_courier: "СДЭК курьер",
  "5post_pvz": "5Post",
  post_russia: "Почта России",
  self_pickup: "Самовывоз",
};

export function OrderDetails({
  order,
  onUpdate,
}: {
  order: Order;
  onUpdate?: (patch: Partial<Order>) => void;
}) {
  const { copiedKey, copy } = useCopy();

  function CopyValue({
    fieldKey,
    text,
    display,
    mono,
    multiline,
  }: {
    fieldKey: string;
    text: string;
    display?: string;
    mono?: boolean;
    multiline?: boolean;
  }) {
    if (!text) return <span className="text-ink-soft text-[13px]">—</span>;
    const isCopied = copiedKey === `${order.order_id}:${fieldKey}`;
    return (
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          copy(text, `${order.order_id}:${fieldKey}`);
        }}
        title="Кликните чтобы скопировать"
        className={clsx(
          "group inline-flex items-start gap-1.5 text-left rounded px-1.5 -ml-1.5 py-0.5",
          "transition-colors hover:bg-surface-hover focus:bg-surface-hover focus:outline-none",
          mono && "font-mono",
          "text-[13px]",
        )}
      >
        <span className={clsx("text-ink", multiline && "whitespace-pre-line break-words")}>
          {display ?? text}
        </span>
        <span
          className={clsx(
            "shrink-0 mt-0.5 transition-opacity",
            isCopied
              ? "opacity-100 text-emerald-600 dark:text-emerald-400"
              : "opacity-0 group-hover:opacity-50 text-ink-soft",
          )}
        >
          {isCopied ? <Check size={12} /> : <Copy size={11} />}
        </span>
        {isCopied && (
          <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium tracking-tightish">
            Скопировано
          </span>
        )}
      </button>
    );
  }

  function Row({
    label,
    children,
    full,
  }: {
    label: string;
    children: React.ReactNode;
    full?: boolean;
  }) {
    return (
      <div className={clsx("flex flex-col gap-0.5", full && "sm:col-span-2")}>
        <div className="text-[10px] uppercase tracking-wider text-ink-muted font-medium">
          {label}
        </div>
        <div>{children}</div>
      </div>
    );
  }

  const total = formatRub(order.total);
  const payLabel = PAYMENT_LABELS[order.payment_status] ?? order.payment_status ?? "—";
  const deliveryLabel = DELIVERY_LABELS[order.delivery_method] ?? order.delivery_method ?? "—";

  return (
    <div
      className="bg-surface-alt border-t border-line p-4 lg:p-5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 animate-fade-in"
      onClick={(e) => e.stopPropagation()}
    >
      <Row label="Номер заказа">
        <CopyValue fieldKey="order_id" text={order.order_id} mono />
      </Row>
      <Row label="Создан">
        <CopyValue
          fieldKey="created_at"
          text={order.created_at}
          display={formatDate(order.created_at)}
        />
      </Row>
      <Row label="Источник">
        <span className="text-[13px] text-ink-muted">{order.source || "—"}</span>
      </Row>

      <Row label="ФИО клиента" full>
        <CopyValue fieldKey="name" text={order.customer_name} />
      </Row>
      <Row label="Телефон">
        <CopyValue fieldKey="phone" text={order.customer_phone} mono />
      </Row>
      <Row label="Email">
        <CopyValue fieldKey="email" text={order.customer_email} />
      </Row>

      <Row label="Товары" full>
        <CopyValue fieldKey="items" text={order.items} multiline />
      </Row>
      <Row label="Сумма">
        <CopyValue fieldKey="total" text={String(order.total)} display={total} mono />
      </Row>
      <Row label="Оплата">
        <span className="text-[13px] text-ink">{payLabel}</span>
      </Row>

      <Row label="Способ доставки">
        <span className="text-[13px] text-ink">{deliveryLabel}</span>
      </Row>
      <Row label={order.pickup_point ? "ПВЗ" : "Адрес доставки"} full>
        <CopyValue
          fieldKey="addr"
          text={order.pickup_point || order.delivery_address}
          multiline
        />
      </Row>
      {order.city && (
        <Row label="Город">
          <CopyValue fieldKey="city" text={order.city} />
        </Row>
      )}

      <Row label="Трек-номер" full>
        <TrackEditor
          orderId={order.order_id}
          value={order.track_number}
          copy={copy}
          copiedKey={copiedKey}
          onUpdate={(track) => onUpdate?.({ track_number: track })}
        />
      </Row>
      {order.shipped_at && (
        <Row label="Отгружен">
          <span className="text-[13px] text-ink">{formatDate(order.shipped_at)}</span>
        </Row>
      )}
      {order.delivered_at && (
        <Row label="Доставлен">
          <span className="text-[13px] text-ink">{formatDate(order.delivered_at)}</span>
        </Row>
      )}

      {order.customer_comment && (
        <Row label="Комментарий клиента" full>
          <CopyValue fieldKey="comment" text={order.customer_comment} multiline />
        </Row>
      )}
      {order.internal_note && (
        <Row label="Заметка менеджера" full>
          <CopyValue fieldKey="note" text={order.internal_note} multiline />
        </Row>
      )}
      {order.assigned_to && (
        <Row label="Закреплено за">
          <span className="text-[13px] text-ink">{order.assigned_to}</span>
        </Row>
      )}
    </div>
  );
}

function TrackEditor({
  orderId,
  value,
  copy,
  copiedKey,
  onUpdate,
}: {
  orderId: string;
  value: string;
  copy: (text: string, key: string) => Promise<void>;
  copiedKey: string | null;
  onUpdate: (track: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // если со стороны API трек поменяли (другой инициатор) — синхронизируемся
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function save() {
    const trimmed = draft.trim();
    if (trimmed === value) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.updateOrderTrack(orderId, trimmed);
      onUpdate(trimmed);
      setEditing(false);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setDraft(value);
    setErr(null);
    setEditing(false);
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            disabled={busy}
            placeholder="Введите трек-номер"
            className="font-mono text-[13px] flex-1 border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand transition-colors disabled:opacity-50"
          />
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="px-2.5 py-1 text-[12px] rounded-md bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 font-medium"
          >
            {busy ? "…" : "Сохранить"}
          </button>
          <button
            type="button"
            onClick={cancel}
            disabled={busy}
            className="px-2 py-1 text-[12px] rounded-md border border-line text-ink-muted hover:bg-surface-hover transition-colors"
          >
            Отмена
          </button>
        </div>
        {err && (
          <div className="text-[11px] text-rose-700 dark:text-rose-300">{err}</div>
        )}
      </div>
    );
  }

  // Просмотр
  const isCopied = copiedKey === `${orderId}:track`;
  if (!value) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 text-[13px] text-brand hover:text-brand-hover transition-colors"
      >
        <Pencil size={12} />
        Добавить трек-номер
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => copy(value, `${orderId}:track`)}
        className="group inline-flex items-start gap-1.5 text-left rounded px-1.5 -ml-1.5 py-0.5 transition-colors hover:bg-surface-hover font-mono text-[13px]"
        title="Кликните чтобы скопировать"
      >
        <span className="text-ink">{value}</span>
        <span
          className={clsx(
            "shrink-0 mt-0.5 transition-opacity",
            isCopied
              ? "opacity-100 text-emerald-600 dark:text-emerald-400"
              : "opacity-0 group-hover:opacity-50 text-ink-soft",
          )}
        >
          {isCopied ? <Check size={12} /> : <Copy size={11} />}
        </span>
        {isCopied && (
          <span className="ml-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium tracking-tightish">
            Скопировано
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="ml-1 text-ink-soft hover:text-brand transition-colors"
        title="Изменить"
        aria-label="Изменить трек-номер"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}
