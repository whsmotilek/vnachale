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

export interface StockRow {
  sku: string;
  name: string;
  size: string;
  barcode: string;
  stock: number;
  reserved: number;
  available: number;
  min_stock: number;
  snapshot_date: string;
  display_model: string;
  display_color: string;
  display_size: string;
}

export interface StockAdjustResult {
  status: "ok";
  sku: string;
  old_stock: number;
  new_stock: number;
  delta: number;
  reserved: number;
  available: number;
}

export interface ProductBreakdown {
  name: string;
  orders: number;
  units: number;
  revenue: number;
  colors: Array<[string, number]>;
  sizes: Array<[string, number]>;
  cities?: Array<[string, number]>;
}

export interface SiteAnalyticsResponse {
  period: string;
  period_from: string;
  period_to: string;
  product_filter: string | null;
  available_products: string[];
  // KPI
  visits: number;
  users: number;
  pageviews: number;
  bounce_rate: number;             // %
  avg_visit_duration_sec: number;
  page_depth: number;
  // Конверсии (по целям Метрики)
  purchases: number;
  add_to_carts: number;
  payment_returns: number;
  conv_to_purchase_pct: number;
  conv_to_cart_pct: number;
  cart_to_purchase_pct: number;
  // E-commerce агрегаты Метрики (НЕ показываем — может быть с накруткой за счёт отмен)
  ecom_purchases: number;
  ecom_revenue: number;
  // Реальная выручка (из «Заказы» Sheets — наш источник правды)
  real_revenue: number;
  real_orders: number;
  real_aov: number;
  real_conversion_pct: number;
  // Разрезы
  daily: Array<{ date: string; visits: number; users: number }>;
  daily_real: Array<{ date: string; revenue: number; orders: number }>;
  sources: Array<[string, number]>;
  devices: Array<[string, number]>;
  top_pages: Array<[string, number]>;
  top_cities: Array<[string, number]>;
  products: ProductBreakdown[];
}

export interface OzonPremiumWeek {
  period_from: string;
  period_to: string;
  search_users: number;
  position: number;
  view_users: number;
  conversion_pct: number;
  gmv: number;
}

export interface OzonTopQuery {
  query: string;
  position: number;
  search_users: number;
  view_users: number;
}

export interface OzonCard {
  sku: string;
  model: string;
  color: string;
  size: string;
  units_total: number;
  units_delivered: number;
  units_delivering: number;
  units_cancelled: number;
  cancel_rate: number;
  revenue_realized: number;
  revenue_cancelled: number;
  payout: number;
  commission: number;
  velocity_per_day: number;
  days_since_last_sale: number | null;
  first_sale: string | null;
  last_sale: string | null;
  top_city: string;
  distinct_cities: number;
  postings_count: number;
  stock: number;
  available: number;
  days_to_stockout: number | null;
  tags: string[];
  // Premium-метрики (могут быть null если Premium недоступен)
  search_users: number | null;       // уник. пользователи, видевшие карточку в поиске (дедуп 1x/день)
  position: number | null;            // средняя позиция по топ-10 запросов товара (меньше = выше)
  position_delta: number | null;      // prev_position - current_position. + = поднялась к топу, - = упала вниз
  view_users: number | null;          // уник. пользователи, открывшие карточку
  view_conversion_pct: number | null; // конверсия в покупку через поиск (из Ozon API, НЕ CTR показ→PDP)
  click_conversion_pct: number | null;// CTR показ→PDP (наш расчёт = view_users / search_users * 100)
  premium_period: string | null;
  premium_history: OzonPremiumWeek[];
  // Топ поисковых запросов (из /v1/analytics/product-queries/details)
  top_queries: OzonTopQuery[];
  // Из /v1/analytics/turnover/stocks
  ozon_grade: "green" | "yellow" | "red" | null;  // IDC грейд карточки
  turnover_days: number | null;                    // средний срок продажи остатка
  ads_per_day: number | null;                      // average daily sales
  // Возвраты (только настоящие ClientReturn)
  returned_count: number;
  returned_value: number;
  top_return_reasons: Array<[string, number]>;
  // Content rating — заполненность карточки от Ozon (0-100)
  content_rating: number | null;
  content_media: number | null;
  content_text: number | null;
  content_attributes: number | null;
}

export type ExecSummaryKind = "win" | "urgent" | "warning" | "opportunity" | "info";

export interface ExecSummaryItem {
  kind: ExecSummaryKind;
  icon: string;
  text: string;
  sku?: string;
}

