"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Check, X } from "lucide-react";
import type { FlashcardData, SRSRating } from "@/types/srs";

interface SwipeCardProps {
  card: FlashcardData;
  isRevealed: boolean;
  onReveal: () => void;
  onRate: (rating: SRSRating) => void;
  reduceMotion: boolean;
}

const SWIPE_THRESHOLD = 80;

export function SwipeCard({ card, isRevealed, onReveal, onRate, reduceMotion }: SwipeCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);

  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-12, 0, 12]);
  const opacity = useTransform(x, [-200, -80, 0, 80, 200], [0, 1, 1, 1, 0]);
  const forgotOpacity = useTransform(x, [-120, -40, 0], [1, 0.4, 0]);
  const knowOpacity = useTransform(x, [0, 40, 120], [0, 0.4, 1]);

  const [isDragging, setIsDragging] = useState(false);
  const [dragDirection, setDragDirection] = useState<"left" | "right" | null>(null);

  const handleDragStart = () => {
    if (!isRevealed) return;
    setIsDragging(true);
  };

  const handleDrag = (_: unknown, info: { offset: { x: number } }) => {
    if (!isRevealed) return;
    if (info.offset.x < -20) setDragDirection("left");
    else if (info.offset.x > 20) setDragDirection("right");
    else setDragDirection(null);
  };

  const handleDragEnd = (_: unknown, info: { offset: { x: number }; velocity: { x: number } }) => {
    setIsDragging(false);
    setDragDirection(null);

    if (!isRevealed) {
      x.set(0);
      return;
    }

    const swipedFar = Math.abs(info.offset.x) > SWIPE_THRESHOLD;
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

  return (
    <div className="relative w-full max-w-sm select-none">
      <motion.div
        style={{ opacity: forgotOpacity }}
        className="pointer-events-none absolute inset-y-4 left-3 z-10 flex items-center"
        aria-hidden
      >
        <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-lk-red/40 bg-lk-red-dim px-3 py-2.5">
          <X className="h-5 w-5 text-lk-red" strokeWidth={2.5} />
          <span className="text-[10px] font-bold text-lk-red">Не знаю</span>
        </div>
      </motion.div>

      <motion.div
        style={{ opacity: knowOpacity }}
        className="pointer-events-none absolute inset-y-4 right-3 z-10 flex items-center"
        aria-hidden
      >
        <div className="flex flex-col items-center gap-1 rounded-2xl border-2 border-lk-green/40 bg-lk-green-dim px-3 py-2.5">
          <Check className="h-5 w-5 text-lk-green" strokeWidth={2.5} />
          <span className="text-[10px] font-bold text-lk-green">Знаю</span>
        </div>
      </motion.div>

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
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !isRevealed) {
            e.preventDefault();
            onReveal();
          }
        }}
        aria-label={isRevealed ? `Карточка: ${card.word}` : `Открыть перевод для ${card.word}`}
        className={[
          "relative w-full cursor-pointer rounded-3xl border border-lk-line bg-lk-card p-8 text-center shadow-lk",
          "transition-shadow duration-200",
          isDragging ? "shadow-2xl" : "",
          dragDirection === "left" ? "ring-2 ring-lk-red/40" : "",
          dragDirection === "right" ? "ring-2 ring-lk-green/40" : "",
        ].join(" ")}
      >
        <div className="mb-4 flex flex-wrap justify-center gap-1.5">
          {card.partOfSpeech && (
            <span className="rounded-full bg-lk-gold-dim px-3 py-1 text-xs font-medium text-lk-gold">
              {card.partOfSpeech}
            </span>
          )}
          {card.gender && (
            <span className="rounded-full bg-lk-card2 px-3 py-1 text-xs font-medium text-lk-muted">
              {card.gender === "м" ? "муж. р." : card.gender === "ж" ? "жен. р." : "ср. р."}
            </span>
          )}
          {card.verbAspect && (
            <span className="rounded-full bg-lk-card2 px-3 py-1 text-xs font-medium text-lk-muted">
              {card.verbAspect}
            </span>
          )}
        </div>

        <p className="font-serif text-4xl font-bold leading-tight text-lk-text md:text-5xl">
          {card.word}
        </p>

        {card.transcription && (
          <p className="mt-3 font-mono text-base text-lk-muted">
            [{card.transcription}]
          </p>
        )}

        <div
          className={[
            "mx-auto mt-6 transition-all duration-300",
            isRevealed ? "w-10 border-t-2 border-lk-line" : "w-6 border-t border-dashed border-lk-line",
          ].join(" ")}
        />

        <div
          className={[
            "overflow-hidden transition-all duration-300 ease-out",
            isRevealed ? "mt-5 max-h-96 opacity-100" : "max-h-0 opacity-0",
          ].join(" ")}
          aria-live="polite"
        >
          <p className="text-2xl font-semibold text-lk-text">{card.translation}</p>

          {card.notes && (
            <p className="mt-1 text-xs italic text-lk-gold">{card.notes}</p>
          )}

          {card.exampleSentence && (
            <p className="mt-3 text-sm italic leading-relaxed text-lk-muted">
              «{card.exampleSentence}»
            </p>
          )}

          {card.synonyms && card.synonyms.length > 0 && (
            <div className="mt-4 rounded-2xl border border-lk-line bg-lk-card2 px-4 py-3 text-left">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-lk-faint">
                Другие слова для «{card.translation}»
              </p>
              <div className="flex flex-wrap gap-2">
                {card.synonyms.map((s) => (
                  <span
                    key={s.id}
                    className="rounded-lg border border-lk-line bg-lk-card px-3 py-1 text-sm font-medium text-lk-text"
                  >
                    {s.lemma}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
}
