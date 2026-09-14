import { useEffect, useState } from "react";
import { api, type PreorderOrder, type PreordersResponse } from "../api";

const STATUS_RU: Record<string, string> = {
  new: "новый", confirmed: "подтверждён", in_pack: "в сборке",
  shipped: "отгружен", delivered: "доставлен",
};

function fmtDate(iso: string): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return isNaN(d.getTime()) ? iso.slice(0, 10)
    : d.toLocaleDateString("ru", { day: "2-digit", month: "short" });
}

/** Позиции приходят одной строкой «Название (Размер: L, SKU: X) - 1x5990 = 5990». */
function itemLines(s: string): string[] {
  return (s || "").split(";").map((x) => x.trim()).filter(Boolean);
}

function Card({ o }: { o: PreorderOrder }) {
  const waiting = itemLines(o.preorder_items);
  const ready = itemLines(o.regular_items);
  return (
    <div className="rounded-xl border border-line bg-surface p-3.5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="min-w-0">
          <span className="text-[13px] font-medium text-ink">{o.customer_name || "—"}</span>
          <span className="ml-2 text-[11px] tabular-nums text-ink-subtle">#{o.order_id}</span>
        </div>
        <div className="flex items-center gap-2 text-[11px] text-ink-subtle">
          <span>{fmtDate(o.created_at)}</span>
          <span className="rounded bg-surface-alt px-1.5 py-0.5">
            {STATUS_RU[o.status] ?? o.status}
          </span>
          {o.kind === "mixed" && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-amber-900
                             dark:bg-amber-900/30 dark:text-amber-200">
              две отгрузки
            </span>
          )}
        </div>
      </div>

      {ready.length > 0 && (
        <div className="mt-2.5">
          <div className="text-[11px] font-medium text-ink-muted">📦 Можно отгружать сейчас</div>
          <ul className="mt-0.5 space-y-0.5">
            {ready.map((x, i) => (
              <li key={i} className="text-[12px] text-ink">{x}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-2.5">
        <div className="text-[11px] font-medium text-ink-muted">
          ⏳ Ждёт поставку{o.preorder_eta ? ` · ${o.preorder_eta}` : ""}
        </div>
        <ul className="mt-0.5 space-y-0.5">
          {waiting.map((x, i) => (
            <li key={i} className="text-[12px] text-ink">{x}</li>
          ))}
        </ul>
      </div>

      <div className="mt-2.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-subtle">
        {o.customer_phone && <span>{o.customer_phone}</span>}
        {o.city && <span>{o.city}</span>}
        <span>приедет на {o.warehouse === "ff" ? "ФФ" : "наш склад"}</span>
      </div>
    </div>
  );
}

export function SitePreorders() {
  const [data, setData] = useState<PreordersResponse | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [kind, setKind] = useState<"all" | "full" | "mixed">("all");

  useEffect(() => {
    api.preorders().then(setData).catch((e) => setErr(String(e)));
  }, []);

  if (err) return <div className="p-4 text-[13px] text-rose-600">{err}</div>;
  if (!data) return <div className="p-4 text-[13px] text-ink-subtle">Загружаю…</div>;

  const shown = data.items.filter((o) => kind === "all" || o.kind === kind);
  const open = shown.filter((o) => o.status !== "delivered");
  const done = shown.filter((o) => o.status === "delivered");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[15px] font-semibold text-ink">Предзаказы</h1>
        <p className="mt-1 text-[12px] text-ink-muted leading-relaxed">
          Оплаченные заказы, товар для которых ещё не приехал. Поставка приходит на
          фулфилмент, поэтому склад по таким заказам уведомлений не получает — они
          ждут здесь. «Две отгрузки» значит, что часть заказа можно отправить уже
          сейчас, а остальное уедет отдельной посылкой.
        </p>
      </div>

      <div className="flex flex-wrap gap-2 text-[12px]">
        {([["all", `все ${data.total}`], ["full", `целиком предзаказ ${data.full}`],
           ["mixed", `две отгрузки ${data.mixed}`]] as const).map(([k, label]) => (
          <button key={k} onClick={() => setKind(k)}
                  className={`rounded-full border px-3 py-1 ${kind === k
                    ? "border-brand bg-brand/10 text-brand"
                    : "border-line text-ink-muted hover:text-ink"}`}>
            {label}
          </button>
        ))}
      </div>

      {open.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[12px] font-medium text-ink-muted">
            Ждут отгрузки — {open.length}
          </div>
          {open.map((o) => <Card key={o.order_id} o={o} />)}
        </div>
      )}

      {done.length > 0 && (
        <div className="space-y-2.5">
          <div className="text-[12px] font-medium text-ink-muted">
            Уже доставлены — {done.length}
          </div>
          {done.map((o) => <Card key={o.order_id} o={o} />)}
        </div>
      )}

      {shown.length === 0 && (
        <div className="rounded-xl border border-dashed border-line p-6 text-center
                        text-[13px] text-ink-subtle">
          Предзаказов нет
        </div>
      )}
    </div>
  );
}
