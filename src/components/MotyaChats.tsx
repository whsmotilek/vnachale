/** Боковая панель чатов Моти: список диалогов, создание, переименование, удаление.
 *
 * Раньше «Новый чат» стирал переписку безвозвратно. Теперь диалоги копятся,
 * как в обычном мессенджере, и к любому можно вернуться.
 */
import { useState } from "react";
import { env } from "../env";
import { getToken } from "../api";

export interface ChatItem {
  id: number;
  title: string;
  updated_at: string;
  messages: number;
  preview: string;
}

function when(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const days = Math.floor((Date.now() - d.getTime()) / 86_400_000);
  if (days === 0) return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн.`;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" });
}

const auth = () => ({ Authorization: `Bearer ${getToken() ?? ""}` });

export const chatsApi = {
  async list(): Promise<ChatItem[]> {
    const r = await fetch(`${env.apiBaseUrl}/assistant/chats`, { headers: auth() });
    if (!r.ok) return [];
    return ((await r.json()).chats ?? []) as ChatItem[];
  },
  async create(): Promise<number | null> {
    const r = await fetch(`${env.apiBaseUrl}/assistant/chats`, {
      method: "POST",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ title: "" }),
    });
    return r.ok ? (await r.json()).id as number : null;
  },
  async rename(id: number, title: string): Promise<void> {
    await fetch(`${env.apiBaseUrl}/assistant/chats/${id}`, {
      method: "PATCH",
      headers: { ...auth(), "Content-Type": "application/json" },
      body: JSON.stringify({ title }),
    });
  },
  async remove(id: number): Promise<void> {
    await fetch(`${env.apiBaseUrl}/assistant/chats/${id}`, { method: "DELETE", headers: auth() });
  },
};

export function ChatList({
  chats, activeId, onPick, onNew, onChanged, onClose,
}: {
  chats: ChatItem[];
  activeId: number | null;
  onPick: (id: number) => void;
  onNew: () => void;
  onChanged: () => void;
  onClose?: () => void;
}) {
  const [editing, setEditing] = useState<number | null>(null);
  const [draft, setDraft] = useState("");

  async function save(id: number) {
    const t = draft.trim();
    setEditing(null);
    if (t) { await chatsApi.rename(id, t); onChanged(); }
  }

  return (
    <div className="flex h-full w-full flex-col bg-neutral-50 dark:bg-neutral-950/60">
      <div className="flex items-center gap-2 px-3 py-2.5">
        <button
          onClick={onNew}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-2
                     text-[13px] font-medium text-white transition-transform active:scale-[.98]"
        >
          <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
            <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
          Новый чат
        </button>
        {onClose && (
          <button onClick={onClose} aria-label="Скрыть список"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-xl text-neutral-500
                       hover:bg-neutral-200/70 dark:hover:bg-neutral-800">
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5">
              <path d="M15 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {chats.length === 0 && (
          <p className="px-2 py-4 text-center text-[12px] text-neutral-500">
            Пока один диалог. Новые появятся здесь.
          </p>
        )}
        {chats.map((c) => {
          const active = c.id === activeId;
          return (
            <div
              key={c.id}
              className={`group mb-1 rounded-xl px-2.5 py-2 transition-colors ${
                active
                  ? "bg-white shadow-sm ring-1 ring-brand/20 dark:bg-neutral-800"
                  : "hover:bg-neutral-200/60 dark:hover:bg-neutral-800/60"
              }`}
            >
              {editing === c.id ? (
                <input
                  autoFocus
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => save(c.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") save(c.id);
                    if (e.key === "Escape") setEditing(null);
                  }}
                  className="w-full rounded-lg bg-transparent text-[13px] font-medium outline-none
                             ring-1 ring-brand/40 px-1.5 py-0.5"
                />
              ) : (
                <button onClick={() => onPick(c.id)} className="block w-full text-left">
                  <div className="flex items-center gap-1.5">
                    <span className={`min-w-0 flex-1 truncate text-[13px] font-medium ${active ? "text-brand" : ""}`}>
                      {c.title}
                    </span>
                    <span className="shrink-0 text-[10.5px] text-neutral-400">{when(c.updated_at)}</span>
                  </div>
                  {c.preview && (
                    <div className="mt-0.5 truncate text-[11.5px] text-neutral-500">{c.preview}</div>
                  )}
                </button>
              )}

              <div className="mt-1 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  onClick={() => { setEditing(c.id); setDraft(c.title); }}
                  className="rounded px-1.5 py-0.5 text-[10.5px] text-neutral-500 hover:bg-black/5 dark:hover:bg-white/10"
                >
                  переименовать
                </button>
                <button
                  onClick={async () => {
                    if (!confirm(`Удалить чат «${c.title}»? Переписка пропадёт.`)) return;
                    await chatsApi.remove(c.id);
                    onChanged();
                  }}
                  className="rounded px-1.5 py-0.5 text-[10.5px] text-rose-500 hover:bg-rose-500/10"
                >
                  удалить
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
