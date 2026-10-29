"use client";

import type { RefObject } from "react";
import { PALOCHKA } from "@/lib/lak/alphabet";

/**
 * Панель лакских букв над системной клавиатурой телефона.
 *
 * На русской раскладке нет палочки (Ӏ), а «ъ» на iPhone спрятан под долгим
 * нажатием «ь». Диграфы набираются двумя буквами, но в одно касание быстрее.
 * Палочку в ответе можно набрать и как I, l или 1 — проверка примет любой вариант.
 */

const KEYS: string[][] = [
  [PALOCHKA, "ь", "ъ"],
  [`к${PALOCHKA}`, `х${PALOCHKA}`, `ч${PALOCHKA}`, `ц${PALOCHKA}`, `т${PALOCHKA}`, `п${PALOCHKA}`],
  ["кь", "къ", "хь", "хъ", "гь", "гъ", "аь", "оь"]
];

type Props = {
  inputRef: RefObject<HTMLInputElement | null>;
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
};

export function LakKeyboardBar({ inputRef, value, onChange, disabled }: Props) {
  const insert = (text: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = value.slice(0, start) + text + value.slice(end);
    onChange(next);
    // Вернуть курсор после вставки и не дать системной клавиатуре закрыться
    requestAnimationFrame(() => {
      if (!el) return;
      el.focus();
      const pos = start + text.length;
      el.setSelectionRange(pos, pos);
    });
  };

  return (
    <div
      role="toolbar"
      aria-label="Лакские буквы"
      className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {KEYS.map((group, gi) => (
        <div key={gi} className="flex shrink-0 gap-1.5">
          {group.map((key) => (
            <button
              key={key}
              type="button"
              disabled={disabled}
              // mousedown/touchstart без потери фокуса — иначе клавиатура телефона прячется
              onPointerDown={(e) => e.preventDefault()}
              onClick={() => insert(key)}
              aria-label={`Вставить ${key}`}
              className={[
                "min-w-[44px] shrink-0 rounded-xl border px-3 py-2.5 font-serif text-lg font-semibold leading-none transition active:scale-95 disabled:opacity-40",
                gi === 0
                  ? "border-lk-gold-border bg-lk-gold-dim text-lk-gold"
                  : "border-lk-line bg-lk-card2 text-lk-text"
              ].join(" ")}
            >
              {key}
            </button>
          ))}
          {gi < KEYS.length - 1 && <span aria-hidden className="mx-0.5 w-px shrink-0 self-stretch bg-lk-line" />}
        </div>
      ))}
    </div>
  );
}
