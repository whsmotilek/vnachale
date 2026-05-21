import { useEffect, useRef, useState } from "react";
import {
  Boxes, ChevronDown, ChevronRight, Globe, LayoutGrid, LineChart, LogOut, Sparkles, TrendingUp,
} from "lucide-react";
import clsx from "clsx";
import { Brand } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

type Page = "orders" | "preorders" | "stock" | "analytics" | "site" | "ozon" | "ozon_traffic";
type Role = "owner" | "manager" | "fulfillment" | "guest";

interface NavItem {
  id: Page;
  label: string;
  Icon: typeof LayoutGrid;
  /** Какие роли видят пункт. Если поле опущено — видит owner только. */
  roles?: Role[];
}

interface NavSection {
  id: "site_group" | "select_group";
  label: string;
  items: NavItem[];
}

/**
 * Двухуровневое меню:
 *   САЙТ
 *     ├ Заказы
 *     ├ Аналитика
 *     └ Трафик (Я.Метрика)
 *   СЕЛЕКТ
 *     └ Аналитика (Ozon)
 */
const SECTIONS: NavSection[] = [
  {
    id: "site_group",
    label: "Сайт",
    items: [
      { id: "orders", label: "Заказы", Icon: LayoutGrid, roles: ["owner", "manager", "fulfillment"] },
      { id: "preorders", label: "Предзаказы", Icon: Sparkles, roles: ["owner", "manager", "fulfillment"] },
      { id: "stock", label: "Склад", Icon: Boxes, roles: ["owner", "fulfillment"] },
      { id: "analytics", label: "Аналитика", Icon: LineChart, roles: ["owner"] },
      { id: "site", label: "Трафик", Icon: Globe, roles: ["owner"] },
    ],
  },
  {
    id: "select_group",
    label: "Селект",
    items: [
      { id: "ozon", label: "Аналитика", Icon: Sparkles, roles: ["owner"] },
      { id: "ozon_traffic", label: "Трафик", Icon: TrendingUp, roles: ["owner"] },
    ],
  },
];

/** Фильтруем секции по роли, выкидывая пустые секции целиком. */
function visibleSections(role: Role): NavSection[] {
  const out: NavSection[] = [];
  for (const s of SECTIONS) {
    const items = s.items.filter((it) => !it.roles || it.roles.includes(role));
    if (items.length > 0) out.push({ ...s, items });
  }
  return out;
}

function findItem(id: Page, sections: NavSection[]): { item: NavItem; section: NavSection } | null {
  for (const s of sections) {
    for (const it of s.items) {
      if (it.id === id) return { item: it, section: s };
    }
  }
  return null;
}

export function Nav({
  page,
  setPage,
  user,
  onLogout,
}: {
  page: Page;
  setPage: (p: Page) => void;
  user: { name: string; username?: string; role: Role };
  onLogout: () => void;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  const popRef = useRef<HTMLDivElement | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const sections = visibleSections(user.role);

  // Закрытие dropdown по клику снаружи / Esc
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

  const current = findItem(page, sections);

  return (
    <>
      {/* === Мобильный топ-бар === */}
      <nav className="lg:hidden sticky top-0 z-40 border-b border-line bg-surface-alt/95 backdrop-blur-sm safe-top animate-fade-in">
        <div className="flex items-center justify-between gap-2 px-3 pt-1 pb-2">
          <Brand size={22} textClass="text-[14px] font-semibold" />

          <div className="relative flex-1 max-w-[260px]">
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
                {current && <current.item.Icon size={14} className="shrink-0" />}
                <span className="truncate">
                  {current ? (
                    <>
                      <span className="text-ink-soft text-[11px]">{current.section.label}</span>
                      {" · "}
                      <span className="font-medium">{current.item.label}</span>
                    </>
                  ) : (
                    "—"
                  )}
                </span>
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
                  {sections.map((sec) => (
                    <li key={sec.id}>
                      <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-ink-subtle font-medium">
                        {sec.label}
                      </div>
                      <ul>
                        {sec.items.map(({ id, label, Icon }) => {
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
                                  "w-full flex items-center gap-2 pl-5 pr-3 py-2 text-[13px] text-left transition-colors duration-150",
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
                    </li>
                  ))}
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

      {/* === Десктоп: сайдбар с группами === */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-line bg-surface-alt h-screen sticky top-0 flex-col animate-fade-in">
        <div className="px-4 py-5">
          <Brand size={26} textClass="text-[16px] font-semibold" />
        </div>

        <div className="px-2 py-1 flex flex-col gap-3">
          {sections.map((sec) => (
            <div key={sec.id}>
              <div className="px-2 mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-ink-subtle font-medium">
                <ChevronRight size={10} className="text-ink-soft" />
                {sec.label}
              </div>
              <div className="flex flex-col gap-0.5">
                {sec.items.map(({ id, label, Icon }) => {
                  const active = page === id;
                  return (
                    <button
                      key={id}
                      onClick={() => setPage(id)}
                      className={clsx(
                        "group flex items-center gap-2 pl-4 pr-2.5 py-1.5 rounded-md text-[14px] transition-all duration-150 text-left",
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
            </div>
          ))}
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
