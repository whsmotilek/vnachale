/** Управление темой: светлая / тёмная. Сохраняется в localStorage. */

const STORAGE_KEY = "vnachale_theme";

export type Theme = "light" | "dark";

export function getStoredTheme(): Theme {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    if (v === "dark" || v === "light") return v;
  } catch {
    /* localStorage может быть недоступен — игнорируем */
  }
  // дефолт — система предпочитает тёмную? или всегда светлая?
  // Делаем светлую по умолчанию, чтобы UI был предсказуем для всех.
  return "light";
}

export function applyTheme(t: Theme): void {
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
}

export function setTheme(t: Theme): void {
  applyTheme(t);
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* noop */
  }
}

/** Подключаем тему до первой отрисовки React, чтобы не было «вспышки белым». */
export function bootstrapTheme(): void {
  applyTheme(getStoredTheme());
}
