import type { FlashcardData } from "@/types/srs";

interface FlashcardProps {
  card: FlashcardData;
  isRevealed: boolean;
  onReveal: () => void;
}

export function Flashcard({ card, isRevealed, onReveal }: FlashcardProps) {
  return (
    <button
      type="button"
      onClick={onReveal}
      aria-label="Показать перевод"
      aria-pressed={isRevealed}
      className="relative flex aspect-[4/3] w-full max-w-[420px] flex-col items-center justify-center rounded-3xl bg-white p-8 text-center shadow-xl transition-all duration-200 hover:shadow-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
    >
      <p className="mb-2 text-3xl font-bold text-gray-900 md:text-4xl">{card.word}</p>
      <p className="mb-4 font-mono text-lg text-gray-500">{card.transcription}</p>
      <span className="mb-6 rounded-md bg-blue-100 px-2 py-1 text-xs font-medium text-blue-800">{card.partOfSpeech}</span>

      <div
        className={isRevealed ? "relative opacity-100 transition-all duration-300" : "absolute opacity-0"}
        aria-live="polite"
      >
        <p className="text-xl text-gray-800">{card.translation}</p>
        <p className="mt-2 text-base italic text-gray-600">{card.exampleSentence}</p>
      </div>
    </button>
  );
}

