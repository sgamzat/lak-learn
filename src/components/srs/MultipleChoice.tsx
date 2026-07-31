"use client";

import { useCallback, useEffect, useState } from "react";
import { Check, X } from "lucide-react";
import type { FlashcardData, SRSRating } from "@/types/srs";

interface MultipleChoiceProps {
  card: FlashcardData;
  /** Полный набор карточек сессии — для стабильных дистракторов */
  allCards: FlashcardData[];
  reverse?: boolean;
  onRate: (rating: SRSRating) => void;
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

export function MultipleChoice({
  card,
  allCards,
  reverse = false,
  onRate,
}: MultipleChoiceProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);

  useEffect(() => {
    setSelected(null);

    const correct = reverse ? card.translation : card.word;

    const distractors = shuffle(
      allCards
        .filter((c) => c.id !== card.id)
        .map((c) => (reverse ? c.translation : c.word))
        .filter((v) => v !== correct)
    ).slice(0, 3);

    setOptions(shuffle([correct, ...distractors]));
  }, [card.id, card.translation, card.word, allCards, reverse]);

  const handleSelect = useCallback(
    (option: string) => {
      if (selected !== null) return;

      setSelected(option);
      const correctAnswer = reverse ? card.translation : card.word;
      const isCorrect = option === correctAnswer;

      window.setTimeout(() => {
        onRate(isCorrect ? "know" : "forgot");
      }, 900);
    },
    [selected, reverse, card.translation, card.word, onRate]
  );

  useEffect(() => {
    if (selected !== null || options.length === 0) return;

    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      const num = Number(e.key);
      if (num >= 1 && num <= options.length) {
        e.preventDefault();
        const option = options[num - 1];
        if (option) handleSelect(option);
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selected, options, handleSelect]);

  const correct = reverse ? card.translation : card.word;
  const question = reverse ? card.word : card.translation;

  return (
    <div className="w-full max-w-sm space-y-5">
      <div className="rounded-3xl border border-lk-line bg-lk-card p-8 text-center shadow-lk">
        {!reverse && card.partOfSpeech && (
          <span className="mb-3 inline-block rounded-full bg-lk-gold-dim px-3 py-1 text-xs font-medium text-lk-gold">
            {card.partOfSpeech}
          </span>
        )}
        <p className="font-serif text-3xl font-bold text-lk-text">{question}</p>
        {!reverse && card.transcription && (
          <p className="mt-2 font-mono text-sm text-lk-muted">[{card.transcription}]</p>
        )}
        <p className="mt-3 text-sm text-lk-muted">
          {reverse ? "Выберите правильный перевод" : "Выберите правильное слово на лакском"}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3" role="listbox" aria-label="Варианты ответа">
        {options.map((option, index) => {
          const isCorrect = option === correct;
          const isSelected = option === selected;

          let style =
            "border-lk-line bg-lk-card text-lk-text hover:border-lk-gold-border hover:bg-lk-card2";
          if (selected !== null) {
            if (isCorrect) {
              style = "border-lk-green/50 bg-lk-green-dim text-lk-green";
            } else if (isSelected) {
              style = "border-lk-red/50 bg-lk-red-dim text-lk-red";
            } else {
              style = "border-lk-line/50 bg-lk-card2 text-lk-faint";
            }
          }

          return (
            <button
              key={`${option}-${index}`}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => handleSelect(option)}
              disabled={selected !== null}
              className={[
                "flex min-h-[48px] w-full items-center justify-between rounded-2xl border-2 px-5 py-4 text-left text-sm font-medium transition-all",
                "disabled:cursor-default active:scale-[0.98]",
                style,
              ].join(" ")}
            >
              <span className="flex items-center gap-3">
                <span className="font-mono text-[10px] text-lk-faint">{index + 1}</span>
                <span className="text-base">{option}</span>
              </span>
              {selected !== null && isCorrect && (
                <Check className="h-5 w-5 text-lk-green" aria-hidden />
              )}
              {selected !== null && isSelected && !isCorrect && (
                <X className="h-5 w-5 text-lk-red" aria-hidden />
              )}
            </button>
          );
        })}
      </div>

      {selected !== null && selected !== correct && (
        <div
          className="rounded-2xl border border-lk-green/40 bg-lk-green-dim p-4 text-center"
          aria-live="polite"
        >
          <p className="text-xs text-lk-green">Правильный ответ</p>
          <p className="mt-1 text-lg font-bold text-lk-text">{correct}</p>
        </div>
      )}
    </div>
  );
}
