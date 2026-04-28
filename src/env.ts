// Build-time env. Vite заменяет import.meta.env.VITE_* на значения при сборке.

export const env = {
  // URL API на VPS. Подставляется в GitHub Actions при сборке.
  apiBaseUrl: (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, ""),
  // Telegram bot username для Login Widget.
  botUsername: import.meta.env.VITE_BOT_USERNAME ?? "vnachale_manager_bot",
};

export const hasApi = env.apiBaseUrl !== "";
