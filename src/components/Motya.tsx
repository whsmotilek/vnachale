/** Мотя — внутренний AI-ассистент.
 *
 * Виджет-чат: пузырь справа-снизу, на десктопе — плавающее окно, на мобиле
 * (в т.ч. внутри Telegram Mini App) — лист на весь экран.
 * Общается с /assistant/chat: SSE-поток (tool → text-дельты → done).
 * Доступен рабочим ролям; какие данные видны — решает API (assistant.ROLE_TOOLS).
 * Роль здесь нужна только для подсказок в интерфейсе.
 */
import { useEffect, useRef, useState } from "react";
import { env } from "../env";
import { getToken } from "../api";

interface Msg {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
}

const TOOL_LABELS: Record<string, string> = {
  get_revenue: "Считаю выручку",
  get_orders: "Смотрю заказы",
  get_ozon_dashboard: "Открываю аналитику Ozon",
  get_ozon_cards: "Проверяю карточки Ozon",
  get_ozon_campaigns: "Смотрю настройки рекламы",
  get_stock: "Смотрю остатки на складах",
  get_balance: "Считаю баланс товара",
  get_site_traffic: "Читаю трафик сайта",
};

interface Suggestion { icon: string; text: string; q: string }

/** Подсказки под роль: предлагаем только то, на что у человека есть данные. */
const SUGGESTIONS_BY_ROLE: Record<string, Suggestion[]> = {
  owner: [
    { icon: "📊", text: "Выручка за неделю", q: "Какая выручка сайта и Ozon за последнюю неделю?" },
    { icon: "📦", text: "Что довезти на Ozon", q: "Что срочно нужно довезти на Ozon? Проверь остатки и скорость продаж." },
    { icon: "🔍", text: "Проблемные карточки", q: "Какие карточки на Ozon проседают и что с ними делать?" },
    { icon: "💰", text: "Баланс товара", q: "Сколько денег сейчас вложено в товар и что заморожено?" },
  ],
  ozon: [
    { icon: "🔍", text: "Что проседает", q: "Какие артикулы просели за неделю и почему? Проверь состав роста — кто кого вытеснил." },
    { icon: "🎯", text: "Реклама по стратегиям", q: "Покажи запущенные кампании: где автостратегия, где ручная ставка, где целевой расход. Есть ли кампании с расходом и нулём продаж?" },
    { icon: "📉", text: "Обвал CTR", q: "У каких артикулов CTR упал вдвое и больше? Свяжи с продажами." },
    { icon: "⚠️", text: "Риск дефицита", q: "Каким артикулам не хватит остатка при текущем темпе продаж?" },
  ],
  fulfillment: [
    { icon: "📦", text: "Что отгружать", q: "Какие заказы сейчас нужно собрать и отгрузить?" },
    { icon: "🔎", text: "Проверить наличие", q: "Что заканчивается на складах? Покажи позиции с малым остатком." },
  ],
  manager: [
    { icon: "📋", text: "Новые заказы", q: "Покажи последние заказы и их статусы." },
    { icon: "⚠️", text: "Требуют внимания", q: "Какие заказы зависли или требуют внимания?" },
  ],
};

const PLACEHOLDER_BY_ROLE: Record<string, string> = {
  owner: "Спросите про заказы, Ozon, склад…",
  ozon: "Спросите про артикулы, рекламу, конверсии…",
  fulfillment: "Спросите про заказы и остатки…",
  manager: "Спросите про заказы и статусы…",
};

/** Мини-рендер markdown: **жирный**, списки, таблицы, заголовки. */
function renderMarkdown(md: string): string {
  const esc = (s: string) =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const lines = md.split("\n");
  const out: string[] = [];
  let inTable = false;
  let inList = false;

  const closeList = () => { if (inList) { out.push("</ul>"); inList = false; } };
  const closeTable = () => { if (inTable) { out.push("</tbody></table></div>"); inTable = false; } };

  const inline = (s: string) =>
    esc(s)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, '<code class="px-1 py-0.5 rounded bg-black/5 dark:bg-white/10 text-[12px]">$1</code>')
      .replace(/\*(.+?)\*/g, "<em>$1</em>");

  for (const raw of lines) {
    const line = raw.trimEnd();
    // таблица
    if (/^\s*\|/.test(line)) {
      const cells = line.split("|").slice(1, -1).map((c) => c.trim());
      if (/^[\s|:-]+$/.test(line)) continue; // разделитель
      if (!inTable) {
        closeList();
        out.push('<div class="overflow-x-auto my-2"><table class="w-full text-[13px] tabular-nums"><tbody>');
        inTable = true;
        out.push(
          "<tr>" + cells.map((c) => `<th class="text-left font-semibold text-neutral-500 dark:text-neutral-400 pb-1.5 pr-3 border-b border-black/10 dark:border-white/10">${inline(c)}</th>`).join("") + "</tr>",
        );
        continue;
      }
      out.push("<tr>" + cells.map((c, i) => `<td class="py-1.5 pr-3 border-b border-black/5 dark:border-white/5 ${i > 0 ? "text-right" : ""}">${inline(c)}</td>`).join("") + "</tr>");
      continue;
    }
    closeTable();

    if (/^\s*[-*•]\s+/.test(line)) {
      if (!inList) { out.push('<ul class="list-disc pl-4 space-y-0.5 my-1.5">'); inList = true; }
      out.push(`<li>${inline(line.replace(/^\s*[-*•]\s+/, ""))}</li>`);
      continue;
    }
    closeList();

    if (/^#{1,6}\s+/.test(line)) {
      out.push(`<div class="font-semibold mt-2.5 mb-1">${inline(line.replace(/^#{1,6}\s+/, ""))}</div>`);
      continue;
    }
    if (/^\s*---+\s*$/.test(line)) { out.push('<hr class="my-2 border-black/10 dark:border-white/10">'); continue; }
    if (!line.trim()) { out.push('<div class="h-1.5"></div>'); continue; }
    out.push(`<p class="my-0.5">${inline(line)}</p>`);
  }
  closeList(); closeTable();
  return out.join("");
}

