import { useCallback, useRef, useState } from "react";

/**
 * Хук «копировать в буфер» с инлайновой подсветкой «Скопировано» на 1.5 сек.
 * Возвращает текущее состояние и функцию копирования по уникальному ключу.
 */
export function useCopy(timeoutMs = 1500) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const timerRef = useRef<number | null>(null);

  const copy = useCallback(
    async (text: string, key: string) => {
      if (!text) return;
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // fallback на старые браузеры — execCommand
        try {
          const ta = document.createElement("textarea");
          ta.value = text;
          ta.style.position = "fixed";
          ta.style.opacity = "0";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          ta.remove();
        } catch {
          return;
        }
      }
      setCopiedKey(key);
      if (timerRef.current) window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => setCopiedKey(null), timeoutMs);
    },
    [timeoutMs],
  );

  return { copiedKey, copy };
}
