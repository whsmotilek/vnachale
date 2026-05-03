import { useEffect, useState } from "react";
import clsx from "clsx";
import { api } from "../api";

const OPTIONS: Array<{ value: string; label: string; cls: string }> = [
  {
    value: "new",
    label: "Новый",
    cls: "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-800",
  },
  {
    value: "confirmed",
    label: "В обработке",
    cls: "bg-brand-tint text-brand-dark border-brand-tintStrong dark:text-white dark:border-brand",
  },
  {
    value: "in_pack",
    label: "Направлено ФФ",
    cls: "bg-violet-50 text-violet-800 border-violet-200 dark:bg-violet-900/30 dark:text-violet-200 dark:border-violet-800",
  },
  {
    value: "shipped",
    label: "Отгружено",
    cls: "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800",
  },
  {
    value: "delivered",
    label: "Доставлено",
    cls: "bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-800/40 dark:text-emerald-100 dark:border-emerald-700",
  },
  {
    value: "cancelled",
    label: "Отменен",
    cls: "bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-700/40 dark:text-slate-200 dark:border-slate-600",
  },
  {
    value: "refunded",
    label: "Возврат",
    cls: "bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800",
  },
];

const FALLBACK = "bg-slate-50 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700";

function labelOf(value: string): string {
  return OPTIONS.find((o) => o.value === value)?.label ?? value;
}

export function StatusSelect({
  orderId,
  current,
  onChanged,
}: {
  orderId: string;
  current: string;
  onChanged: (newStatus: string) => void;
}) {
  const [value, setValue] = useState(current);
  const [pending, setPending] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // если входной current изменился (рефетч списка) — синхронизируемся
  useEffect(() => setValue(current), [current]);

  const cur = OPTIONS.find((o) => o.value === value);
  const cls = cur?.cls ?? FALLBACK;

  async function confirm() {
    if (pending === null) return;
    const next = pending;
    const prev = value;
    setBusy(true);
    setErr(null);
    try {
      await api.updateOrderStatus(orderId, next);
      setValue(next);
      onChanged(next);
      setPending(null);
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
      setValue(prev);
    } finally {
      setBusy(false);
    }
  }

  function cancel() {
    setPending(null);
    setErr(null);
  }

  return (
    <>
      <div className="relative inline-flex flex-col">
        <select
          value={value}
          onChange={(e) => {
            const next = e.target.value;
            if (next !== value) setPending(next);
          }}
          disabled={busy}
          className={clsx(
            "appearance-none cursor-pointer pl-2 pr-6 py-0.5 rounded text-[11px] border font-medium tracking-tightish",
            "transition-opacity",
            cls,
            busy && "opacity-60 cursor-wait",
          )}
          style={{
            backgroundImage:
              "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='10' viewBox='0 0 10 10'><path d='M2 4l3 3 3-3' fill='none' stroke='currentColor' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/></svg>\")",
            backgroundRepeat: "no-repeat",
            backgroundPosition: "right 4px center",
          }}
        >
          {OPTIONS.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </div>

      {pending !== null && (
        <ConfirmModal
          fromLabel={labelOf(value)}
          toLabel={labelOf(pending)}
          orderId={orderId}
          busy={busy}
          error={err}
          onConfirm={confirm}
          onCancel={cancel}
        />
      )}
    </>
  );
}

function ConfirmModal({
  fromLabel,
  toLabel,
  orderId,
  busy,
  error,
  onConfirm,
  onCancel,
}: {
  fromLabel: string;
  toLabel: string;
  orderId: string;
  busy: boolean;
  error: string | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  // Закрытие по Esc
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onCancel();
      if (e.key === "Enter" && !busy) onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onCancel, onConfirm]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 animate-fade-in"
      onClick={busy ? undefined : onCancel}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-sm card p-5 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-base font-semibold tracking-tightish">Сменить статус заказа?</h2>
        <p className="mt-2 text-[13px] text-ink-muted">
          Заказ <code className="font-mono text-ink">{orderId}</code>:
        </p>
        <div className="mt-3 flex items-center gap-2 text-[13px]">
          <span className="px-2 py-0.5 rounded border border-line bg-surface-alt text-ink-muted">
            {fromLabel}
          </span>
          <span className="text-ink-subtle">→</span>
          <span className="px-2 py-0.5 rounded border border-brand bg-brand-tint text-brand-dark dark:text-white font-medium">
            {toLabel}
          </span>
        </div>

        {error && (
          <div className="mt-3 text-[12px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded p-2">
            {error}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="px-3 py-1.5 text-[13px] rounded-md border border-line text-ink hover:bg-surface-hover transition-colors disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="px-3 py-1.5 text-[13px] rounded-md bg-brand text-white hover:bg-brand-hover transition-colors disabled:opacity-50 font-medium"
          >
            {busy ? "Сохраняем…" : "Подтвердить"}
          </button>
        </div>
      </div>
    </div>
  );
}