export function Motya({ role = "owner" }: { role?: string }) {
  const suggestions = SUGGESTIONS_BY_ROLE[role] ?? SUGGESTIONS_BY_ROLE.owner;
  const placeholder = PLACEHOLDER_BY_ROLE[role] ?? PLACEHOLDER_BY_ROLE.owner;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [deep, setDeep] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // История подгружается один раз при первом открытии
  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    (async () => {
      try {
        const res = await fetch(`${env.apiBaseUrl}/assistant/history`, {
          headers: { Authorization: `Bearer ${getToken() ?? ""}` },
        });
        if (!res.ok) return;
        const data = (await res.json()) as { messages: { role: string; content: string }[] };
        if (data.messages?.length) {
          setMsgs(data.messages.map((m) => ({ role: m.role === "user" ? "user" : "assistant", content: m.content })));
        }
      } catch { /* история не критична */ }
    })();
  }, [open, loaded]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, activeTool]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 260); }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    setMsgs((m) => [...m, { role: "user", content: q }, { role: "assistant", content: "", tools: [] }]);
    setBusy(true);
    setActiveTool(null);

    try {
      const res = await fetch(`${env.apiBaseUrl}/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken() ?? ""}` },
        body: JSON.stringify({ message: q, deep }),
      });
      if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`);

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const parts = buf.split("\n\n");
        buf = parts.pop() ?? "";
        for (const p of parts) {
          const line = p.split("\n").find((l) => l.startsWith("data:"));
          if (!line) continue;
          let ev: { type: string; delta?: string; name?: string; message?: string };
          try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (ev.type === "tool" && ev.name) {
            setActiveTool(ev.name);
            setMsgs((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") last.tools = [...(last.tools ?? []), ev.name!];
              return copy;
            });
          } else if (ev.type === "text" && ev.delta) {
            setActiveTool(null);
            setMsgs((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") last.content += ev.delta;
              return copy;
            });
          } else if (ev.type === "error") {
            setMsgs((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") last.content = `⚠️ ${ev.message ?? "Ошибка"}`;
              return copy;
            });
          }
        }
      }
    } catch (e) {
      setMsgs((m) => {
        const copy = [...m];
        const last = copy[copy.length - 1];
        if (last?.role === "assistant" && !last.content) last.content = "⚠️ Не удалось связаться с Мотей. Попробуйте ещё раз.";
        return copy;
      });
    } finally {
      setBusy(false);
      setActiveTool(null);
    }
  }

  async function newChat() {
    try {
      await fetch(`${env.apiBaseUrl}/assistant/history`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
    } catch { /* не критично */ }
    setMsgs([]);
  }

  const Mark = ({ cls }: { cls: string }) => (
    <svg viewBox="0 0 24 24" fill="none" className={cls}>
      <path d="M12 3v18M5 8l7-5 7 5M4 14c3 2 5 2 8 0s5-2 8 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );

  return (
    <>
      {/* Пузырь */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Открыть Мотю"
          className="fixed right-5 bottom-5 z-50 h-14 w-14 rounded-2xl bg-brand text-white grid place-items-center
                     shadow-[0_14px_34px_-8px_rgba(218,5,0,0.55)] transition-transform hover:-translate-y-0.5 active:scale-95"
        >
          <Mark cls="h-7 w-7" />
        </button>
      )}

      {/* Окно */}
      {open && (
        <div
          className="fixed z-50 inset-x-0 bottom-0 sm:inset-auto sm:right-5 sm:bottom-5
                     w-full sm:w-[404px] h-[88vh] sm:h-[min(624px,80vh)]
                     bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700
                     rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Мотя — AI-ассистент"
        >
          <div className="h-[3px] bg-gradient-to-r from-brand to-orange-400 shrink-0" />

          {/* Шапка */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
            <span className="relative h-10 w-10 rounded-xl bg-brand text-white grid place-items-center shrink-0">
              <Mark cls="h-5 w-5" />
              <i className="absolute -right-0.5 -bottom-0.5 h-3 w-3 rounded-full bg-emerald-500 border-2 border-white dark:border-neutral-900" />
            </span>
            <div className="flex-1 min-w-0">
              <div className="font-semibold leading-tight">Мотя</div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                видит все данные · {deep ? "глубокий анализ" : "быстрый режим"}
              </div>
            </div>
            <button
              onClick={() => setDeep((d) => !d)}
              title="Глубокий анализ (медленнее, умнее)"
              className={`h-8 px-2.5 rounded-lg text-[11px] font-medium transition-colors ${
                deep ? "bg-brand text-white" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              Pro
            </button>
            <button onClick={newChat} title="Новый чат"
              className="h-8 w-8 rounded-lg grid place-items-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4"><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>
            </button>
            <button onClick={() => setOpen(false)} title="Свернуть"
              className="h-8 w-8 rounded-lg grid place-items-center text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5"><path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </button>
          </div>

          {/* Сообщения */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-3.5">
            {msgs.length === 0 && (
              <div className="flex gap-2.5">
                <span className="h-7 w-7 rounded-lg bg-brand text-white grid place-items-center shrink-0 mt-0.5"><Mark cls="h-4 w-4" /></span>
                <div className="rounded-2xl rounded-tl-md bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2.5 text-sm max-w-[300px]">
                  <p>Привет! Я <strong>Мотя</strong> 👋 Вижу заказы, Ozon, склады, баланс и трафик сайта.</p>
                  <p className="mt-1.5">Спрашивайте — подтяну актуальные цифры и дам вывод.</p>
                </div>
              </div>
            )}

            {msgs.map((m, i) => (
              <div key={i} className={`flex gap-2.5 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                <span className={`h-7 w-7 rounded-lg grid place-items-center shrink-0 mt-0.5 text-[11px] font-semibold ${
                  m.role === "assistant" ? "bg-brand text-white" : "bg-neutral-200 dark:bg-neutral-700 text-neutral-500"
                }`}>
                  {m.role === "assistant" ? <Mark cls="h-4 w-4" /> : "Я"}
                </span>
                <div className={`px-3.5 py-2.5 text-sm max-w-[300px] leading-relaxed ${
                  m.role === "assistant"
                    ? "rounded-2xl rounded-tl-md bg-neutral-100 dark:bg-neutral-800"
                    : "rounded-2xl rounded-tr-md bg-neutral-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                }`}>
                  {m.role === "assistant" && (m.tools?.length ?? 0) > 0 && (
                    <div className="flex flex-wrap gap-1 mb-1.5">
                      {m.tools!.map((t, k) => (
                        <span key={k} className="text-[10.5px] px-1.5 py-0.5 rounded-md bg-brand/10 text-brand font-medium">
                          {TOOL_LABELS[t] ?? t}
                        </span>
                      ))}
                    </div>
                  )}
                  {m.content ? (
                    m.role === "assistant"
                      ? <div dangerouslySetInnerHTML={{ __html: renderMarkdown(m.content) }} />
                      : <p>{m.content}</p>
                  ) : (
                    <div className="flex items-center gap-2 text-neutral-500">
                      <span className="h-3.5 w-3.5 rounded-full border-2 border-neutral-300 dark:border-neutral-600 border-t-brand animate-spin" />
                      <span className="text-[13px]">{activeTool ? `${TOOL_LABELS[activeTool] ?? activeTool}…` : "Думаю…"}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Подсказки */}
          {msgs.length === 0 && (
            <div className="flex flex-wrap gap-2 px-4 pb-3 shrink-0">
              {suggestions.map((s) => (
                <button key={s.text} onClick={() => send(s.q)}
                  className="text-[12.5px] px-3 py-1.5 rounded-full border border-neutral-200 dark:border-neutral-700
                             hover:border-brand hover:text-brand transition-colors whitespace-nowrap">
                  {s.icon} {s.text}
                </button>
              ))}
            </div>
          )}

          {/* Ввод */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-end gap-2 px-3.5 py-3 border-t border-neutral-200 dark:border-neutral-700 shrink-0"
          >
            <div className="flex-1 rounded-2xl bg-neutral-100 dark:bg-neutral-800 px-3.5 py-2.5 focus-within:ring-2 focus-within:ring-brand/40">
              <input
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                disabled={busy}
                placeholder={placeholder}
                className="w-full bg-transparent outline-none text-sm disabled:opacity-60"
              />
            </div>
            <button type="submit" disabled={busy || !input.trim()} title="Отправить"
              className="h-10 w-10 rounded-xl bg-brand text-white grid place-items-center shrink-0
                         disabled:opacity-40 transition-transform active:scale-95">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M4 12l16-8-6 16-3-6-7-2z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="currentColor" fillOpacity=".18" />
              </svg>
            </button>
          </form>
          <div className="text-[10px] text-neutral-400 text-center pb-2.5 shrink-0">
            Только для владельцев · история сохраняется
          </div>
        </div>
      )}
    </>
  );
}
