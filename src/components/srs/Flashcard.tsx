"use client";

import type { FlashcardData } from "@/types/srs";

interface FlashcardProps {
  card:       FlashcardData;
  isRevealed: boolean;
  onReveal:   () => void;
}

export function Flashcard({ card, isRevealed, onReveal }: FlashcardProps) {
  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">

      {/* ── Основная карточка ─────────────────────────────────────────────── */}
      <button
        type="button"
        onClick={onReveal}
        aria-label={isRevealed ? "Карточка открыта" : "Нажмите чтобы показать перевод"}
        aria-pressed={isRevealed}
        className={[
          "relative w-full rounded-3xl bg-white p-8 text-center shadow-lg transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2",
          isRevealed
            ? "cursor-default shadow-xl"
            : "cursor-pointer hover:shadow-xl hover:-translate-y-0.5 active:scale-[0.99]",
        ].join(" ")}
      >
        {/* Грамматические бейджи */}
        <div className="mb-4 flex flex-wrap justify-center gap-1.5">
          {card.partOfSpeech && (
            <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
              {card.partOfSpeech}
            </span>
          )}
          {card.gender && (
            <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-medium text-indigo-600">
              {card.gender === "м" ? "муж. р." : card.gender === "ж" ? "жен. р." : "ср. р."}
            </span>
          )}
          {card.verbAspect && (
            <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-medium text-amber-600">
              {card.verbAspect}
            </span>
          )}
        </div>

        {/* Лакское слово */}
        <p className="text-4xl font-bold leading-tight text-gray-900 md:text-5xl">
          {card.word}
        </p>

        {/* Транскрипция */}
        {card.transcription && (
          <p className="mt-3 font-mono text-base text-gray-400">
            [{card.transcription}]
          </p>
        )}

        {/* Разделитель */}
        <div className={[
          "mx-auto mt-6 transition-all duration-300",
          isRevealed ? "w-12 border-t-2 border-gray-200" : "w-8 border-t border-dashed border-gray-200",
        ].join(" ")} />

        {/* Обратная сторона */}
        <div
          aria-live="polite"
          className={[
            "overflow-hidden transition-all duration-300 ease-out",
            isRevealed ? "mt-4 max-h-96 opacity-100" : "max-h-0 opacity-0",
          ].join(" ")}
        >
          {/* Перевод */}
          <p className="text-2xl font-semibold text-gray-800">
            {card.translation}
          </p>

          {/* Помета */}
          {card.notes && (
            <p className="mt-1 text-xs italic text-amber-600">
              {card.notes}
            </p>
          )}

          {/* Пример */}
          {card.exampleSentence && (
            <p className="mt-3 text-sm italic leading-relaxed text-gray-500">
              «{card.exampleSentence}»
            </p>
          )}

          {/* Синонимы */}
          {card.synonyms && card.synonyms.length > 0 && (
            <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-left">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Другие слова для «{card.translation}»
              </p>
              <div className="flex flex-wrap gap-2">
                {card.synonyms.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1 text-sm font-medium text-gray-700"
                  >
                    {s.lemma}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Подсказка */}
        {!isRevealed && (
          <p className="mt-4 text-xs text-gray-400">
            Нажмите или Space чтобы открыть
          </p>
        )}
      </button>

    </div>
  );
}