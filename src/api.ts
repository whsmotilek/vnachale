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
  items: string;
  total: string;
  payment_status: string;
  delivery_method: string;
  pickup_point: string;
  delivery_address: string;
  city: string;
  track_number: string;
  shipped_at: string;
}

export interface AnalyticsResponse {
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
  async orders(): Promise<Order[]> {
    return request("/orders");
  },
  async analytics(): Promise<AnalyticsResponse> {
    return request("/analytics");
  },
};
