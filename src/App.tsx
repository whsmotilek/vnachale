import { useEffect, useState } from "react";
import { Nav, type Page } from "./components/Nav";
import { Login } from "./pages/Login";
import { Orders } from "./pages/Orders";
import { Analytics } from "./pages/Analytics";
import { clearToken, getToken } from "./api";

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
  const [page, setPage] = useState<Page>(() => {
    const hash = window.location.hash.replace(/^#\/?/, "") as Page;
    return hash === "analytics" ? "analytics" : "orders";
  });

  useEffect(() => {
    const token = getToken();
    if (token) setUser(decodeJwtPayload(token));
  }, []);

  useEffect(() => {
    window.location.hash = `/${page}`;
  }, [page]);

  if (!user) {
    return <Login onLoggedIn={() => {
      const t = getToken();
      if (t) setUser(decodeJwtPayload(t));
    }} />;
  }

  return (
    <div className="flex min-h-screen">
      <Nav
        page={page}
        setPage={setPage}
        user={{ name: user.name, username: user.username }}
        onLogout={() => { clearToken(); setUser(null); }}
      />
      <main className="flex-1 min-w-0">
        {page === "orders" ? <Orders /> : <Analytics />}
      </main>
    </div>
  );
}
