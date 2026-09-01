/** Мотя — внутренний AI-ассистент.
 *
 * Виджет-чат: пузырь справа-снизу, на десктопе — плавающее окно, на мобиле
 * (в т.ч. внутри Telegram Mini App) — лист на весь экран.
 * Общается с /assistant/chat: SSE-поток (tool → text-дельты → done).
 * Доступен рабочим ролям; какие данные видны — решает API (assistant.ROLE_TOOLS).
 * Роль здесь нужна только для подсказок в интерфейсе.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { env } from "../env";
import { getToken } from "../api";
import { ChatList, chatsApi, type ChatItem } from "./MotyaChats";

interface MsgFile { url: string; name: string; rows?: number }
/** Вложение, которое пользователь прикрепил к своему вопросу. */
interface Attach { id: string; name: string; kind: string; size: number }

interface Msg {
  role: "user" | "assistant";
  content: string;
  tools?: string[];
  files?: MsgFile[];
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
  build_report: "Собираю файл-отчёт",
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

/** Файл отдаётся под JWT, поэтому качаем запросом с заголовком, а не ссылкой. */
async function downloadFile(f: { url: string; name: string }): Promise<void> {
  try {
    const res = await fetch(`${env.apiBaseUrl}${f.url}`, {
      headers: { Authorization: `Bearer ${getToken() ?? ""}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  } catch {
    alert("Не удалось скачать файл — возможно, отчёт устарел. Попросите собрать заново.");
  }
}

export function Motya({ role = "owner" }: { role?: string }) {
  const suggestions = SUGGESTIONS_BY_ROLE[role] ?? SUGGESTIONS_BY_ROLE.owner;
  const placeholder = PLACEHOLDER_BY_ROLE[role] ?? PLACEHOLDER_BY_ROLE.owner;
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [chats, setChats] = useState<ChatItem[]>([]);
  const [chatId, setChatId] = useState<number | null>(null);
  const [showChats, setShowChats] = useState(false);
  const [attachments, setAttachments] = useState<Attach[]>([]);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [deep, setDeep] = useState(false);
  const [activeTool, setActiveTool] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const refreshChats = useCallback(async () => {
    setChats(await chatsApi.list());
  }, []);

  const openChat = useCallback(async (id: number | null) => {
    try {
      const res = await fetch(`${env.apiBaseUrl}/assistant/history${id ? `?chat_id=${id}` : ""}`, {
        headers: { Authorization: `Bearer ${getToken() ?? ""}` },
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        chat_id: number; messages: { role: string; content: string }[];
      };
      setChatId(data.chat_id ?? id ?? null);
      setMsgs((data.messages ?? []).map((m) => ({
        role: m.role === "user" ? "user" : "assistant", content: m.content,
      })));
    } catch { /* история не критична */ }
  }, []);

  // При первом открытии подтягиваем список диалогов и последний из них
  useEffect(() => {
    if (!open || loaded) return;
    setLoaded(true);
    (async () => {
      await refreshChats();
      await openChat(null);
    })();
  }, [open, loaded, refreshChats, openChat]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [msgs, activeTool]);

  useEffect(() => { if (open) setTimeout(() => inputRef.current?.focus(), 260); }, [open]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    setInput("");
    const note = attachments.length
      ? `\n\n📎 ${attachments.map((a) => a.name).join(", ")}` : "";
    setMsgs((m) => [...m, { role: "user", content: q + note },
                    { role: "assistant", content: "", tools: [] }]);
    setBusy(true);
    setActiveTool(null);
    const sending = attachments.map((a) => a.id);
    setAttachments([]);

    try {
      const res = await fetch(`${env.apiBaseUrl}/assistant/chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${getToken() ?? ""}` },
        body: JSON.stringify({ message: q, deep, chat_id: chatId, attachments: sending }),
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
          let ev: {
            type: string; delta?: string; name?: string; message?: string;
            url?: string; rows?: number;
          };
          try { ev = JSON.parse(line.slice(5).trim()); } catch { continue; }
          if (ev.type === "tool" && ev.name) {
            setActiveTool(ev.name);
            setMsgs((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") last.tools = [...(last.tools ?? []), ev.name!];
              return copy;
            });
          } else if (ev.type === "file" && ev.url) {
            setActiveTool(null);
            setMsgs((m) => {
              const copy = [...m];
              const last = copy[copy.length - 1];
              if (last?.role === "assistant") {
                last.files = [...(last.files ?? []),
                  { url: ev.url!, name: ev.name ?? "отчёт.xlsx", rows: ev.rows }];
              }
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
      refreshChats();     // у чата мог появиться заголовок из первого вопроса
    }
  }

  /** Вложение уходит на сервер сразу; в вопрос попадает только его id. */
  async function pickFiles(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    try {
      for (const f of Array.from(files).slice(0, 3)) {
        const fd = new FormData();
        fd.append("file", f);
        const res = await fetch(`${env.apiBaseUrl}/assistant/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${getToken() ?? ""}` },
          body: fd,
        });
        if (!res.ok) {
          const t = await res.text().catch(() => "");
          alert(`Не удалось приложить «${f.name}»: ${t.slice(0, 140) || res.status}`);
          continue;
        }
        const uploaded = (await res.json()) as Attach;
        setAttachments((a) => [...a, uploaded]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  /** Новый диалог. Прежний НЕ удаляется — остаётся в списке слева. */
  async function newChat() {
    const id = await chatsApi.create();
    setMsgs([]);
    setAttachments([]);
    setChatId(id);
    await refreshChats();
    setShowChats(false);
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
                     w-full sm:w-[620px] h-[90vh] sm:h-[min(660px,84vh)]
                     bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700
                     rounded-t-3xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          role="dialog"
          aria-label="Мотя — AI-ассистент"
        >
          <div className="h-[3px] bg-gradient-to-r from-brand to-orange-400 shrink-0" />

          {/* Шапка */}
          <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
            <button
              onClick={() => setShowChats((v) => !v)}
              title="Мои чаты"
              className={`h-8 w-8 shrink-0 rounded-lg grid place-items-center transition-colors ${
                showChats ? "bg-brand/10 text-brand" : "text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              }`}
            >
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M4 7h16M4 12h16M4 17h10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
              </svg>
            </button>
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

          {/* Тело: список чатов слева + переписка справа */}
          <div className="flex min-h-0 flex-1">
            {showChats && (
              <>
                {/* на узком экране список перекрывает переписку */}
                <div className="absolute inset-y-0 left-0 z-10 w-[78%] max-w-[300px] border-r
                                border-neutral-200 dark:border-neutral-700 sm:static sm:z-auto
                                sm:w-[232px] sm:max-w-none"
                     style={{ top: "60px" }}>
                  <ChatList
                    chats={chats}
                    activeId={chatId}
                    onPick={(id) => { openChat(id); setShowChats(false); }}
                    onNew={newChat}
                    onChanged={async () => { await refreshChats(); await openChat(null); }}
                    onClose={() => setShowChats(false)}
                  />
                </div>
                <div className="absolute inset-0 z-[5] bg-black/20 sm:hidden"
                     onClick={() => setShowChats(false)} />
              </>
            )}

            <div className="flex min-w-0 flex-1 flex-col">
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
                  {(m.files?.length ?? 0) > 0 && (
                    <div className="mt-2 flex flex-col gap-1.5">
                      {m.files!.map((f, k) => (
                        <button
                          key={k}
                          onClick={() => downloadFile(f)}
                          className="flex items-center gap-2 rounded-xl border border-brand/30 bg-brand/5
                                     px-3 py-2 text-left text-[13px] transition-colors hover:bg-brand/10"
                        >
                          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 shrink-0 text-brand">
                            <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2"
                                  stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                          <span className="min-w-0 flex-1 truncate font-medium">{f.name}</span>
                          {f.rows ? <span className="shrink-0 text-[11px] text-neutral-500">{f.rows} строк</span> : null}
                        </button>
                      ))}
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

          {/* Прикреплённые файлы */}
          {(attachments.length > 0 || uploading) && (
            <div className="flex flex-wrap items-center gap-1.5 px-3.5 pb-1.5 shrink-0">
              {attachments.map((a) => (
                <span key={a.id}
                  className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg bg-brand/10
                             px-2 py-1 text-[11.5px] text-brand">
                  <span className="truncate">
                    {a.kind === "image" ? "🖼" : a.kind === "table" ? "📊" : "📄"} {a.name}
                  </span>
                  <button type="button" aria-label="Убрать"
                    onClick={() => setAttachments((l) => l.filter((x) => x.id !== a.id))}
                    className="shrink-0 opacity-60 hover:opacity-100">✕</button>
                </span>
              ))}
              {uploading && <span className="text-[11.5px] text-neutral-500">загружаю…</span>}
            </div>
          )}

          {/* Ввод */}
          <form
            onSubmit={(e) => { e.preventDefault(); send(input); }}
            className="flex items-end gap-2 px-3.5 py-3 border-t border-neutral-200 dark:border-neutral-700 shrink-0"
          >
            <input ref={fileRef} type="file" multiple hidden
                   accept=".jpg,.jpeg,.png,.webp,.heic,.xlsx,.xlsm,.csv,.txt,.md,.json,.pdf"
                   onChange={(e) => pickFiles(e.target.files)} />
            <button type="button" onClick={() => fileRef.current?.click()}
              disabled={busy || uploading} title="Прикрепить файл или фото"
              className="h-10 w-10 shrink-0 rounded-xl grid place-items-center text-neutral-500
                         hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-40">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
                <path d="M21 12.5l-8.5 8.5a5 5 0 01-7-7l9-9a3.5 3.5 0 115 5l-9 9a2 2 0 11-3-3l8-8"
                      stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
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
            Данные по вашей роли · чаты сохраняются
          </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
