// Обертка над Telegram WebApp SDK: window.Telegram.WebApp.
// Если страница открыта НЕ внутри Telegram, объект отсутствует.

interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  colorScheme?: "light" | "dark";
  themeParams?: Record<string, string>;
  viewportHeight?: number;
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
