import clsx from "clsx";
import { parseOrderItems } from "../api";

interface Props {
  items: string | null | undefined;
  /** Если true — показывает только предзаказные позиции (для страницы Preorders) */
  preorderOnly?: boolean;
  /** Компактный режим — для карточек заказов в списке */
  compact?: boolean;
  className?: string;
}

function formatRub(n: number): string {
  return n.toLocaleString("ru-RU", { maximumFractionDigits: 0 }) + " ₽";
}

/**
 * Единый компонент отображения позиций заказа. Каждая позиция с новой строки,
 * SKU с серым моноширинным фоном, плашка «🆕 ПРЕДЗАКАЗ» для PRE-* артикулов.
 */
export function ItemsList({ items, preorderOnly, compact, className }: Props) {
  const parsed = parseOrderItems(items);
  const shown = preorderOnly ? parsed.filter((it) => it.isPreorder) : parsed;
  if (shown.length === 0) {
    return <div className={clsx("text-ink-subtle text-[12px]", className)}>—</div>;
  }
  return (
    <ul className={clsx("space-y-1.5", className)}>
      {shown.map((it, idx) => (
        <li
          key={idx}
          className={clsx(
            "flex items-start gap-2 leading-snug",
            compact ? "text-[12px]" : "text-[13px]",
            it.isPreorder && "p-1.5 rounded-md bg-amber-50/60 dark:bg-amber-900/15 border border-amber-200/60 dark:border-amber-800/40",
          )}
        >
          <span className="text-ink-soft pt-px select-none">•</span>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline justify-between gap-2 flex-wrap">
              <span className="text-ink">{it.name}</span>
              <span className={clsx("tabular-nums", compact ? "text-[11px]" : "text-[12px]", "text-ink-muted")}>
                {it.qty > 1 ? `${it.qty} × ${formatRub(it.price)}` : ""}
                {it.qty > 1 && it.total ? ` = ${formatRub(it.total)}` : it.total ? formatRub(it.total) : ""}
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap text-[10px]">
              {it.size && (
                <span className="px-1.5 py-0.5 rounded bg-surface-alt text-ink-muted border border-line-soft">
                  Размер: <span className="font-medium text-ink">{it.size}</span>
                </span>
              )}
              {it.sku && (
                <span className={clsx(
                  "px-1.5 py-0.5 rounded font-mono border",
                  it.isPreorder
                    ? "bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700"
                    : "bg-surface-alt text-ink-muted border-line-soft",
                )}>
                  {it.sku}
                </span>
              )}
              {it.isPreorder && (
                <span className="px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-200 border border-amber-300 dark:border-amber-700 font-medium">
                  🆕 Предзаказ
                </span>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}
