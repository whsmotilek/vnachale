import { useEffect, useState } from "react";
import { Nav, type Page } from "./components/Nav";
import { Login } from "./pages/Login";
import { Orders } from "./pages/Orders";
import { Analytics } from "./pages/Analytics";
import { Site } from "./pages/Site";
import { Ozon } from "./pages/Ozon";
import { api, ApiError, clearToken, getToken, setToken } from "./api";
import { getTelegramWebApp } from "./telegram";

export type Role = "owner" | "manager" | "fulfillment" | "guest";

interface SessionUser {
  id: number;
  name: string;
  username?: string;
  role: Role;
}

function decodeJwtPayload(token: string): SessionUser | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (json.exp && json.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof json.id !== "number") return null;
    const role = (typeof json.role === "string" ? json.role : "owner").toLowerCase() as Role;
    return {
      id: json.id,
      name: json.name ?? `id${json.id}`,
      username: json.username,
      // Backward-compat: старые JWT без role — считаем owner (раньше доступ был только у них)
      role: (role === "owner" || role === "manager" || role === "fulfillment") ? role : "owner",
    };
  } catch {
    return null;
  }
}

// Какие страницы разрешены для каждой роли
function isPageAllowed(page: Page, role: Role): boolean {
  if (role === "owner") return true;
  if (role === "fulfillment") return page === "orders";
  if (role === "manager") return page === "orders";
  return false;
}

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>(() => {
    const hash = window.location.hash.replace(/^#\/?/, "") as Page;
    if (hash === "analytics" || hash === "ozon" || hash === "site") return hash;
    return "orders";
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const hashMatch = window.location.hash.match(/[#&]token=([^&]+)/);
      if (hashMatch) {
        const token = decodeURIComponent(hashMatch[1]);
        const u = decodeJwtPayload(token);
        if (u) {
          setToken(token);
          history.replaceState(null, "", window.location.pathname + window.location.search);
          if (!cancelled) {
            setUser(u);
            setBootstrapping(false);
          }
          return;
        }
      }
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

  // Если роль не пускает на текущую страницу — перенаправляем на разрешённую
  useEffect(() => {
    if (!user) return;
    if (!isPageAllowed(page, user.role)) {
      setPage("orders");
    }
  }, [user, page]);

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
        user={{ name: user.name, username: user.username, role: user.role }}
        onLogout={() => {
          clearToken();
          setUser(null);
        }}
      />
      <main className="flex-1 min-w-0">
        {page === "orders" ? (
          <Orders readOnly={user.role !== "owner"} />
        ) : page === "ozon" && user.role === "owner" ? (
          <Ozon />
        ) : page === "site" && user.role === "owner" ? (
          <Site />
        ) : page === "analytics" && user.role === "owner" ? (
          <Analytics />
        ) : (
          <Orders readOnly />
        )}
      </main>
    </div>
  );
}
