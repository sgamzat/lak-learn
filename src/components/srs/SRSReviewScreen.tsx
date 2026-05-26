"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { getSRSQueue, submitSRSReview } from "@/lib/api/client";
import { Flashcard } from "@/components/srs/Flashcard";
import { SRSRatingButtons } from "@/components/srs/SRSRatingButtons";
import { SRSSummaryScreen } from "@/components/srs/SRSSummaryScreen";
import type { FlashcardData, SRSRating, SRSReviewState } from "@/types/srs";

type Action =
  | { type: "load_start" }
  | { type: "load_success"; payload: FlashcardData[] }
  | { type: "reveal" }
  | { type: "lock_input" }
  | { type: "unlock_input" }
  | { type: "rate"; payload: SRSRating };

const initialState: SRSReviewState = {
  queue: [],
  currentIndex: 0,
  isRevealed: false,
  results: [],
  isFinished: false,
  isLoading: true,
  isInputLocked: false
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
        isInputLocked: false
      };
    case "lock_input":
      return { ...state, isInputLocked: true };
    case "unlock_input":
      return { ...state, isInputLocked: false };
    case "reveal":
      if (state.isInputLocked) return state;
      return { ...state, isRevealed: !state.isRevealed };
    case "rate": {
      if (state.isInputLocked) return state;
      const current = state.queue[state.currentIndex];
      if (!current) return state;

      const updatedResults = [
        ...state.results,
        {
          cardId: current.id,
          rating: action.payload,
          timestamp: Date.now()
        }
      ];

      const nextQueue = state.queue.filter((item) => item.id !== current.id);
      const finished = nextQueue.length === 0;

      return {
        ...state,
        queue: nextQueue,
        currentIndex: 0,
        isRevealed: false,
        results: updatedResults,
        isFinished: finished,
        isInputLocked: false
      };
    }
    default:
      return state;
  }
}

export function SRSReviewScreen() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const rateTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    dispatch({ type: "load_start" });
    getSRSQueue()
      .then((queue) => {
        setReviewError(null);
        dispatch({ type: "load_success", payload: queue });
      })
      .catch(() => {
        setReviewError("Не удалось загрузить очередь повторения");
        dispatch({ type: "load_success", payload: [] });
      });
  }, []);

  const currentCard = state.queue[state.currentIndex] ?? null;
  const total = useMemo(() => state.results.length + state.queue.length, [state.results.length, state.queue.length]);
  const progressCurrent = state.results.length + (state.isFinished ? 0 : 1);
  const sessionXP = useMemo(
    () => state.results.reduce((sum, item) => sum + getXPByRating(item.rating), 0),
    [state.results]
  );

  const handleRate = useCallback(
    (rating: SRSRating) => {
      if (state.isFinished || !state.isRevealed || state.isInputLocked) {
        return;
      }

      dispatch({ type: "lock_input" });

      if (rateTimeoutRef.current) {
        clearTimeout(rateTimeoutRef.current);
      }

      rateTimeoutRef.current = setTimeout(() => {
        const activeCard = state.queue[state.currentIndex];

        if (!activeCard) {
          dispatch({ type: "unlock_input" });
          rateTimeoutRef.current = null;
          return;
        }

        submitSRSReview(activeCard.id, rating)
          .then(() => {
            setReviewError(null);
            dispatch({ type: "rate", payload: rating });
          })
          .catch(() => {
            setReviewError("Не удалось сохранить результат. Повторите попытку.");
            dispatch({ type: "unlock_input" });
          })
          .finally(() => {
            rateTimeoutRef.current = null;
          });
      }, reduceMotion ? 60 : 180);
    },
    [reduceMotion, state.currentIndex, state.isFinished, state.isInputLocked, state.isRevealed, state.queue]
  );

  useEffect(() => {
    return () => {
      if (rateTimeoutRef.current) {
        clearTimeout(rateTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.repeat) return;

      if (event.key === "Escape") {
        event.preventDefault();
        router.push("/dashboard");
        return;
      }

      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (!state.isFinished && !state.isInputLocked) {
          dispatch({ type: "reveal" });
        }
      }

      if (event.key === "1") {
        if (!state.isFinished && state.isRevealed) {
          handleRate("forgot");
        }
      }
      if (event.key === "2") {
        if (!state.isFinished && state.isRevealed) {
          handleRate("unsure");
        }
      }
      if (event.key === "3") {
        if (!state.isFinished && state.isRevealed) {
          handleRate("know");
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleRate, router, state.isFinished, state.isInputLocked, state.isRevealed]);

  if (state.isLoading) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-50">
        <div className="h-40 w-full max-w-[420px] animate-pulse rounded-3xl bg-gray-200" />
      </div>
    );
  }

  if (state.isFinished || !currentCard) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
        <header className="flex h-12 items-center justify-between bg-white px-4 shadow-sm">
          <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium">
            <ArrowLeft className="h-4 w-4" /> Назад
          </Link>
          <p className="text-sm text-gray-500">Завершено</p>
        </header>
        <SRSSummaryScreen total={total} results={state.results} sessionXP={sessionXP} />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-gray-50">
      <header className="flex h-12 items-center justify-between bg-white px-4 shadow-sm">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-1 text-sm font-medium">
          <ArrowLeft className="h-4 w-4" /> Назад
        </Link>
        <p className="text-sm text-gray-500">
          Прогресс: {progressCurrent}/{Math.max(total, 1)}
        </p>
      </header>

      <div className="flex flex-1 items-center justify-center p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentCard.id}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.95 }}
            animate={reduceMotion ? { opacity: 1 } : { opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, x: 120 }}
            transition={{ duration: 0.3 }}
          >
            <Flashcard
              card={currentCard}
              isRevealed={state.isRevealed}
              onReveal={() => dispatch({ type: "reveal" })}
            />
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="sticky bottom-0 bg-gray-50/95 px-4 pb-[calc(env(safe-area-inset-bottom)+0.875rem)] pt-2 backdrop-blur supports-[backdrop-filter]:bg-gray-50/75">
        <p className="mb-2 text-center text-sm text-gray-600">Осталось слов: {state.queue.length}</p>
        <p className="mb-3 text-center text-sm font-medium text-gray-800">XP за сессию: {sessionXP}</p>
        {reviewError ? <p className="mb-2 text-center text-xs text-red-600">{reviewError}</p> : null}
        <div className="flex justify-center">
          <SRSRatingButtons
            onRate={handleRate}
            disabled={!state.isRevealed}
            isInputLocked={state.isInputLocked}
          />
        </div>
      </div>
    </div>
  );
}
