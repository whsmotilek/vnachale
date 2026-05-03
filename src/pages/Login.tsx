import { useEffect, useRef, useState } from "react";
import { Brand } from "../components/Logo";
import { api, setToken } from "../api";
import { env, hasApi } from "../env";

export function Login({
  onLoggedIn,
  bootstrapError,
}: {
  onLoggedIn: () => void;
  bootstrapError?: string | null;
}) {
  const widgetRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(bootstrapError ?? null);
  const [tab, setTab] = useState<"telegram" | "password">("telegram");

  useEffect(() => {
    if (!widgetRef.current || !hasApi || tab !== "telegram") return;
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
  }, [tab]);

  return (
    <main className="min-h-screen flex items-center justify-center px-6 bg-brand-veil">
      <div className="w-full max-w-sm animate-slide-up">
        <div className="mb-8 flex justify-center">
          <Brand size={44} glow textClass="text-[22px] font-semibold tracking-tighter2" />
        </div>

        <div className="card p-6 backdrop-blur-sm bg-surface/95">
          <h1 className="text-[15px] font-semibold tracking-tightish">Вход для владельцев</h1>
          <p className="mt-1 text-[13px] text-ink-muted leading-relaxed">
            Доступ только для администраторов бренда.
          </p>

          {/* Tabs */}
          <div className="mt-5 flex gap-1 p-0.5 bg-surface-alt border border-line rounded-md text-[12px]">
            <button
              type="button"
              onClick={() => setTab("telegram")}
              className={
                "flex-1 py-1.5 rounded transition-all " +
                (tab === "telegram"
                  ? "bg-surface text-ink font-medium shadow-card"
                  : "text-ink-muted hover:text-ink")
              }
            >
              Через Telegram
            </button>
            <button
              type="button"
              onClick={() => setTab("password")}
              className={
                "flex-1 py-1.5 rounded transition-all " +
                (tab === "password"
                  ? "bg-surface text-ink font-medium shadow-card"
                  : "text-ink-muted hover:text-ink")
              }
            >
              Логин и пароль
            </button>
          </div>

          <div className="mt-5">
            {tab === "telegram" ? (
              <div className="flex flex-col items-center gap-3">
                {hasApi ? (
                  <div ref={widgetRef} />
                ) : (
                  <div className="text-[13px] text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-3 w-full">
                    Сервис временно недоступен. Если ничего не меняется — напишите Матвею.
                  </div>
                )}
              </div>
            ) : (
              <PasswordForm onSuccess={onLoggedIn} setError={setError} />
            )}

            {error && (
              <div className="mt-3 text-[13px] text-rose-800 bg-rose-50 border border-rose-200 rounded-lg p-3 animate-fade-in">
                {error}
              </div>
            )}

            <p className="text-[12px] text-ink-subtle text-center mt-4">
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

function PasswordForm({
  onSuccess,
  setError,
}: {
  onSuccess: () => void;
  setError: (s: string | null) => void;
}) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { token } = await api.authPassword(username.trim(), password);
      setToken(token);
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error && /401/.test(err.message)
          ? "Неверный логин или пароль."
          : "Не удалось войти. Попробуйте еще раз.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2.5">
      <input
        type="text"
        autoComplete="username"
        placeholder="Логин"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        className="border border-line rounded-md px-3 py-2 text-[14px] bg-surface focus:outline-none focus:ring-2 focus:ring-brand/30"
        required
      />
      <input
        type="password"
        autoComplete="current-password"
        placeholder="Пароль"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="border border-line rounded-md px-3 py-2 text-[14px] bg-surface focus:outline-none focus:ring-2 focus:ring-brand/30"
        required
      />
      <button
        type="submit"
        disabled={busy || !username || !password}
        className="bg-brand text-white rounded-md px-3 py-2 text-[14px] font-medium hover:bg-brand-hover disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {busy ? "Входим…" : "Войти"}
      </button>
    </form>
  );
}
