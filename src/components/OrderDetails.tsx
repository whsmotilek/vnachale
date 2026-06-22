import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { Check, Copy, Pencil, Send, MessageSquare } from "lucide-react";
import { api, type Order, type OrderActivityItem } from "../api";
import { useCopy } from "../hooks/useCopy";
import { ItemsList } from "./ItemsList";

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
    timeZone: "Europe/Moscow",
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
  readOnly = false,
}: {
  order: Order;
  onUpdate?: (patch: Partial<Order>) => void;
  readOnly?: boolean;
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
        <div className="flex-1 min-w-0">
          <ItemsList items={order.items} />
        </div>
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
        {readOnly ? (
          <CopyValue fieldKey="track" text={order.track_number || ""} mono />
        ) : (
          <TrackEditor
            orderId={order.order_id}
            value={order.track_number}
            copy={copy}
            copiedKey={copiedKey}
            onUpdate={(track) => onUpdate?.({ track_number: track })}
          />
        )}
      </Row>
      {(() => {
        // Стоимость доставки: для Ozon-заказов поле редактируется вручную
        // (Tilda присылает 0, реальную цену знает только менеджер склада).
        // Для других способов доставки — показываем как ридонли (пришло из webhook).
        const dm = (order.delivery_method || "").toLowerCase();
        const isOzon = dm === "ozon_pvz" || dm === "ozon";
        const raw = (order.delivery_price ?? "").trim();
        const dp = raw ? Number(raw) : null;
        if (!isOzon && (dp === null || !Number.isFinite(dp))) return null;
        return (
          <Row label="Стоимость доставки">
            {readOnly || !isOzon ? (
              <span className="text-[13px] text-ink">
                {dp !== null && Number.isFinite(dp) ? formatRub(dp) : "—"}
              </span>
            ) : (
              <DeliveryPriceEditor
                orderId={order.order_id}
                value={raw}
                onUpdate={(price) => onUpdate?.({ delivery_price: String(price) })}
              />
            )}
          </Row>
        );
      })()}
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

      <div className="sm:col-span-2 lg:col-span-3">
        <OrderActivity orderId={order.order_id} readOnly={readOnly} />
      </div>
    </div>
  );
}

// ─── Лента активности заказа: системные события «Журнала» + комментарии ───
function activityTone(ev: string): string {
  if (ev === "comment") return "bg-brand";
  if (ev.startsWith("stock_")) return "bg-amber-400";
  if (ev === "email_sent") return "bg-emerald-400";
  if (ev === "payment_succeeded") return "bg-emerald-500";
  if (ev.startsWith("refund") || ev === "auto_cancel_unpaid") return "bg-rose-400";
  return "bg-ink-soft";
}
function roleLabel(role: string): string {
  return ({ owner: "владелец", fulfillment: "склад", manager: "менеджер", ozon: "ozon" } as Record<string, string>)[role] || "";
}
function authorLine(a: { name: string; username: string; role: string }): string {
  const handle = a.username ? `@${a.username}` : "";
  if (a.name && handle && a.name.toLowerCase() !== a.username.toLowerCase()) return `${a.name} · ${handle}`;
  return handle || a.name || "Система";
}
function activityTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Moscow",
  }).format(d);
}

