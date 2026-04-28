import clsx from "clsx";

const styles: Record<string, string> = {
  new: "bg-amber-50 text-amber-800 border-amber-200",
  confirmed: "bg-brand-tint text-brand-dark border-brand-tintStrong",
  in_pack: "bg-violet-50 text-violet-800 border-violet-200",
  shipped: "bg-emerald-50 text-emerald-800 border-emerald-200",
  delivered: "bg-emerald-100 text-emerald-900 border-emerald-300",
  refunded: "bg-rose-50 text-rose-800 border-rose-200",
  cancelled: "bg-slate-100 text-slate-700 border-slate-300",
};

const labels: Record<string, string> = {
  new: "Новый",
  confirmed: "Подтверждён",
  in_pack: "В сборке",
  shipped: "Отгружен",
  delivered: "Доставлен",
  refunded: "Возврат",
  cancelled: "Отменён",
};

export function StatusBadge({ status }: { status: string }) {
  const key = status.toLowerCase().trim();
  const cls = styles[key] ?? "bg-slate-50 text-slate-700 border-slate-200";
  const label = labels[key] ?? (status || "—");
  return (
    <span
      className={clsx(
        "inline-flex items-center px-1.5 py-0.5 rounded text-[11px] border font-medium tracking-tightish",
        cls,
      )}
    >
      {label}
    </span>
  );
}
