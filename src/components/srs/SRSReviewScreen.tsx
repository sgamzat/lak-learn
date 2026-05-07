"use client";

import { useEffect, useMemo, useReducer } from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { getSRSQueue } from "@/lib/api/client";
import { Flashcard } from "@/components/srs/Flashcard";
import { SRSRatingButtons } from "@/components/srs/SRSRatingButtons";
import { SRSSummaryScreen } from "@/components/srs/SRSSummaryScreen";
import type { FlashcardData, SRSRating, SRSReviewState } from "@/types/srs";

type Action =
  | { type: "load_start" }
  | { type: "load_success"; payload: FlashcardData[] }
  | { type: "reveal" }
  | { type: "rate"; payload: SRSRating };

const initialState: SRSReviewState = {
  queue: [],
  currentIndex: 0,
  isRevealed: false,
  results: [],
  isFinished: false,
  isLoading: true
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
        results: []
      };
    case "reveal":
      return { ...state, isRevealed: !state.isRevealed };
    case "rate": {
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
        isFinished: finished
      };
    }
    default:
      return state;
  }
}

export function SRSReviewScreen() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    dispatch({ type: "load_start" });
    getSRSQueue().then((queue) => {
      dispatch({ type: "load_success", payload: queue });
    });
  }, []);

  const currentCard = state.queue[state.currentIndex] ?? null;
  const total = useMemo(() => state.results.length + state.queue.length, [state.results.length, state.queue.length]);
  const progressCurrent = state.results.length + (state.isFinished ? 0 : 1);
  const sessionXP = useMemo(
    () => state.results.reduce((sum, item) => sum + getXPByRating(item.rating), 0),
    [state.results]
  );

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === " " || event.key === "Enter") {
        event.preventDefault();
        if (!state.isFinished) {
          dispatch({ type: "reveal" });
        }
      }

      if (event.key === "1") {
        if (!state.isFinished && state.isRevealed) {
          dispatch({ type: "rate", payload: "forgot" });
        }
      }
      if (event.key === "2") {
        if (!state.isFinished && state.isRevealed) {
          dispatch({ type: "rate", payload: "unsure" });
        }
      }
      if (event.key === "3") {
        if (!state.isFinished && state.isRevealed) {
          dispatch({ type: "rate", payload: "know" });
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [state.isFinished, state.isRevealed]);

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

      <div className="px-4 pb-6 pt-2">
        <p className="mb-2 text-center text-sm text-gray-600">Осталось слов: {state.queue.length}</p>
        <p className="mb-3 text-center text-sm font-medium text-gray-800">XP за сессию: {sessionXP}</p>
        <div className="flex justify-center">
          <SRSRatingButtons
            onRate={(rating) => dispatch({ type: "rate", payload: rating })}
            disabled={!state.isRevealed}
          />
        </div>
      </div>
    </div>
  );
}
