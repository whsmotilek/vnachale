# Vnachale — webapp

Статичная админ-панель для владельцев и админов бренда Vnachale. Деплоится на GitHub Pages, данные тянет с API на VPS.

## Архитектура

```
GitHub Pages (static SPA)        VPS (FastAPI)               Google Sheets
   whsmotilek.github.io     ───>  api.<sslip>          ───>     «Заказы»
        /vnachale/                  /auth/telegram                «Журнал»
                                    /orders
                                    /analytics
                                                                  Telegram Bot
                                                                  (отдельный сервис на VPS)
```

- На фронте секретов нет — только публичные данные (bot username).
- `BOT_TOKEN` и ключ Google живут только на VPS.
- Авторизация: Telegram Login Widget → POST на VPS API → API верифицирует HMAC и выдаёт JWT → SPA сохраняет JWT в localStorage и шлёт `Authorization: Bearer …` во все запросы.

## Локальный запуск

```bash
npm install
VITE_API_BASE_URL=https://your-vps-api npm run dev
```

Откроется http://localhost:5173. Без `VITE_API_BASE_URL` сайт собирается, но показывает баннер «API не подключён» вместо данных.

## Деплой

Делается автоматически из GitHub Actions при push в `main`. Перед первым деплоем:

1. **Repository Settings → Pages → Source = GitHub Actions**.
2. **Repository Settings → Secrets and variables → Actions → Variables**:
   - `VITE_API_BASE_URL` — например `https://api.213-139-229-81.sslip.io` (поднимем на VPS).
   - `VITE_BOT_USERNAME` — `vnachale_manager_bot` (по умолчанию).
3. **@BotFather → /setdomain** → ввести `whsmotilek.github.io`.

После пуша в `main`: Actions соберёт `dist/`, опубликует на `https://whsmotilek.github.io/vnachale/`.

## Структура

```
web/
├── index.html
├── public/logo.png            бренд-лого
├── src/
│   ├── main.tsx
│   ├── App.tsx                  state-based router (orders ⇆ analytics)
│   ├── env.ts                   import.meta.env обёртка
│   ├── api.ts                   fetch + JWT
│   ├── pages/                   Login, Orders, Analytics
│   └── components/              Logo, Nav, OrdersTable, StatusBadge, StatCard
├── tailwind.config.ts
├── vite.config.ts
└── .github/workflows/deploy.yml
```
