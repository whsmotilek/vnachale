import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import clsx from "clsx";
import { getStoredTheme, setTheme, type Theme } from "../theme";

export function ThemeToggle({ className }: { className?: string }) {
  const [theme, setLocalTheme] = useState<Theme>("light");

  useEffect(() => {
    setLocalTheme(getStoredTheme());
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setLocalTheme(next);
    setTheme(next);
  }

  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggle}
      role="switch"
      aria-checked={isDark}
      title={isDark ? "Светлая тема" : "Тёмная тема"}
      className={clsx(
        "relative inline-flex items-center w-12 h-6 rounded-full transition-colors duration-200",
        "border border-line",
        isDark ? "bg-brand" : "bg-surface-alt",
        className,
      )}
    >
      <span
        className={clsx(
          "absolute top-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full transition-transform duration-200 ease-out",
          "bg-surface shadow-card",
          isDark ? "translate-x-[26px]" : "translate-x-0.5",
        )}
      >
        {isDark ? (
          <Moon size={11} className="text-brand-dark" />
        ) : (
          <Sun size={11} className="text-amber-500" />
        )}
      </span>
    </button>
  );
}
