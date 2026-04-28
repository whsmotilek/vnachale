import { useEffect, useRef, useState } from "react";
import { Logo } from "../components/Logo";
import { api, setToken } from "../api";
import { env, hasApi } from "../env";

declare global {
  interface Window {
    onTelegramAuth?: (user: unknown) => void;
  }
}

export function Login({
  onLoggedIn,
  bootstrapError,
}: {
  onLoggedIn: () => void;
  bootstrapError?: string | null;
}) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(bootstrapError ?? null);

  useEffect(() => {
    if (!widgetRef.current || !hasApi) return;
    window.onTelegramAuth = async (user) => {
      try {
        const { token } = await api.authTelegram(user as Record<string, unknown>);
        setToken(token);
        onLoggedIn();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    };
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", env.botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-onauth", "onTelegramAuth(user)");
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-radius", "6");
    widgetRef.current.innerHTML = "";
    widgetRef.current.appendChild(script);
    return () => { delete window.onTelegramAuth; };
  }, [onLoggedIn]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6">
      <div className="w-full max-w-sm">
        <div className="flex items-center gap-3 mb-8 justify-center">
          <Logo size={40} />
          <div className="text-xl font-semibold tracking-tight">Vnachale</div>
        </div>

        <div className="card p-6">
          <h1 className="text-base font-semibold">Вход для админов и владельцев</h1>
          <p className="mt-1 text-[13px] text-ink-muted">
            Менеджеры и фулфилмент сюда не входят — у них только Telegram-бот.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            {hasApi ? (
              <div ref={widgetRef} />
            ) : (
              <div className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded p-3 w-full">
                API на VPS ещё не подключён. После настройки <code>VITE_API_BASE_URL</code> и
                <code> /setdomain</code> в @BotFather здесь появится кнопка «Войти через Telegram».
              </div>
            )}
            {error && (
              <div className="text-[13px] text-rose-800 bg-rose-50 border border-rose-200 rounded p-3 w-full">
                {error}
              </div>
            )}
            <p className="text-[12px] text-ink-subtle text-center mt-2">
              Не получается войти? Напишите Матвею (@whsmotilek).
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
