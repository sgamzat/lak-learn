"use client";

import { useMemo, useState } from "react";

import type { QueueItem } from "../lib/api";


type Props = {
  item: QueueItem;
  onGrade: (quality: 0 | 1 | 2 | 3) => Promise<void>;
};


export function Flashcard({ item, onGrade }: Props) {
  const [showTranslation, setShowTranslation] = useState(false);
  const buttons = useMemo(
    () => [
      { label: "Again", value: 0 as const, className: "bg-red-700" },
      { label: "Hard", value: 1 as const, className: "bg-orange-700" },
      { label: "Good", value: 2 as const, className: "bg-emerald-700" },
      { label: "Easy", value: 3 as const, className: "bg-blue-700" },
    ],
    [],
  );

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-6 shadow-xl">
      <div className="mb-6 min-h-36 rounded-lg bg-slate-800 p-6 text-center">
        <p className="text-3xl font-semibold">{item.lemma}</p>
        {showTranslation ? (
          <>
            <p className="mt-4 text-xl text-emerald-300">{item.translation}</p>
            {item.example_sentence ? <p className="mt-3 text-slate-300">{item.example_sentence}</p> : null}
          </>
        ) : (
          <p className="mt-4 text-slate-400">Нажми «Показать перевод»</p>
        )}
      </div>

      {!showTranslation ? (
        <button
          onClick={() => setShowTranslation(true)}
          className="w-full rounded bg-slate-700 px-4 py-2 hover:bg-slate-600"
        >
          Показать перевод
        </button>
      ) : (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {buttons.map((btn) => (
            <button
              key={btn.value}
              onClick={async () => {
                setShowTranslation(false);
                await onGrade(btn.value);
              }}
              className={`rounded px-3 py-2 text-sm font-medium text-white ${btn.className}`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