export interface ModelCross {
  name: string;
  sku_count: number;
  skus_silent: number;
  units_sold: number;
  revenue: number;
  avg_ticket: number;
  cancel_rate: number;
  search_users: number;
  view_users: number;
  avg_position: number | null;
  avg_conversion_pct: number | null;
  stock: number;
  colors: Array<[string, number]>;
  sizes: Array<[string, number]>;
  top_color: [string, number] | null;
  top_size: [string, number] | null;
}

export interface OzonCardsResponse {
  period: string;
  period_from: string | null;
  period_to: string | null;
  period_days: number;
  total_skus: number;
  active_skus: number;
  silent_skus: number;
  high_cancel_skus: number;
  stock_risk_skus: number;
  total_revenue: number;
  total_units: number;
  has_premium_data: boolean;
  cards: OzonCard[];
  top_movers: OzonCard[];
  slow_movers: OzonCard[];
  high_cancel: OzonCard[];
  at_risk: OzonCard[];
  position_dropping: OzonCard[];
  low_ctr: OzonCard[];
  executive_summary: ExecSummaryItem[];
  models_cross: ModelCross[];
}

export interface ClusterBreakdown {
  cluster: string;
  revenue: number;
  orders: number;
  local_pct: number;
}

export interface ActionBreakdown {
  name: string;
  revenue: number;
  orders: number;
}

export interface OzonAnalyticsResponse {
  period: string;
  period_from: string | null;
  period_to: string | null;
  product_filter: string | null;
  available_products: string[];
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
  // Возвраты (только настоящие ClientReturn, без отказов на доставке)
  returns_count: number;
  returns_value: number;
  top_return_reasons: Array<[string, number]>;
  // Новые метрики из расширенного sync_ozon
  promotion_share_pct: number;
  promotion_revenue: number;
  promotion_postings: number;
  local_share_pct: number;
  local_revenue: number;
  cross_revenue: number;
  premium_share_pct: number;
  top_actions: ActionBreakdown[];
  cluster_breakdown: ClusterBreakdown[];
  // Существующие
  status_counts: Record<string, number>;
  scheme_counts: Record<string, number>;
  top_cities: Array<[string, number]>;
  top_warehouses: Array<[string, number]>;
  top_products: Array<[string, number]>;
  top_skus: Array<[string, number]>;
  daily_revenue: Array<{ date: string; revenue: number; orders: number }>;
  products: ProductBreakdown[];
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
  async stock(): Promise<StockRow[]> {
    return request("/stock");
  },
  async downloadStockCsv(): Promise<void> {
    // Качаем CSV blob с auth-заголовком и триггерим скачивание.
    if (!env.apiBaseUrl) throw new ApiError(0, "API недоступен");
    const token = getToken();
    const res = await fetch(`${env.apiBaseUrl}/stock/export.csv`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) {
      throw new ApiError(res.status, await res.text().catch(() => "Не удалось скачать CSV"));
    }
    const blob = await res.blob();
    // Имя файла берём из Content-Disposition, иначе дефолт
    const cd = res.headers.get("Content-Disposition") || "";
    const m = cd.match(/filename="([^"]+)"/);
    const filename = m ? m[1] : "vnachale-stock.csv";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  },
  async adjustStock(
    sku: string,
    delta: number,
    opts?: { reason?: string; expectedStock?: number },
  ): Promise<StockAdjustResult> {
    return request("/stock/adjust", {
      method: "POST",
      body: JSON.stringify({
        sku,
        delta,
        reason: opts?.reason,
        expected_stock: opts?.expectedStock,
      }),
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
    product?: string;
  }): Promise<SiteAnalyticsResponse> {
    const qs = new URLSearchParams();
    if (opts?.period) qs.set("period", opts.period);
    if (opts?.from) qs.set("period_from", opts.from);
    if (opts?.to) qs.set("period_to", opts.to);
    if (opts?.product) qs.set("product", opts.product);
    const tail = qs.toString();
    return request(`/site/analytics${tail ? "?" + tail : ""}`);
  },
  async ozonCards(opts?: {
    period?: string;
    from?: string;
    to?: string;
  }): Promise<OzonCardsResponse> {
    const qs = new URLSearchParams();
    if (opts?.period) qs.set("period", opts.period);
    if (opts?.from) qs.set("period_from", opts.from);
    if (opts?.to) qs.set("period_to", opts.to);
    const tail = qs.toString();
    return request(`/ozon/cards${tail ? "?" + tail : ""}`);
  },
  async ozonAnalytics(opts?: {
    period?: string;
    from?: string;
    to?: string;
    product?: string;
  }): Promise<OzonAnalyticsResponse> {
    const qs = new URLSearchParams();
    if (opts?.period) qs.set("period", opts.period);
    if (opts?.from) qs.set("period_from", opts.from);
    if (opts?.to) qs.set("period_to", opts.to);
    if (opts?.product) qs.set("product", opts.product);
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
