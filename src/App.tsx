import { useEffect, useState } from "react";
import { Nav, type Page } from "./components/Nav";
import { Login } from "./pages/Login";
import { Orders } from "./pages/Orders";
import { Analytics } from "./pages/Analytics";
import { api, ApiError, clearToken, getToken, setToken } from "./api";
import { getTelegramWebApp } from "./telegram";

interface SessionUser {
  id: number;
  name: string;
  username?: string;
}

function decodeJwtPayload(token: string): SessionUser | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (json.exp && json.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof json.id !== "number") return null;
    return { id: json.id, name: json.name ?? `id${json.id}`, username: json.username };
  } catch {
    return null;
  }
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>(() => {
    const hash = window.location.hash.replace(/^#\/?/, "") as Page;
    return hash === "analytics" ? "analytics" : "orders";
  });

  // Bootstrap: если есть валидный JWT — используем его. Иначе если мы внутри Telegram —
  // пытаемся auto-auth через initData. Иначе показываем Login Widget.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const existing = getToken();
      if (existing) {
        const u = decodeJwtPayload(existing);
        if (u) {
          if (!cancelled) {
            setUser(u);
            setBootstrapping(false);
          }
          return;
        }
        clearToken();
      }

      const tg = getTelegramWebApp();
      if (tg) {
        try {
          tg.ready();
          tg.expand();
          const { token } = await api.authTelegramWebApp(tg.initData);
          if (cancelled) return;
          setToken(token);
          setUser(decodeJwtPayload(token));
        } catch (e) {
          if (cancelled) return;
          setBootstrapError(
            e instanceof ApiError ? `API: ${e.message}` : e instanceof Error ? e.message : String(e),
          );
        }
      }
      if (!cancelled) setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    window.location.hash = `/${page}`;
  }, [page]);

  if (bootstrapping) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-ink-muted text-[14px]">Авторизация…</div>
      </div>
    );
  }

  if (!user) {
    return (
      <Login
        bootstrapError={bootstrapError}
        onLoggedIn={() => {
          const t = getToken();
          if (t) setUser(decodeJwtPayload(t));
        }}
      />
    );
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen">
      <Nav
        page={page}
        setPage={setPage}
        user={{ name: user.name, username: user.username }}
        onLogout={() => {
          clearToken();
          setUser(null);
        }}
      />
      <main className="flex-1 min-w-0">{page === "orders" ? <Orders /> : <Analytics />}</main>
    </div>
  );
}
