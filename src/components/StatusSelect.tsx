import { useState } from "react";
import clsx from "clsx";
import { api } from "../api";

const OPTIONS: Array<{ value: string; label: string; cls: string }> = [
  { value: "new",       label: "Новый",          cls: "bg-amber-50 text-amber-800 border-amber-200" },
  { value: "confirmed", label: "В обработке",    cls: "bg-brand-tint text-brand-dark border-brand-tintStrong" },
  { value: "in_pack",   label: "Направлено ФФ",  cls: "bg-violet-50 text-violet-800 border-violet-200" },
  { value: "shipped",   label: "Отгружено",      cls: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  { value: "delivered", label: "Доставлено",     cls: "bg-emerald-100 text-emerald-900 border-emerald-300" },
  { value: "cancelled", label: "Отменён",        cls: "bg-slate-100 text-slate-700 border-slate-300" },
  { value: "refunded",  label: "Возврат",        cls: "bg-rose-50 text-rose-800 border-rose-200" },
];

const FALLBACK = "bg-slate-50 text-slate-700 border-slate-200";

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
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const cur = OPTIONS.find((o) => o.value === value);
  const cls = cur?.cls ?? FALLBACK;

  async function handle(next: string) {
    if (next === value) return;
    const prev = value;
    setValue(next);  // оптимистично обновляем
    setBusy(true);
    setErr(null);
    try {
      await api.updateOrderStatus(orderId, next);
      onChanged(next);
    } catch (e) {
      setValue(prev);
      setErr(e instanceof Error ? e.message : String(e));
      // показываем ошибку 3 сек, потом убираем
      setTimeout(() => setErr(null), 3000);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="relative inline-flex flex-col">
      <select
        value={value}
        onChange={(e) => handle(e.target.value)}
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
      {err && (
        <div className="absolute top-full mt-1 z-20 text-[10px] bg-rose-600 text-white px-1.5 py-0.5 rounded whitespace-nowrap shadow-lg">
          {err}
        </div>
      )}
    </div>
  );
}
