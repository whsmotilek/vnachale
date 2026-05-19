import { env } from "./env";

const TOKEN_KEY = "vnachale_jwt";

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  if (!env.apiBaseUrl) {
    throw new ApiError(0, "Сервис временно недоступен");
  }
  const token = getToken();
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new ApiError(res.status, text || res.statusText);
  }
  return (await res.json()) as T;
}

// === типы данных ===

export interface Order {
  order_id: string;
  created_at: string;
  status: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  items: string;
  total: string;
  payment_status: string;
  delivery_method: string;
  pickup_point: string;
  delivery_address: string;
  city: string;
  customer_comment: string;
  internal_note: string;
  assigned_to: string;
  track_number: string;
  shipped_at: string;
  delivered_at: string;
  source: string;
}

export interface AnalyticsResponse {
  period: string;
  period_from: string | null;
  period_to: string | null;
  lifetime_revenue: number;
  lifetime_orders: number;
  total_revenue: number;
  today_revenue: number;
  week_revenue: number;
  month_revenue: number;
  aov: number;
  pending_count: number;
  total_orders: number;
  unique_customers: number;
  repeat_customers: number;
  repeat_rate: number;
  conversion_rate: number;
  refund_rate: number;
  status_counts: Record<string, number>;
  top_cities: Array<[string, number]>;
  top_products: Array<[string, number]>;
  top_sizes: Array<[string, number]>;
  delivery_methods: Array<[string, number]>;
  daily_revenue: Array<{ date: string; revenue: number; orders: number }>;
}

export interface SiteAnalyticsResponse {
  period: string;
  period_from: string;
  period_to: string;
  // KPI
  visits: number;
  users: number;
  pageviews: number;
  bounce_rate: number;             // %
  avg_visit_duration_sec: number;
  page_depth: number;
  // Конверсии
  purchases: number;
  add_to_carts: number;
  payment_returns: number;
  conv_to_purchase_pct: number;
  conv_to_cart_pct: number;
  cart_to_purchase_pct: number;
  // E-commerce агрегаты
  ecom_purchases: number;
  ecom_revenue: number;
  // Разрезы
  daily: Array<{ date: string; visits: number; users: number }>;
  sources: Array<[string, number]>;
  devices: Array<[string, number]>;
  top_pages: Array<[string, number]>;
  top_cities: Array<[string, number]>;
}

export interface OzonAnalyticsResponse {
  period: string;
  period_from: string | null;
  period_to: string | null;
  lifetime_revenue: number;
  lifetime_postings: number;
  total_revenue: number;
  total_commission: number;
  total_payout: number;
  total_postings: number;
  today_revenue: number;
  week_revenue: number;
  month_revenue: number;
  aov: number;
  cancel_rate: number;
  cancelled_count: number;
  status_counts: Record<string, number>;
  scheme_counts: Record<string, number>;
  top_cities: Array<[string, number]>;
  top_warehouses: Array<[string, number]>;
  top_products: Array<[string, number]>;
  top_skus: Array<[string, number]>;
  daily_revenue: Array<{ date: string; revenue: number; orders: number }>;
}

// === методы ===

export const api = {
  async authTelegram(payload: Record<string, unknown>): Promise<{ token: string }> {
    return request("/auth/telegram", { method: "POST", body: JSON.stringify(payload) });
  },
  async authTelegramWebApp(initData: string): Promise<{ token: string }> {
    return request("/auth/telegram-webapp", {
      method: "POST",
      body: JSON.stringify({ init_data: initData }),
    });
  },
  async authPassword(username: string, password: string): Promise<{ token: string }> {
    return request("/auth/password", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    });
  },
  async orders(): Promise<Order[]> {
    return request("/orders");
  },
  async analytics(opts?: {
    period?: string;
    from?: string;
    to?: string;
  }): Promise<AnalyticsResponse> {
    const qs = new URLSearchParams();
    if (opts?.period) qs.set("period", opts.period);
    if (opts?.from) qs.set("period_from", opts.from);
    if (opts?.to) qs.set("period_to", opts.to);
    const tail = qs.toString();
    return request(`/analytics${tail ? "?" + tail : ""}`);
  },
  async siteAnalytics(opts?: {
    period?: string;
    from?: string;
    to?: string;
  }): Promise<SiteAnalyticsResponse> {
    const qs = new URLSearchParams();
    if (opts?.period) qs.set("period", opts.period);
    if (opts?.from) qs.set("period_from", opts.from);
    if (opts?.to) qs.set("period_to", opts.to);
    const tail = qs.toString();
    return request(`/site/analytics${tail ? "?" + tail : ""}`);
  },
  async ozonAnalytics(opts?: {
    period?: string;
    from?: string;
    to?: string;
  }): Promise<OzonAnalyticsResponse> {
    const qs = new URLSearchParams();
    if (opts?.period) qs.set("period", opts.period);
    if (opts?.from) qs.set("period_from", opts.from);
    if (opts?.to) qs.set("period_to", opts.to);
    const tail = qs.toString();
    return request(`/ozon/analytics${tail ? "?" + tail : ""}`);
  },
  async updateOrderStatus(orderId: string, newStatus: string): Promise<void> {
    await request(`/orders/${encodeURIComponent(orderId)}/status`, {
      method: "PATCH",
      body: JSON.stringify({ status: newStatus }),
    });
  },
  async updateOrderTrack(orderId: string, trackNumber: string): Promise<void> {
    await request(`/orders/${encodeURIComponent(orderId)}/track`, {
      method: "PATCH",
      body: JSON.stringify({ track_number: trackNumber }),
    });
  },
};
