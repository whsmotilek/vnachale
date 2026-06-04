import { useEffect, useState } from "react";
import { Nav, type Page } from "./components/Nav";
import { Login } from "./pages/Login";
import { AllOrders } from "./pages/AllOrders";
import { Orders } from "./pages/Orders";
import { Preorders } from "./pages/Preorders";
import { Stock } from "./pages/Stock";
import { Analytics } from "./pages/Analytics";
import { Site } from "./pages/Site";
import { Ozon } from "./pages/Ozon";
import { OzonTraffic } from "./pages/OzonTraffic";
import { api, ApiError, clearToken, getToken, setToken } from "./api";
import { getTelegramWebApp } from "./telegram";

export type Role = "owner" | "manager" | "fulfillment" | "guest";
export type Warehouse = "our" | "ff" | "both";

interface SessionUser {
  id: number;
  name: string;
  username?: string;
  role: Role;
  warehouse: Warehouse;
}

function decodeJwtPayload(token: string): SessionUser | null {
  try {
    const [, payload] = token.split(".");
    if (!payload) return null;
    const json = JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    if (json.exp && json.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof json.id !== "number") return null;
    const role = (typeof json.role === "string" ? json.role : "owner").toLowerCase() as Role;
    const safeRole: Role =
      role === "owner" || role === "manager" || role === "fulfillment" ? role : "owner";
    const wh = (typeof json.warehouse === "string" ? json.warehouse : "").toLowerCase();
    const warehouse: Warehouse =
      wh === "our" || wh === "ff" || wh === "both"
        ? (wh as Warehouse)
        // Backward-compat: старые JWT без warehouse — owner видит оба, иначе наш склад
        : safeRole === "owner"
          ? "both"
          : "our";
    return {
      id: json.id,
      name: json.name ?? `id${json.id}`,
      username: json.username,
      // Backward-compat: старые JWT без role — считаем owner (раньше доступ был только у них)
      role: safeRole,
      warehouse,
    };
  } catch {
    return null;
  }
}

// Какие страницы разрешены для каждой роли + склада
function isPageAllowed(page: Page, role: Role, warehouse: Warehouse): boolean {
  if (role === "owner") return true;
  if (role === "fulfillment") {
    const our = warehouse === "our" || warehouse === "both";
    const ff = warehouse === "ff" || warehouse === "both";
    if (page === "orders") return our;       // наш склад → обычные заказы
    if (page === "stock") return our;
    if (page === "preorders") return ff;     // ФФ → «Заказы ФФ»
    if (page === "stock_ff") return ff;
    return false;
  }
  if (role === "manager") return page === "orders";
  return false;
}

const VALID_HASHES: ReadonlyArray<Page> = [
  "orders_all", "orders", "preorders", "stock", "stock_ff", "analytics", "site", "ozon", "ozon_traffic",
];

export default function App() {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [bootstrapping, setBootstrapping] = useState(true);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const [page, setPage] = useState<Page>(() => {
    const hash = window.location.hash.replace(/^#\/?/, "") as Page;
    if (VALID_HASHES.includes(hash)) return hash;
    // Дефолт — общая «Заказы» (owner). Не-owner редиректнутся на свою через isPageAllowed.
    return "orders_all";
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
      // Telegram Mini App: ВСЕГДА берём свежий токен через initData — права
      // (роль/склад) могли измениться, кэш в localStorage может быть устаревшим.
      const tg = getTelegramWebApp();
      if (tg) {
        try {
          tg.ready();
          tg.expand();
          const { token } = await api.authTelegramWebApp(tg.initData);
          if (cancelled) return;
          setToken(token);
          setUser(decodeJwtPayload(token));
          setBootstrapping(false);
          return;
        } catch (e) {
          // initData не сработал — пробуем кэш ниже как fallback
          if (cancelled) return;
          if (!getToken()) {
            setBootstrapError(
              e instanceof ApiError ? `API: ${e.message}` : e instanceof Error ? e.message : String(e),
            );
          }
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
      if (!cancelled) setBootstrapping(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Если роль не пускает на текущую страницу — перенаправляем на разрешённую
  useEffect(() => {
    if (!user) return;
    if (!isPageAllowed(page, user.role, user.warehouse)) {
      // fulfillment со складом ФФ начинает с «Заказы ФФ», остальные — с «Заказы»
      if (user.role === "fulfillment" && user.warehouse === "ff") setPage("preorders");
      else setPage("orders");
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
        user={{ id: user.id, name: user.name, username: user.username, role: user.role, warehouse: user.warehouse }}
        onLogout={() => {
          clearToken();
          setUser(null);
        }}
      />
      <main className="flex-1 min-w-0">
        {page === "orders_all" && user.role === "owner" ? (
          <AllOrders />
        ) : page === "orders" ? (
          <Orders />
        ) : page === "preorders" ? (
          <Preorders />
        ) : page === "stock" &&
          (user.role === "owner" ||
            (user.role === "fulfillment" && (user.warehouse === "our" || user.warehouse === "both"))) ? (
          <Stock warehouse="our" />
        ) : page === "stock_ff" &&
          (user.role === "owner" ||
            (user.role === "fulfillment" && (user.warehouse === "ff" || user.warehouse === "both"))) ? (
          <Stock warehouse="ff" />
        ) : page === "ozon" && user.role === "owner" ? (
          <Ozon />
        ) : page === "ozon_traffic" && user.role === "owner" ? (
          <OzonTraffic />
        ) : page === "site" && user.role === "owner" ? (
          <Site />
        ) : page === "analytics" && user.role === "owner" ? (
          <Analytics />
        ) : (
          <Orders />
        )}
      </main>
    </div>
  );
}
