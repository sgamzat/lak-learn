"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import type { FlashcardData, SRSRating } from "@/types/srs";

interface SwipeCardProps {
  card:         FlashcardData;
  isRevealed:   boolean;
  onReveal:     () => void;
  onRate:       (rating: SRSRating) => void;
  reduceMotion: boolean;
}

const SWIPE_THRESHOLD = 80;

export function SwipeCard({ card, isRevealed, onReveal, onRate, reduceMotion }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const x           = useMotionValue(0);
  const rotate      = useTransform(x, [-200, 0, 200], [-12, 0, 12]);
  const opacity     = useTransform(x, [-200, -80, 0, 80, 200], [0, 1, 1, 1, 0]);
  const forgotOpacity = useTransform(x, [-120, -40, 0], [1, 0.4, 0]);
  const knowOpacity   = useTransform(x, [0, 40, 120], [0, 0.4, 1]);

  const [isDragging, setIsDragging]     = useState(false);
  const [dragDirection, setDragDirection] = useState<"left" | "right" | null>(null);

  const handleDragStart = () => {
    if (!isRevealed) return;
    setIsDragging(true);
  };

  const handleDrag = (_: unknown, info: { offset: { x: number } }) => {
    if (!isRevealed) return;
    if (info.offset.x < -20)      setDragDirection("left");
    else if (info.offset.x > 20)  setDragDirection("right");
    else                          setDragDirection(null);
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    setIsDragging(false);
    setDragDirection(null);

    if (!isRevealed) { x.set(0); return; }

    const swipedFar  = Math.abs(info.offset.x)  > SWIPE_THRESHOLD;
    const swipedFast = Math.abs(info.velocity.x) > 400;

    if (swipedFar || swipedFast) {
      onRate(info.offset.x < 0 ? "forgot" : "know");
    } else {
      x.set(0);
    }
  };

  const handleClick = () => {
    if (isDragging) return;
    if (!isRevealed) onReveal();
  };

  // Грамматическая метка: «Сущ. · ж» или «Глаг. · несов.»
  const grammarLabel = [
    card.partOfSpeech,
    card.gender,
    card.verbAspect,
  ].filter(Boolean).join(" · ");

  return (
    <div className="relative select-none">

      {/* ── Индикатор «Не знаю» ───────────────────────────────────────────── */}
      <motion.div
        style={{ opacity: forgotOpacity }}
        className="pointer-events-none absolute inset-y-4 left-4 z-10 flex items-center"
      >
        <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-red-300 bg-red-50 px-4 py-3">
          <span className="text-2xl font-bold text-red-500">✕</span>
          <span className="text-xs font-bold text-red-500">Не знаю</span>
        </div>
      </motion.div>

      {/* ── Индикатор «Знаю» ──────────────────────────────────────────────── */}
      <motion.div
        style={{ opacity: knowOpacity }}
        className="pointer-events-none absolute inset-y-4 right-4 z-10 flex items-center"
      >
        <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-emerald-300 bg-emerald-50 px-4 py-3">
          <span className="text-2xl font-bold text-emerald-500">✓</span>
          <span className="text-xs font-bold text-emerald-500">Знаю</span>
        </div>
      </motion.div>

      {/* ── Карточка ──────────────────────────────────────────────────────── */}
      <motion.div
        ref={cardRef}
        style={reduceMotion ? {} : { x, rotate, opacity }}
        drag={isRevealed ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={0.15}
        onDragStart={handleDragStart}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={handleClick}
        whileTap={isRevealed ? { scale: 0.98 } : { scale: 0.99 }}
        className={[
          "relative w-full cursor-pointer rounded-3xl bg-white p-8 text-center shadow-lg",
          "transition-shadow duration-200",
          isDragging       ? "shadow-2xl"          : "hover:shadow-xl",
          dragDirection === "left"  ? "ring-2 ring-red-200"     : "",
          dragDirection === "right" ? "ring-2 ring-emerald-200" : "",
        ].join(" ")}
      >

        {/* Грамматика: часть речи + род + вид */}
        {grammarLabel && (
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
          isRevealed
            ? "w-10 border-t-2 border-gray-200"
            : "w-6 border-t border-dashed border-gray-200",
        ].join(" ")} />

        {/* ── Обратная сторона — появляется после тапа ────────────────────── */}
        <div className={[
          "overflow-hidden transition-all duration-300 ease-out",
          isRevealed ? "mt-5 max-h-96 opacity-100" : "max-h-0 opacity-0",
        ].join(" ")}>

          {/* Перевод */}
          <p className="text-2xl font-semibold text-gray-800">
            {card.translation}
          </p>

          {/* Пометы: устар., разг. и т.д. */}
          {card.notes && (
            <p className="mt-1 text-xs text-amber-600 italic">
              {card.notes}
            </p>
          )}

          {/* Пример */}
          {card.exampleSentence && (
            <p className="mt-3 text-sm italic leading-relaxed text-gray-400">
              «{card.exampleSentence}»
            </p>
          )}

          {/* Синонимы — другие лакские слова с тем же переводом */}
          {card.synonyms && card.synonyms.length > 0 && (
            <div className="mt-4 rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-left">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                Другие слова для «{card.translation}»
              </p>
              <div className="flex flex-wrap gap-2">
                {card.synonyms.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-lg bg-white px-3 py-1 text-sm font-medium text-gray-700 border border-gray-200"
                  >
                    {s.lemma}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Кнопки оценки */}
          <div className="mt-6 flex gap-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRate("forgot"); }}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 border-red-100 bg-red-50 py-3 text-sm font-semibold text-red-600 transition hover:bg-red-100 active:scale-[0.97]"
            >
              <span className="text-lg leading-none">✕</span>
              Забыл
              <span className="font-mono text-[10px] opacity-60">1</span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRate("unsure"); }}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 border-amber-100 bg-amber-50 py-3 text-sm font-semibold text-amber-700 transition hover:bg-amber-100 active:scale-[0.97]"
            >
              <span className="text-lg leading-none">~</span>
              Не уверен
              <span className="font-mono text-[10px] opacity-60">2</span>
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onRate("know"); }}
              className="flex flex-1 flex-col items-center gap-1 rounded-2xl border-2 border-emerald-100 bg-emerald-50 py-3 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100 active:scale-[0.97]"
            >
              <span className="text-lg leading-none">✓</span>
              Знаю
              <span className="font-mono text-[10px] opacity-60">3</span>
            </button>
          </div>
        </div>

        {/* Подсказка когда закрыто */}
        {!isRevealed && (
          <p className="mt-4 text-xs text-gray-400">
            Нажмите чтобы открыть · Space / Enter
          </p>
        )}

        {isRevealed && (
          <p className="mt-3 text-center text-xs text-gray-400">
            1 — забыл · 2 — не уверен · 3 — знаю · или свайп ← / →
          </p>
        )}
      </motion.div>
    </div>
  );
}