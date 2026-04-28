import { LayoutGrid, LineChart, LogOut } from "lucide-react";
import clsx from "clsx";
import { Logo } from "./Logo";

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
      {/* === Топ-бар: мобильный (Telegram WebApp) === */}
      <nav className="lg:hidden flex items-center justify-between border-b border-line bg-surface-alt px-3 py-2 gap-2">
        <div className="flex items-center gap-2 shrink-0">
          <Logo size={24} />
          <span className="font-semibold text-[14px] tracking-tight">Vnachale</span>
        </div>
        <div className="flex gap-1">
          {items.map(({ id, label, Icon }) => {
            const active = page === id;
            return (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={clsx(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[13px] transition-colors",
                  active
                    ? "bg-surface text-ink font-medium border border-line"
                    : "text-ink-muted hover:bg-surface hover:text-ink",
                )}
              >
                <Icon size={14} className="shrink-0" />
                {label}
              </button>
            );
          })}
        </div>
        <button
          onClick={onLogout}
          className="text-ink-muted hover:text-ink p-1.5 rounded hover:bg-surface shrink-0"
          aria-label="Выйти"
          title="Выйти"
        >
          <LogOut size={14} />
        </button>
      </nav>

      {/* === Сайдбар: десктоп === */}
      <aside className="hidden lg:flex w-60 shrink-0 border-r border-line bg-surface-alt h-screen sticky top-0 flex-col">
        <div className="px-4 py-5 flex items-center gap-2.5">
          <Logo size={26} />
          <div className="font-semibold text-[15px] tracking-tight">Vnachale</div>
        </div>

        <div className="px-2 py-1 flex flex-col gap-0.5">
          {items.map(({ id, label, Icon }) => {
            const active = page === id;
            return (
              <button
                key={id}
                onClick={() => setPage(id)}
                className={clsx(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded text-[14px] transition-colors text-left",
                  active
                    ? "bg-surface-hover text-ink font-medium"
                    : "text-ink-muted hover:bg-surface-hover hover:text-ink",
                )}
              >
                <Icon size={16} className="shrink-0" />
                {label}
              </button>
            );
          })}
        </div>

        <div className="mt-auto border-t border-line px-3 py-3 flex items-center justify-between text-[13px]">
          <div className="min-w-0">
            <div className="truncate text-ink font-medium">{user.name}</div>
            {user.username && <div className="truncate text-ink-subtle">@{user.username}</div>}
          </div>
          <button
            onClick={onLogout}
            className="text-ink-muted hover:text-ink p-1 rounded hover:bg-surface-hover"
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
