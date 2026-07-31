// Обертка над Telegram WebApp SDK: window.Telegram.WebApp.
// Если страница открыта НЕ внутри Telegram, объект отсутствует.

interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string>;
  viewportHeight?: number;
  /** Bot API 8.0+: отступы под системную панель и шапку Telegram. */
  safeAreaInset?: { top: number; bottom: number; left: number; right: number };
  contentSafeAreaInset?: { top: number; bottom: number; left: number; right: number };
  onEvent?: (event: string, cb: () => void) => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
    TelegramWebviewProxy?: unknown;
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  const tg = typeof window !== "undefined" ? window.Telegram?.WebApp : undefined;
  if (!tg) return null;
  // initData пуст, если страница открыта не из Telegram (например в браузере по прямой ссылке).
  if (!tg.initData || tg.initData.length === 0) return null;
  return tg;
}

export function isInsideTelegram(): boolean {
  return getTelegramWebApp() !== null;
}

/** Мы внутри Telegram — вопрос ВЁРСТКИ, а не авторизации.
 *
 *  Отдельно от getTelegramWebApp: тот требует непустой initData и возвращает
 *  null, если пользователь зашёл по сохранённому токену. Панель Telegram при
 *  этом никуда не девается, и шапка всё равно оказывается под ней — поэтому
 *  для отступа достаточно самого факта, что мы в его webview.
 */
export function isTelegramSurface(): boolean {
  if (typeof window === "undefined") return false;
  if (window.Telegram?.WebApp) return true;
  if (window.TelegramWebviewProxy) return true;
  return /Telegram/i.test(navigator.userAgent || "");
}

/** Помечает документ как открытый внутри Telegram и прокидывает высоту его шапки.
 *
 * В мини-приложении сверху висит панель Telegram («Закрыть», название бота),
 * а env(safe-area-inset-top) внутри его webview обычно равен нулю — из-за этого
 * наша шапка залезала под панель и кнопки было не нажать. Берём отступ из
 * Telegram, если он его сообщает, иначе используем запас из CSS.
 *
 * Значения приходят не сразу: expand() меняет вьюпорт асинхронно, а на старых
 * версиях contentSafeAreaInset не приходит вовсе — поэтому подписываемся на
 * события и пересчитываем, а до первого ответа работает запас.
 */
export function markTelegramViewport(): void {
  if (!isTelegramSurface()) return;
  const root = document.documentElement;
  root.dataset.tg = "1";

  const tg = window.Telegram?.WebApp;
  if (!tg) return;

  const apply = () => {
    const top = (tg.contentSafeAreaInset?.top ?? 0) + (tg.safeAreaInset?.top ?? 0);
    if (top > 0) root.style.setProperty("--tg-top", `${Math.round(top)}px`);
  };
  apply();
  for (const ev of ["safeAreaChanged", "contentSafeAreaChanged", "viewportChanged"]) {
    try {
      tg.onEvent?.(ev, apply);
    } catch {
      // старая версия SDK — обойдёмся запасом из CSS
    }
  }
}
