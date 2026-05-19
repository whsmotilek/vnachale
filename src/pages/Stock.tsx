import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import clsx from "clsx";
import { AlertTriangle, Minus, Plus, Search, X } from "lucide-react";
import { api, ApiError, type StockRow } from "../api";
import { hasApi } from "../env";

function formatNum(n: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
}

type SortBy = "name" | "stock" | "available";

export function Stock() {
  const [rows, setRows] = useState<StockRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("name");
  const [showLowOnly, setShowLowOnly] = useState(false);
  const [adjusting, setAdjusting] = useState<StockRow | null>(null);

  function load() {
    if (!hasApi) {
      setError("Сервис временно недоступен.");
      setRows([]);
      return;
    }
    api
      .stock()
      .then((d) => {
        setRows(d);
        setError(null);
      })
      .catch((e) => {
        setError(e instanceof ApiError ? `Ошибка ${e.status}` : "Не удалось загрузить склад.");
        setRows([]);
      });
  }

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!rows) return null;
    const query = q.trim().toLowerCase();
    let r = rows;
    if (query) {
      r = r.filter(
        (it) =>
          it.sku.toLowerCase().includes(query) ||
          it.name.toLowerCase().includes(query) ||
          it.display_model.toLowerCase().includes(query) ||
          it.display_color.toLowerCase().includes(query) ||
          it.size.toLowerCase().includes(query),
      );
    }
    if (showLowOnly) {
      r = r.filter((it) => it.stock < it.min_stock);
    }
    const sorted = [...r];
    if (sortBy === "stock") {
      sorted.sort((a, b) => a.stock - b.stock);
    } else if (sortBy === "available") {
      sorted.sort((a, b) => a.available - b.available);
    } else {
      sorted.sort((a, b) => {
        if (a.display_model !== b.display_model)
          return a.display_model.localeCompare(b.display_model);
        if (a.display_color !== b.display_color)
          return a.display_color.localeCompare(b.display_color);
        // size order: S, M, L, XL, XXL, XXXL
        const sizeOrder = ["S", "M", "L", "XL", "XXL", "XXXL"];
        const ai = sizeOrder.indexOf(a.display_size);
        const bi = sizeOrder.indexOf(b.display_size);
        return (ai === -1 ? 99 : ai) - (bi === -1 ? 99 : bi);
      });
    }
    return sorted;
  }, [rows, q, sortBy, showLowOnly]);

  // Сводка KPI
  const kpi = useMemo(() => {
    if (!rows) return null;
    const totalSku = rows.length;
    const totalUnits = rows.reduce((s, r) => s + r.stock, 0);
    const totalReserved = rows.reduce((s, r) => s + r.reserved, 0);
    const lowCount = rows.filter((r) => r.stock < r.min_stock).length;
    return { totalSku, totalUnits, totalReserved, lowCount };
  }, [rows]);

  return (
    <div className="px-4 lg:px-8 py-6 lg:py-8 max-w-[1200px] animate-slide-up">
      <header className="mb-5 flex items-baseline justify-between gap-4">
        <h1 className="text-2xl font-semibold tracking-tighter2 text-ink">Склад</h1>
        {kpi && (
          <div className="text-[13px] text-ink-muted tabular-nums">
            {kpi.totalSku} SKU · {formatNum(kpi.totalUnits)} ед.
            {kpi.totalReserved > 0 && ` · резерв ${kpi.totalReserved}`}
          </div>
        )}
      </header>

      {/* KPI карточки */}
      {kpi && (
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
          <KpiCard label="Всего SKU" value={kpi.totalSku} />
          <KpiCard label="Единиц на складе" value={formatNum(kpi.totalUnits)} />
          <KpiCard label="В резерве" value={kpi.totalReserved} hint="по активным заказам" />
          <KpiCard
            label="Низкий остаток"
            value={kpi.lowCount}
            warning={kpi.lowCount > 0}
            hint={kpi.lowCount > 0 ? "ниже порога" : "всё в норме"}
          />
        </section>
      )}

      {/* Поиск + фильтры */}
      <div className="flex flex-col lg:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-soft pointer-events-none"
          />
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Поиск: артикул, название, цвет, размер…"
            className="w-full pl-9 pr-9 py-2 rounded-lg border border-line bg-surface text-[14px] text-ink placeholder:text-ink-soft focus:outline-none focus:border-brand transition-colors"
          />
          {q && (
            <button
              onClick={() => setQ("")}
              type="button"
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 rounded text-ink-muted hover:text-ink hover:bg-surface-hover"
              aria-label="Очистить"
            >
              <X size={14} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <label className="flex items-center gap-1.5 text-ink-muted">
            Сортировка:
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="border border-line rounded px-2 py-1 bg-surface text-ink focus:outline-none focus:border-brand"
            >
              <option value="name">По названию</option>
              <option value="stock">По остатку ↑</option>
              <option value="available">По доступному ↑</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 text-ink-muted whitespace-nowrap cursor-pointer">
            <input
              type="checkbox"
              checked={showLowOnly}
              onChange={(e) => setShowLowOnly(e.target.checked)}
              className="accent-brand"
            />
            Только низкие
          </label>
        </div>
      </div>

      {error && (
        <div className="mb-4 text-[13px] text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
          {error}
        </div>
      )}

      {/* Таблица */}
      {filtered === null ? (
        <div className="card p-10 text-center text-ink-muted">Загрузка…</div>
      ) : filtered.length === 0 ? (
        <div className="card p-10 text-center text-ink-muted">
          {q || showLowOnly ? "Ничего не найдено по фильтрам." : "Склад пуст."}
        </div>
      ) : (
        <>
          {/* Мобильные карточки */}
          <div className="lg:hidden flex flex-col gap-2 animate-slide-up-fast">
            {filtered.map((r) => (
              <StockMobileCard key={r.sku} row={r} onAdjust={() => setAdjusting(r)} />
            ))}
          </div>

          {/* Десктоп-таблица */}
          <div className="hidden lg:block card overflow-hidden animate-slide-up-fast">
            <table className="w-full text-[13px] table-fixed">
              <colgroup>
                <col className="w-[140px]" />
                <col className="w-[220px]" />
                <col className="w-[100px]" />
                <col className="w-[90px]" />
                <col className="w-[80px]" />
                <col className="w-[90px]" />
                <col />
                <col className="w-[140px]" />
              </colgroup>
              <thead className="bg-surface-alt border-b border-line text-ink-muted">
                <tr>
                  <Th>Артикул</Th>
                  <Th>Товар</Th>
                  <Th>Размер</Th>
                  <Th align="right">Остаток</Th>
                  <Th align="right">Резерв</Th>
                  <Th align="right">Доступно</Th>
                  <Th align="right">Мин.</Th>
                  <Th align="right">Действие</Th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((r) => {
                  const isLow = r.stock < r.min_stock;
                  const isCritical = r.available <= 0;
                  return (
                    <tr key={r.sku} className="border-t border-line hover:bg-surface-hover">
                      <Td>
                        <span className="font-mono text-[11px] text-ink-muted">{r.sku}</span>
                      </Td>
                      <Td>
                        <div className="text-ink truncate">{r.display_model}</div>
                        {r.display_color !== "—" && (
                          <div className="text-ink-subtle text-[11px] truncate">
                            {r.display_color}
                          </div>
                        )}
                      </Td>
                      <Td>
                        <span className="px-1.5 py-0.5 rounded bg-surface text-[11px] text-ink font-mono">
                          {r.display_size}
                        </span>
                      </Td>
                      <Td
                        align="right"
                        className={clsx(
                          "tabular-nums font-medium",
                          isLow && "text-amber-700 dark:text-amber-300",
                        )}
                      >
                        {r.stock}
                        {isLow && (
                          <AlertTriangle
                            size={12}
                            className="inline ml-1 text-amber-600 dark:text-amber-400"
                          />
                        )}
                      </Td>
                      <Td align="right" className="tabular-nums text-ink-subtle">
                        {r.reserved || "—"}
                      </Td>
                      <Td
                        align="right"
                        className={clsx(
                          "tabular-nums font-medium",
                          isCritical && "text-rose-700 dark:text-rose-300",
                        )}
                      >
                        {r.available}
                      </Td>
                      <Td align="right" className="tabular-nums text-ink-subtle">
                        {r.min_stock || "—"}
                      </Td>
                      <Td align="right">
                        <button
                          type="button"
                          onClick={() => setAdjusting(r)}
                          className="px-2 py-1 text-[11px] rounded border border-line bg-surface hover:bg-brand-tint hover:border-brand text-ink font-medium transition-colors"
                        >
                          Изменить
                        </button>
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      {adjusting &&
        createPortal(
          <AdjustModal
            row={adjusting}
            onClose={() => setAdjusting(null)}
            onApplied={(updated) => {
              setRows((prev) =>
                prev
                  ? prev.map((it) =>
                      it.sku === updated.sku
                        ? {
                            ...it,
                            stock: updated.new_stock,
                            available: updated.new_stock - it.reserved,
                          }
                        : it,
                    )
                  : prev,
              );
              setAdjusting(null);
            }}
          />,
          document.body,
        )}
    </div>
  );
}

function StockMobileCard({ row, onAdjust }: { row: StockRow; onAdjust: () => void }) {
  const isLow = row.stock < row.min_stock;
  const isCritical = row.available <= 0;
  return (
    <article className="card p-3.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="font-mono text-[11px] text-ink-muted">{row.sku}</div>
          <div className="text-[14px] text-ink font-medium truncate mt-0.5">
            {row.display_model}
            {row.display_color !== "—" && (
              <span className="text-ink-subtle"> · {row.display_color}</span>
            )}
            <span className="ml-1 px-1.5 py-0.5 rounded bg-surface text-[11px] font-mono text-ink-muted">
              {row.display_size}
            </span>
          </div>
        </div>
        <button
          type="button"
          onClick={onAdjust}
          className="shrink-0 px-2.5 py-1 text-[12px] rounded border border-line bg-surface hover:bg-brand-tint hover:border-brand text-ink font-medium transition-colors"
        >
          Изменить
        </button>
      </div>
      <div className="mt-2.5 flex items-baseline gap-3 text-[12px]">
        <span
          className={clsx(
            "font-medium tabular-nums",
            isLow && "text-amber-700 dark:text-amber-300",
          )}
        >
          Остаток: <span className="text-[15px]">{row.stock}</span>
          {isLow && (
            <AlertTriangle size={12} className="inline ml-1 text-amber-600 dark:text-amber-400" />
          )}
        </span>
        {row.reserved > 0 && (
          <span className="text-ink-subtle tabular-nums">резерв {row.reserved}</span>
        )}
        <span
          className={clsx(
            "tabular-nums",
            isCritical ? "text-rose-700 dark:text-rose-300 font-medium" : "text-ink-muted",
          )}
        >
          доступно {row.available}
        </span>
        {row.min_stock > 0 && (
          <span className="text-ink-subtle tabular-nums">мин {row.min_stock}</span>
        )}
      </div>
    </article>
  );
}

function AdjustModal({
  row,
  onClose,
  onApplied,
}: {
  row: StockRow;
  onClose: () => void;
  onApplied: (updated: { sku: string; new_stock: number }) => void;
}) {
  const [direction, setDirection] = useState<"add" | "remove">("add");
  const [qtyStr, setQtyStr] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [busy, onClose]);

  const qty = Math.max(0, parseInt(qtyStr || "0", 10) || 0);
  const delta = direction === "add" ? qty : -qty;
  const newStock = row.stock + delta;
  const valid =
    qty > 0 &&
    newStock >= 0 &&
    newStock >= row.reserved;

  async function apply() {
    if (!valid) return;
    setBusy(true);
    setErr(null);
    try {
      const result = await api.adjustStock(row.sku, delta, {
        reason: reason.trim() || undefined,
        expectedStock: row.stock,
      });
      onApplied({ sku: result.sku, new_stock: result.new_stock });
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-[1000] flex items-center justify-center px-4 animate-fade-in"
      onClick={busy ? undefined : onClose}
    >
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-md card p-5 animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="mb-3">
          <h2 className="text-base font-semibold tracking-tightish">Изменить остаток</h2>
          <div className="mt-1 text-[12px] text-ink-muted">
            <span className="font-mono">{row.sku}</span> · {row.display_model}
            {row.display_color !== "—" && ` · ${row.display_color}`} · {row.display_size}
          </div>
          <div className="mt-2 text-[12px] text-ink-muted">
            Сейчас: <b className="text-ink tabular-nums">{row.stock}</b> на складе
            {row.reserved > 0 && (
              <>
                {" "}
                · <b className="text-ink tabular-nums">{row.reserved}</b> в резерве
              </>
            )}
          </div>
        </header>

        {/* Направление */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            onClick={() => setDirection("add")}
            className={clsx(
              "px-3 py-2 rounded-md border text-[13px] font-medium transition-colors flex items-center justify-center gap-1.5",
              direction === "add"
                ? "bg-emerald-50 border-emerald-300 text-emerald-800 dark:bg-emerald-900/30 dark:border-emerald-700 dark:text-emerald-200"
                : "bg-surface border-line text-ink-muted hover:bg-surface-hover",
            )}
          >
            <Plus size={14} /> Добавить
          </button>
          <button
            type="button"
            onClick={() => setDirection("remove")}
            className={clsx(
              "px-3 py-2 rounded-md border text-[13px] font-medium transition-colors flex items-center justify-center gap-1.5",
              direction === "remove"
                ? "bg-rose-50 border-rose-300 text-rose-800 dark:bg-rose-900/30 dark:border-rose-700 dark:text-rose-200"
                : "bg-surface border-line text-ink-muted hover:bg-surface-hover",
            )}
          >
            <Minus size={14} /> Списать
          </button>
        </div>

        {/* Количество */}
        <label className="block mb-3">
          <span className="text-[12px] text-ink-muted mb-1 block">Количество</span>
          <input
            type="number"
            min="1"
            max="9999"
            value={qtyStr}
            onChange={(e) => setQtyStr(e.target.value)}
            placeholder="например, 50"
            autoFocus
            className="w-full px-3 py-2 rounded-md border border-line bg-surface text-ink text-[14px] focus:outline-none focus:border-brand"
          />
        </label>

        {/* Причина */}
        <label className="block mb-4">
          <span className="text-[12px] text-ink-muted mb-1 block">
            Причина <span className="text-ink-subtle">(необязательно)</span>
          </span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={
              direction === "add"
                ? "Новая партия / возврат клиента / переучёт +"
                : "Брак / PR-блогер / недостача / переучёт −"
            }
            className="w-full px-3 py-2 rounded-md border border-line bg-surface text-ink text-[13px] focus:outline-none focus:border-brand"
          />
        </label>

        {/* Превью результата */}
        {qty > 0 && (
          <div className="mb-3 p-3 rounded bg-surface-alt border border-line text-[12px]">
            <div className="text-ink-muted">После операции:</div>
            <div className="mt-1 tabular-nums">
              <span className="text-ink">Остаток: </span>
              <span className="text-ink-muted">{row.stock}</span>
              {" → "}
              <span
                className={clsx(
                  "font-semibold",
                  newStock < row.reserved
                    ? "text-rose-700 dark:text-rose-300"
                    : newStock < row.min_stock
                      ? "text-amber-700 dark:text-amber-300"
                      : "text-ink",
                )}
              >
                {newStock}
              </span>
              {" "}
              ({delta >= 0 ? "+" : ""}
              {delta})
            </div>
            {newStock < row.reserved && (
              <div className="mt-1.5 text-rose-700 dark:text-rose-300 flex items-center gap-1">
                <AlertTriangle size={12} /> Меньше резерва ({row.reserved}) — нельзя применить
              </div>
            )}
            {newStock >= row.reserved && newStock < row.min_stock && (
              <div className="mt-1.5 text-amber-700 dark:text-amber-300 flex items-center gap-1">
                <AlertTriangle size={12} /> Будет ниже минимального порога ({row.min_stock})
              </div>
            )}
          </div>
        )}

        {err && (
          <div className="mb-3 text-[12px] text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-900/20 border border-rose-200 dark:border-rose-800 rounded p-2">
            {err}
          </div>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="px-3 py-1.5 text-[13px] rounded-md border border-line text-ink hover:bg-surface-hover disabled:opacity-50"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={apply}
            disabled={!valid || busy}
            className="px-3 py-1.5 text-[13px] rounded-md bg-brand text-white hover:bg-brand-hover disabled:opacity-50 font-medium"
          >
            {busy ? "Применяю…" : "Применить"}
          </button>
        </div>
      </div>
    </div>
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
}: {
  children: React.ReactNode;
  align?: "left" | "right";
  className?: string;
}) {
  return (
    <td
      className={clsx(
        "px-3 py-2.5 align-middle overflow-hidden",
        align === "right" && "text-right",
        className,
      )}
    >
      {children}
    </td>
  );
}

function KpiCard({
  label,
  value,
  hint,
  warning,
}: {
  label: string;
  value: string | number;
  hint?: string;
  warning?: boolean;
}) {
  return (
    <div
      className={clsx(
        "card p-3.5",
        warning && "border-amber-300 bg-amber-50/30 dark:bg-amber-900/10",
      )}
    >
      <div className="text-[11px] uppercase tracking-wider text-ink-muted font-medium">
        {label}
      </div>
      <div
        className={clsx(
          "mt-1.5 text-2xl font-semibold tabular-nums tracking-tighter2",
          warning ? "text-amber-700 dark:text-amber-300" : "text-ink",
        )}
      >
        {value}
      </div>
      {hint && <div className="mt-0.5 text-[11px] text-ink-subtle">{hint}</div>}
    </div>
  );
}