function OrderActivity({ orderId, readOnly }: { orderId: string; readOnly: boolean }) {
  const [items, setItems] = useState<OrderActivityItem[] | null>(null);
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    api.orderActivity(orderId)
      .then((r) => { if (!cancelled) setItems(r.activity); })
      .catch(() => { if (!cancelled) setItems([]); });
    return () => { cancelled = true; };
  }, [orderId]);

  async function send() {
    const text = draft.trim();
    if (!text || busy) return;
    setBusy(true);
    setErr(null);
    try {
      const r = await api.addOrderComment(orderId, text);
      setItems((prev) => [...(prev || []), r.comment]);
      setDraft("");
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-1 border-t border-line pt-3">
      <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-ink-muted font-medium mb-2">
        <MessageSquare size={12} /> История и комментарии
      </div>

      {items === null ? (
        <div className="text-[12px] text-ink-subtle">Загрузка…</div>
      ) : items.length === 0 ? (
        <div className="text-[12px] text-ink-subtle">Пока пусто.</div>
      ) : (
        <ul className="space-y-2 mb-3 max-h-72 overflow-y-auto pr-1">
          {items.map((it, i) => (
            <li key={i} className="flex gap-2 text-[12px]">
              <span className={clsx("mt-1.5 w-1.5 h-1.5 rounded-full shrink-0", activityTone(it.event))} />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-ink font-medium">{authorLine(it.actor)}</span>
                  {it.actor.role && roleLabel(it.actor.role) && (
                    <span className="text-[10px] px-1 py-0.5 rounded bg-surface-hover text-ink-subtle">{roleLabel(it.actor.role)}</span>
                  )}
                  <span className="text-[10px] text-ink-subtle">{activityTime(it.ts)}</span>
                </div>
                <div className={clsx("whitespace-pre-line break-words", it.is_comment ? "text-ink" : "text-ink-muted")}>
                  {it.text || it.event}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!readOnly && (
        <div className="flex flex-col gap-1.5">
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) send(); }}
              rows={2}
              placeholder="Комментарий к заказу… (Ctrl+Enter — отправить)"
              disabled={busy}
              className="flex-1 text-[13px] border border-line rounded-md px-2 py-1.5 bg-surface text-ink focus:outline-none focus:border-brand resize-y disabled:opacity-50"
            />
            <button
              type="button"
              onClick={send}
              disabled={busy || !draft.trim()}
              className="px-3 py-1.5 text-[12px] rounded-md bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-40 font-medium inline-flex items-center gap-1.5 shrink-0"
            >
              <Send size={13} /> {busy ? "…" : "Отправить"}
            </button>
          </div>
          {err && <div className="text-[11px] text-rose-700 dark:text-rose-300">{err}</div>}
        </div>
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

function DeliveryPriceEditor({
  orderId,
  value,
  onUpdate,
}: {
  orderId: string;
  value: string;
  onUpdate: (price: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function save() {
    const trimmed = draft.trim().replace(/\s/g, "").replace(",", ".");
    const num = Number(trimmed);
    if (!Number.isFinite(num) || num < 0) {
      setErr("Введите целое неотрицательное число в рублях");
      return;
    }
    if (num > 100000) {
      setErr("Сумма выглядит подозрительно большой");
      return;
    }
    const intRub = Math.round(num);
    const currentNum = Number(value || 0);
    if (intRub === currentNum) {
      setEditing(false);
      return;
    }
    setBusy(true);
    setErr(null);
    try {
      await api.updateOrderDeliveryPrice(orderId, intRub);
      onUpdate(intRub);
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

  const dp = value ? Number(value) : null;
  const hasValue = dp !== null && Number.isFinite(dp) && dp > 0;

  if (editing) {
    return (
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            inputMode="numeric"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
              if (e.key === "Escape") cancel();
            }}
            disabled={busy}
            placeholder="180"
            className="text-[13px] w-24 border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand transition-colors disabled:opacity-50"
          />
          <span className="text-[13px] text-ink-soft">₽</span>
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

  if (!hasValue) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex items-center gap-1.5 text-[13px] text-brand hover:text-brand-hover transition-colors"
      >
        <Pencil size={12} />
        Указать стоимость доставки Ozon
      </button>
    );
  }
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[13px] text-ink">
        {new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(dp!)} ₽
      </span>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="ml-1 text-ink-soft hover:text-brand transition-colors"
        title="Изменить"
        aria-label="Изменить стоимость доставки"
      >
        <Pencil size={12} />
      </button>
    </div>
  );
}
