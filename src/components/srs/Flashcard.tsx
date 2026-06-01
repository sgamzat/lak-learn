import type { FlashcardData } from "@/types/srs";

interface FlashcardProps {
  card: FlashcardData;
  isRevealed: boolean;
  onReveal: () => void;
}

export function Flashcard({ card, isRevealed, onReveal }: FlashcardProps) {
  return (
    <div className="flex w-full max-w-[460px] flex-col gap-3">

      {/* Основная карточка */}
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
        {/* Часть речи */}
        {card.partOfSpeech && (
          <span className="mb-4 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
            {card.partOfSpeech}
          </span>
        )}

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

        {/* Перевод + пример — появляются после открытия */}
        <div
          aria-live="polite"
          className={[
            "overflow-hidden transition-all duration-300 ease-out",
            isRevealed ? "mt-4 max-h-64 opacity-100" : "max-h-0 opacity-0",
          ].join(" ")}
        >
          <p className="text-2xl font-semibold text-gray-800">
            {card.translation}
          </p>

          {card.exampleSentence && (
            <p className="mt-3 text-sm italic leading-relaxed text-gray-500">
              «{card.exampleSentence}»
            </p>
          )}
        </div>

        {/* Подсказка "нажмите" когда карточка закрыта */}
        {!isRevealed && (
          <p className="mt-4 text-xs text-gray-400">
            Нажмите или Space чтобы открыть
          </p>
        )}
      </button>

    </div>
  );
}