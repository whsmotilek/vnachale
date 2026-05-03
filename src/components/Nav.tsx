import { LayoutGrid, LineChart, LogOut } from "lucide-react";
import clsx from "clsx";
import { Brand } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

type Page = "orders" | "analytics";

const items: Array<{ id: Page; label: string; Icon: typeof LayoutGrid }> = [
  { id: "orders", label: "Заказы", Icon: LayoutGrid },
  { id: "analytics", label: "Аналитика", Icon: LineChart },
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
  return (
    <>
      {/* === Топ-бар: мобильный === */}
      <nav className="lg:hidden flex items-center justify-between border-b border-line bg-surface-alt px-3 py-2 gap-2 animate-fade-in">
        <Brand size={22} textClass="text-[14px] font-semibold" />
        <div className="flex gap-1">
          {items.map(({ id, label, Icon }) => {
            const active = page === id;
            return (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-[13px] transition-all duration-150",
                  active
                    ? "bg-brand-tint text-brand-dark font-medium dark:text-white"
                    : "text-ink-muted hover:bg-surface hover:text-ink",
                )}
              >
                <Icon size={14} className="shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <button
            onClick={onLogout}
            className="text-ink-muted hover:text-brand-dark dark:hover:text-white p-1.5 rounded-md hover:bg-brand-tint transition-colors duration-150 shrink-0"
            aria-label="Выйти"
            title="Выйти"
          >
            <LogOut size={14} />
          </button>
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
