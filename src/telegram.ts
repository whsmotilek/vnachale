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
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
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

/** Помечает документ как открытый внутри Telegram и прокидывает высоту его шапки.
 *
 * В мини-приложении сверху висит панель Telegram («Закрыть», название бота),
 * а env(safe-area-inset-top) внутри его WebView обычно равен нулю — из-за этого
 * наша шапка залезала под панель и кнопки было не нажать. Берём отступ из
 * Telegram, если он его сообщает, иначе используем запас из CSS.
 */
export function markTelegramViewport(): void {
  const tg = getTelegramWebApp();
  if (!tg) return;
  const root = document.documentElement;
  root.dataset.tg = "1";
  const top = (tg.contentSafeAreaInset?.top ?? 0) || (tg.safeAreaInset?.top ?? 0);
  if (top > 0) root.style.setProperty("--tg-top", `${Math.round(top)}px`);
}
