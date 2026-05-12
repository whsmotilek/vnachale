import { useEffect, useRef, useState } from "react";
import { ChevronDown, LayoutGrid, LineChart, LogOut, ShoppingBag } from "lucide-react";
import clsx from "clsx";
import { Brand } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

type Page = "orders" | "analytics" | "ozon";

const items: Array<{ id: Page; label: string; Icon: typeof LayoutGrid }> = [
  { id: "orders", label: "Заказы", Icon: LayoutGrid },
  { id: "analytics", label: "Аналитика", Icon: LineChart },
  { id: "ozon", label: "Ozon", Icon: ShoppingBag },
];

export function Nav({
  page,
  setPage,
  user,
  onLogout,
}: {
  page: Page;
  setPage: (p: Page) => void;
  user: { name: string; username?: string };
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);

  // Закрываем dropdown по клику снаружи / Esc / смене страницы
  useEffect(() => {
    if (!menuOpen) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (popRef.current?.contains(target as Node)) return;
      if (btnRef.current?.contains(target as Node)) return;
      setMenuOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("touchstart", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("touchstart", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  const current = items.find((it) => it.id === page) ?? items[0];

  return (
    <>
      {/* === Топ-бар: мобильный.
           sticky-top-safe + safe-top — чтобы остаться видимым при скролле
           и не уехать под status bar iOS (notch / dynamic island).
           Селектор страницы — пилюля с дропдауном, чтобы влезали все вкладки. === */}
      <nav className="lg:hidden sticky top-0 z-40 border-b border-line bg-surface-alt/95 backdrop-blur-sm safe-top animate-fade-in">
        <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-2">
          <Brand size={22} textClass="text-[14px] font-semibold" />

          {/* Селектор текущей вкладки */}
          <div className="relative flex-1 max-w-[240px]">
            <button
              ref={btnRef}
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className={clsx(
                "w-full flex items-center justify-between gap-2 px-3 py-1.5 rounded-md border text-[13px] transition-all duration-150",
                menuOpen
                  ? "bg-brand-tint border-brand/30 text-brand-dark dark:text-white"
                  : "bg-surface border-line text-ink hover:bg-surface-hover",
              )}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <current.Icon size={14} className="shrink-0" />
                <span className="font-medium truncate">{current.label}</span>
              </span>
              <ChevronDown
                size={14}
                className={clsx(
                  "shrink-0 text-ink-soft transition-transform duration-200",
                  menuOpen && "rotate-180",
                )}
              />
            </button>

            {menuOpen && (
              <div
                ref={popRef}
                role="menu"
                className="absolute left-0 right-0 mt-1.5 z-50 rounded-lg border border-line bg-surface-alt shadow-lg overflow-hidden animate-fade-in"
              >
                <ul className="py-1">
                  {items.map(({ id, label, Icon }) => {
                    const active = page === id;
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          role="menuitem"
                          onClick={() => {
                            setPage(id);
                            setMenuOpen(false);
                          }}
                          className={clsx(
                            "w-full flex items-center gap-2 px-3 py-2 text-[13px] text-left transition-colors duration-150",
                            active
                              ? "bg-brand-tint text-brand-dark font-medium dark:text-white"
                              : "text-ink hover:bg-surface-hover",
                          )}
                        >
                          <Icon
                            size={14}
                            className={clsx(
                              "shrink-0",
                              active ? "text-brand dark:text-white" : "text-ink-soft",
                            )}
                          />
                          <span className="flex-1">{label}</span>
                          {active && (
                            <span className="w-1.5 h-1.5 rounded-full bg-brand dark:bg-white" />
                          )}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-line px-3 py-2 flex items-center justify-between text-[12px]">
                  <span className="text-ink-muted truncate min-w-0">
                    {user.name}
                    {user.username ? <span className="text-ink-subtle"> · @{user.username}</span> : null}
                  </span>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <ThemeToggle />
            <button
              onClick={onLogout}
              className="text-ink-muted hover:text-brand-dark dark:hover:text-white p-1.5 rounded-md hover:bg-brand-tint transition-colors duration-150"
              aria-label="Выйти"
              title="Выйти"
            >
              <LogOut size={14} />
            </button>
          </div>
        </div>
      </nav>

      {/* === Сайдбар: десктоп === */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-line bg-surface-alt h-screen sticky top-0 flex-col animate-fade-in">
        <div className="px-4 py-5">
          <Brand size={26} textClass="text-[16px] font-semibold" />
        </div>

        <div className="px-2 py-1 flex flex-col gap-0.5">
          {items.map(({ id, label, Icon }) => {
            const active = page === id;
            return (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={clsx(
                  "group flex items-center gap-2 px-2.5 py-1.5 rounded-md text-[14px] transition-all duration-150 text-left",
                  active
                    ? "bg-brand-tint text-brand-dark font-medium dark:text-white"
                    : "text-ink-muted hover:bg-surface-hover hover:text-ink",
                )}
              >
                <Icon
                  size={16}
                  className={clsx(
                    "shrink-0 transition-colors duration-150",
                    active
                      ? "text-brand dark:text-white"
                      : "text-ink-soft group-hover:text-ink-muted",
                  )}
                />
                {label}
              </button>
            );
          })}
        </div>

        <div className="px-3 mt-4 flex items-center justify-between">
          <span className="text-[12px] text-ink-muted">Тема</span>
          <ThemeToggle />
        </div>

        <div className="mt-auto border-t border-line px-3 py-3 flex items-center justify-between text-[13px]">
          <div className="min-w-0">
            <div className="truncate text-ink font-medium">{user.name}</div>
            {user.username && (
              <div className="truncate text-ink-subtle text-[12px]">@{user.username}</div>
            )}
          </div>
          <button
            onClick={onLogout}
            className="text-ink-muted hover:text-brand-dark dark:hover:text-white p-1.5 rounded-md hover:bg-brand-tint transition-colors duration-150"
            title="Выйти"
            aria-label="Выйти"
          >
            <LogOut size={14} />
          </button>
        </div>
      </aside>
    </>
  );
}

export type { Page };
