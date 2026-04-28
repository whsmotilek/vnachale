import { useEffect, useRef, useState } from "react";
import { Brand } from "../components/Logo";
import { env, hasApi } from "../env";

export function Login({
  bootstrapError,
}: {
  onLoggedIn: () => void;
  bootstrapError?: string | null;
}) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [error] = useState<string | null>(bootstrapError ?? null);

  useEffect(() => {
    if (!widgetRef.current || !hasApi) return;
    // Redirect-flow: Telegram при успешной авторизации редиректит браузер
    // на data-auth-url с query-параметрами. Бэк проверяет подпись, выдаёт JWT
    // и редиректит обратно на сайт с токеном в #fragment.
    const callbackUrl = `${env.apiBaseUrl}/auth/telegram-callback`;
    const script = document.createElement("script");
    script.src = "https://telegram.org/js/telegram-widget.js?22";
    script.async = true;
    script.setAttribute("data-telegram-login", env.botUsername);
    script.setAttribute("data-size", "large");
    script.setAttribute("data-auth-url", callbackUrl);
    script.setAttribute("data-request-access", "write");
    script.setAttribute("data-radius", "8");
    widgetRef.current.innerHTML = "";
    widgetRef.current.appendChild(script);
  }, []);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-brand-veil">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-8 flex justify-center">
          <Brand size={44} glow textClass="text-[22px] font-semibold tracking-tighter2" />
        </div>

        <div className="card p-6 backdrop-blur-sm bg-surface/95">
          <h1 className="text-[15px] font-semibold tracking-tightish">
            Вход для админов и владельцев
          </h1>
          <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
            Менеджеры и фулфилмент сюда не входят — у них только Telegram-бот.
          </p>

          <div className="mt-6 flex flex-col items-center gap-3">
            {hasApi ? (
              <div ref={widgetRef} />
            ) : (
              <div className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 w-full">
                API на VPS ещё не подключён. Появится кнопка «Войти через
                Telegram» после настройки <code className="font-mono">VITE_API_BASE_URL</code> и
                <code className="font-mono"> /setdomain</code>.
              </div>
            )}
            {error && (
              <div className="text-[13px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-3 w-full animate-fade-in">
                {error}
              </div>
            )}
            <p className="text-[12px] text-ink-subtle text-center mt-1">
              Не получается войти? Напишите Матвею (
              <a
                href="https://t.me/whsmotilek"
                target="_blank"
                rel="noreferrer"
                className="text-brand hover:text-brand-hover underline-offset-2 hover:underline"
              >
                @whsmotilek
              </a>
              ).
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
