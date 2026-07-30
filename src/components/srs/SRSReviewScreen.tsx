"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { getSRSQueue, submitSRSReview } from "@/lib/api/client";
import { SwipeCard } from "@/components/srs/SwipeCard";
import { MultipleChoice } from "@/components/srs/MultipleChoice";
import { RecallInput } from "@/components/srs/RecallInput";
import { SRSSummaryScreen } from "@/components/srs/SRSSummaryScreen";
import type { FlashcardData, SRSRating, SRSReviewState } from "@/types/srs";

// ─── Тип упражнения по кол-ву повторений ──────────────────────────────────────
type ExerciseType = "flashcard" | "choice" | "choice-reverse" | "recall";

function getExerciseType(repetition: number): ExerciseType {
  if (repetition === 0) return "flashcard";
  if (repetition <= 2)  return "choice";
  if (repetition % 2 === 0) return "choice-reverse";
  return "recall";
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

type Action =
  | { type: "load_start" }
  | { type: "load_success"; payload: FlashcardData[] }
  | { type: "reveal" }
  | { type: "rate"; payload: SRSRating }
  | { type: "restart"; payload: FlashcardData[] }; // перезапуск с забытыми

const initialState: SRSReviewState = {
  queue: [],
  currentIndex: 0,
  isRevealed: false,
  results: [],
  isFinished: false,
  isLoading: true,
  isInputLocked: false,
};

function getXPByRating(rating: SRSRating): number {
  if (rating === "know") return 10;
  if (rating === "unsure") return 5;
  return 2;
}

function reducer(state: SRSReviewState, action: Action): SRSReviewState {
  switch (action.type) {
    case "load_start":
      return { ...state, isLoading: true };

    case "load_success":
      return {
        ...state,
        isLoading: false,
        queue: action.payload,
        isFinished: action.payload.length === 0,
        isRevealed: false,
        currentIndex: 0,
        results: [],
        isInputLocked: false,
      };

    case "reveal":
      return { ...state, isRevealed: true };

    case "rate": {
      const current = state.queue[state.currentIndex];
      if (!current) return state;
      const updatedResults = [
        ...state.results,
        { cardId: current.id, rating: action.payload, timestamp: Date.now() },
      ];
      const nextQueue = state.queue.filter((item) => item.id !== current.id);
      return {
        ...state,
        queue: nextQueue,
        currentIndex: 0,
        isRevealed: false,
        results: updatedResults,
        isFinished: nextQueue.length === 0,
        isInputLocked: false,
      };
    }

    // Перезапуск с новым набором карточек (забытые слова)
    case "restart":
      return {
        ...initialState,
        isLoading: false,
        queue: action.payload,
        isFinished: action.payload.length === 0,
      };

    default:
      return state;
  }
}

// ─── Лейбл этапа ──────────────────────────────────────────────────────────────
function StageLabel({ type }: { type: ExerciseType }) {
  const map: Record<ExerciseType, { text: string; color: string }> = {
    "flashcard":      { text: "Этап 1 · Карточка",       color: "bg-blue-50 text-blue-600" },
    "choice":         { text: "Этап 2 · Выбор",          color: "bg-purple-50 text-purple-600" },
    "choice-reverse": { text: "Этап 2 · Обратный выбор", color: "bg-purple-50 text-purple-600" },
    "recall":         { text: "Этап 3 · Ввод",           color: "bg-indigo-50 text-indigo-600" },
  };
  const { text, color } = map[type];
  return (
    <span className={`rounded-full px-3 py-1 text-xs font-semibold ${color}`}>
      {text}
    </span>
  );
}

// ─── Компонент ────────────────────────────────────────────────────────────────

export function SRSReviewScreen() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [reviewError, setReviewError] = useState<string | null>(null);

  // Храним все карточки сессии чтобы перезапустить с забытыми
  const [sessionCards, setSessionCards] = useState<FlashcardData[]>([]);

  const reduceMotion = useReducedMotion();
  const router = useRouter();

  // Загрузка очереди
  useEffect(() => {
    dispatch({ type: "load_start" });
    getSRSQueue()
      .then((queue) => {
        setReviewError(null);
        setSessionCards(queue);
        dispatch({ type: "load_success", payload: queue });
      })
      .catch(() => {
        setReviewError("Не удалось загрузить очередь");
        dispatch({ type: "load_success", payload: [] });
      });
  }, []);

  const currentCard = state.queue[state.currentIndex] ?? null;

  const total = useMemo(
    () => state.results.length + state.queue.length,
    [state.results.length, state.queue.length]
  );
  const progressPercent = total > 0
    ? Math.round((state.results.length / total) * 100)
    : 0;

  const sessionXP = useMemo(
    () => state.results.reduce((sum, r) => sum + getXPByRating(r.rating), 0),
    [state.results]
  );

  const exerciseType = currentCard
    ? getExerciseType(currentCard.repetition ?? 0)
    : "flashcard";

  // Оценка карточки — мгновенный UI, фоновый запрос к серверу
  const handleRate = useCallback(
    (rating: SRSRating) => {
      if (state.isFinished) return;
      const activeCard = state.queue[state.currentIndex];
      if (!activeCard) return;

      dispatch({ type: "rate", payload: rating });

      submitSRSReview(activeCard.id, rating)
        .then(() => setReviewError(null))
        .catch(() => setReviewError("Не сохранилось, проверьте соединение"));
    },
    [state.currentIndex, state.isFinished, state.queue]
  );

  // Перезапуск с забытыми словами
  const handleRestart = useCallback(() => {
    // Берём ID карточек которые были отмечены как "forgot"
    const forgotIds = new Set(
      state.results
        .filter((r) => r.rating === "forgot")
        .map((r) => r.cardId)
    );

    // Находим соответствующие карточки из сессии
    const forgotCards = sessionCards
      .filter((c) => forgotIds.has(c.id))
      // Сбрасываем repetition в 0 — начинаем с карточки, не с ввода
      .map((c) => ({ ...c, repetition: 0 }));

    dispatch({ type: "restart", payload: forgotCards });
  }, [sessionCards, state.results]);

  // Клавиатура (только для карточки этапа 1)
  useEffect(() => {
    if (exerciseType !== "flashcard") return;

    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;
      if (e.key === "Escape") { e.preventDefault(); router.push("/dashboard"); return; }
      if ((e.key === " " || e.key === "Enter") && !state.isRevealed) {
        e.preventDefault();
        dispatch({ type: "reveal" });
      }
      if (!state.isRevealed) return;
      if (e.key === "1" || e.key === "ArrowLeft") handleRate("forgot");
      if (e.key === "2") handleRate("unsure");
      if (e.key === "3" || e.key === "ArrowRight") handleRate("know");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [exerciseType, handleRate, router, state.isRevealed]);

  // ── Загрузка ────────────────────────────────────────────────────────────────
  if (state.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50">
        <div className="w-full max-w-sm space-y-3 px-4">
          <div className="h-64 animate-pulse rounded-3xl bg-gray-200" />
          <div className="h-16 animate-pulse rounded-2xl bg-gray-100" />
        </div>
      </div>
    );
  }

  // ── Завершено ────────────────────────────────────────────────────────────────
  if (state.isFinished || !currentCard) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
        <header className="flex h-12 shrink-0 items-center justify-between bg-white px-4 shadow-sm">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" /> Главная
          </Link>
          <p className="text-sm font-medium text-gray-500">Итоги</p>
          <div className="w-16" />
        </header>
        <SRSSummaryScreen
          total={total}
          results={state.results}
          sessionXP={sessionXP}
          onRestart={handleRestart}
        />
      </div>
    );
  }

  // ── Основной экран ──────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">

      {/* Хедер */}
      <header className="shrink-0 bg-white shadow-sm">
        <div className="flex h-12 items-center justify-between px-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Выйти</span>
          </Link>

          <StageLabel type={exerciseType} />

          <div className="rounded-full bg-yellow-50 px-3 py-1 text-xs font-semibold text-yellow-700">
            ⭐ {sessionXP}
          </div>
        </div>

        {/* Прогресс-бар */}
        <div className="h-1 bg-gray-100">
          <div
            className="h-full bg-blue-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Точки прогресса */}
        <div className="flex items-center justify-center gap-1 py-1.5">
          {Array.from({ length: Math.min(total, 20) }).map((_, i) => (
            <div
              key={i}
              className={[
                "h-1.5 rounded-full transition-all duration-300",
                i < state.results.length
                  ? state.results[i]?.rating === "know"
                    ? "w-4 bg-emerald-400"
                    : "w-4 bg-red-400"
                  : i === state.results.length
                  ? "w-4 bg-blue-400"
                  : "w-2 bg-gray-200",
              ].join(" ")}
            />
          ))}
          {total > 20 && (
            <span className="ml-1 text-xs text-gray-400">+{total - 20}</span>
          )}
        </div>
      </header>

      {/* Упражнение */}
      <div className="flex flex-1 items-center justify-center overflow-hidden px-4 py-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${currentCard.id}-${exerciseType}`}
            className="flex w-full justify-center"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.97 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
          >
            {exerciseType === "flashcard" && (
              <SwipeCard
                card={currentCard}
                isRevealed={state.isRevealed}
                onReveal={() => dispatch({ type: "reveal" })}
                onRate={handleRate}
                reduceMotion={reduceMotion ?? false}
              />
            )}
            {exerciseType === "choice" && (
              <MultipleChoice
                card={currentCard}
                allCards={state.queue}
                reverse={false}
                onRate={handleRate}
              />
            )}
            {exerciseType === "choice-reverse" && (
              <MultipleChoice
                card={currentCard}
                allCards={state.queue}
                reverse={true}
                onRate={handleRate}
              />
            )}
            {exerciseType === "recall" && (
              <RecallInput
                card={currentCard}
                allCards={sessionCards}
                onRate={handleRate}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Подсказка для карточки */}
      {exerciseType === "flashcard" && (
        <div className="shrink-0 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-1 text-center">
          {reviewError && (
            <p className="mb-1 text-xs text-red-400">{reviewError}</p>
          )}
          {!state.isRevealed ? (
            <p className="text-xs text-gray-400">Нажми · Space</p>
          ) : (
            <p className="text-xs text-gray-400">
              <kbd className="rounded bg-gray-100 px-1">←</kbd> Не знал &nbsp;
              <kbd className="rounded bg-gray-100 px-1">→</kbd> Знал
            </p>
          )}
        </div>
      )}

    </div>
  );
}