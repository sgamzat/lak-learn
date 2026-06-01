"use client";

import { useEffect, useState } from "react";
import type { FlashcardData, SRSRating } from "@/types/srs";

interface MultipleChoiceProps {
  card: FlashcardData;
  // Все слова очереди — берём из них дистракторы
  allCards: FlashcardData[];
  // Этап 2: показываем русский, выбираем лакское
  // Этап 3: показываем лакское, выбираем русский (reverse=true)
  reverse?: boolean;
  onRate: (rating: SRSRating) => void;
}

function shuffle<T>(arr: T[]): T[] {
  return [...arr].sort(() => Math.random() - 0.5);
}

export function MultipleChoice({
  card,
  allCards,
  reverse = false,
  onRate,
}: MultipleChoiceProps) {
  const [selected, setSelected] = useState<string | null>(null);
  const [options, setOptions] = useState<string[]>([]);

  // Генерируем варианты при смене карточки
  useEffect(() => {
    setSelected(null);

    const correct = reverse ? card.translation : card.word;

    // Берём 3 случайных дистрактора из других карточек
    const distractors = shuffle(
      allCards
        .filter((c) => c.id !== card.id)
        .map((c) => (reverse ? c.translation : c.word))
        .filter((v) => v !== correct)
    ).slice(0, 3);

    setOptions(shuffle([correct, ...distractors]));
  }, [card.id, card.translation, card.word, allCards, reverse]);

  const handleSelect = (option: string) => {
    if (selected !== null) return; // уже ответили

    setSelected(option);
    const correct = reverse ? card.translation : card.word;
    const isCorrect = option === correct;

    // Небольшая задержка — пользователь видит результат
    setTimeout(() => {
      onRate(isCorrect ? "know" : "forgot");
    }, 900);
  };

  const correct = reverse ? card.translation : card.word;
  const question = reverse ? card.word : card.translation;

  return (
    <div className="w-full max-w-sm space-y-5">

      {/* Этап */}
      <div className="text-center">
        <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-600">
          {reverse ? "Этап 3 — Вспомни перевод" : "Этап 2 — Выбери слово"}
        </span>
      </div>

      {/* Вопрос */}
      <div className="rounded-3xl bg-white p-8 text-center shadow-lg">
        {!reverse && card.partOfSpeech && (
          <span className="mb-3 inline-block rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-blue-600">
            {card.partOfSpeech}
          </span>
        )}
        <p className="text-3xl font-bold text-gray-900">{question}</p>
        {!reverse && card.transcription && (
          <p className="mt-2 font-mono text-sm text-gray-400">[{card.transcription}]</p>
        )}
        <p className="mt-3 text-sm text-gray-400">
          {reverse ? "Выберите правильный перевод" : "Выберите правильное слово на лакском"}
        </p>
      </div>

      {/* Варианты */}
      <div className="grid grid-cols-1 gap-3">
        {options.map((option) => {
          const isCorrect = option === correct;
          const isSelected = option === selected;

          let style = "border-gray-200 bg-white text-gray-800 hover:border-blue-300 hover:bg-blue-50";
          if (selected !== null) {
            if (isCorrect) {
              style = "border-emerald-300 bg-emerald-50 text-emerald-800";
            } else if (isSelected) {
              style = "border-red-300 bg-red-50 text-red-800";
            } else {
              style = "border-gray-100 bg-gray-50 text-gray-400";
            }
          }

          return (
            <button
              key={option}
              type="button"
              onClick={() => handleSelect(option)}
              disabled={selected !== null}
              className={[
                "flex w-full items-center justify-between rounded-2xl border-2 px-5 py-4 text-left text-sm font-medium transition-all",
                "disabled:cursor-default active:scale-[0.98]",
                style,
              ].join(" ")}
            >
              <span className="text-base">{option}</span>
              {selected !== null && isCorrect && (
                <span className="text-lg text-emerald-500">✓</span>
              )}
              {selected !== null && isSelected && !isCorrect && (
                <span className="text-lg text-red-500">✕</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Объяснение после ответа */}
      {selected !== null && selected !== correct && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center">
          <p className="text-xs text-emerald-600">Правильный ответ:</p>
          <p className="mt-1 text-lg font-bold text-emerald-800">{correct}</p>
        </div>
      )}
    </div>
  );
}