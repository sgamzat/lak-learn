"use client";

import { useCallback, useEffect, useMemo, useReducer, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowLeft, Check, HelpCircle, Star, X } from "lucide-react";
import { getSRSQueue, submitSRSReview } from "@/lib/api/client";
import { SwipeCard } from "@/components/srs/SwipeCard";
import { MultipleChoice } from "@/components/srs/MultipleChoice";
import { RecallInput } from "@/components/srs/RecallInput";
import { SRSSummaryScreen } from "@/components/srs/SRSSummaryScreen";
import type { FlashcardData, SRSRating, SRSReviewState } from "@/types/srs";

type ExerciseType = "flashcard" | "choice" | "choice-reverse" | "recall";
type SessionPhase = "loading" | "ready" | "active" | "finished";

function getExerciseType(repetition: number): ExerciseType {
  if (repetition === 0) return "flashcard";
  if (repetition <= 2) return "choice";
  if (repetition % 2 === 0) return "choice-reverse";
  return "recall";
}

function formatIntervalToast(intervalDays: number): string {
  if (intervalDays <= 0) return "Снова сегодня";
  if (intervalDays === 1) return "Снова через 1 день";
  if (intervalDays < 5) return `Снова через ${intervalDays} дня`;
  return `Снова через ${intervalDays} дн.`;
}

type Action =
  | { type: "load_start" }
  | { type: "load_success"; payload: FlashcardData[] }
  | { type: "reveal" }
  | { type: "rate"; payload: SRSRating }
  | { type: "restart"; payload: FlashcardData[] };

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

function StageLabel({ type }: { type: ExerciseType }) {
  const map: Record<ExerciseType, string> = {
    flashcard: "Карточка",
    choice: "Выбор",
    "choice-reverse": "Обратный выбор",
    recall: "Написать",
  };
  return (
    <span className="rounded-full bg-lk-gold-dim px-3 py-1 text-xs font-semibold text-lk-gold">
      {map[type]}
    </span>
  );
}

function pluralCards(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} карточка`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} карточки`;
  return `${n} карточек`;
}

export function SRSReviewScreen() {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [topicTitle, setTopicTitle] = useState<string | null>(null);
  const [sessionCards, setSessionCards] = useState<FlashcardData[]>([]);
  const [remaining, setRemaining] = useState(0);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [hasStarted, setHasStarted] = useState(false);
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [intervalToast, setIntervalToast] = useState<string | null>(null);
  const [continueLoading, setContinueLoading] = useState(false);

  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const searchParams = useSearchParams();
  const collectionIdRaw = searchParams.get("collectionId");
  const collectionId = collectionIdRaw ? Number.parseInt(collectionIdRaw, 10) : Number.NaN;
  const scopedCollectionId =
    Number.isInteger(collectionId) && collectionId > 0 ? collectionId : undefined;
  const fromParam = searchParams.get("from");
  const backHref =
    fromParam === "dashboard"
      ? "/dashboard"
      : scopedCollectionId
        ? "/phrasebook"
        : "/dashboard";
  const backLabel =
    fromParam === "dashboard"
      ? "На главную"
      : scopedCollectionId
        ? "Разговорник"
        : "На главную";

  const loadQueue = useCallback(
    (opts?: { autoStart?: boolean }) => {
      dispatch({ type: "load_start" });
      setHasStarted(false);
      if (opts?.autoStart) setContinueLoading(true);

      return getSRSQueue(scopedCollectionId)
        .then((result) => {
          setReviewError(null);
          setTopicTitle(result.collectionTitle ?? null);
          setSessionCards(result.queue);
          setRemaining(result.remaining);
          setTotalAvailable(result.totalAvailable);
          dispatch({ type: "load_success", payload: result.queue });
          if (opts?.autoStart && result.queue.length > 0) {
            setHasStarted(true);
          }
        })
        .catch(() => {
          setReviewError("Не удалось загрузить очередь");
          setTopicTitle(null);
          setRemaining(0);
          setTotalAvailable(0);
          dispatch({ type: "load_success", payload: [] });
        })
        .finally(() => setContinueLoading(false));
    },
    [scopedCollectionId]
  );

  useEffect(() => {
    void loadQueue();
  }, [loadQueue]);

  useEffect(() => {
    if (!intervalToast) return;
    const t = window.setTimeout(() => setIntervalToast(null), 1200);
    return () => window.clearTimeout(t);
  }, [intervalToast]);

  const currentCard = state.queue[state.currentIndex] ?? null;

  const total = useMemo(
    () => state.results.length + state.queue.length,
    [state.results.length, state.queue.length]
  );
  const progressPercent =
    total > 0 ? Math.round((state.results.length / total) * 100) : 0;

  const sessionXP = useMemo(
    () => state.results.reduce((sum, r) => sum + getXPByRating(r.rating), 0),
    [state.results]
  );

  const exerciseType = currentCard
    ? getExerciseType(currentCard.repetition ?? 0)
    : "flashcard";

  const phase: SessionPhase = state.isLoading
    ? "loading"
    : state.isFinished || (!currentCard && hasStarted) || (state.queue.length === 0 && !hasStarted)
      ? "finished"
      : !hasStarted
        ? "ready"
        : "active";

  const handleRate = useCallback(
    (rating: SRSRating) => {
      if (state.isFinished) return;
      const activeCard = state.queue[state.currentIndex];
      if (!activeCard) return;

      dispatch({ type: "rate", payload: rating });

      submitSRSReview(activeCard.id, rating)
        .then((res) => {
          setReviewError(null);
          if (typeof res.intervalDays === "number") {
            setIntervalToast(formatIntervalToast(res.intervalDays));
          }
        })
        .catch(() => setReviewError("Не сохранилось, проверьте соединение"));
    },
    [state.currentIndex, state.isFinished, state.queue]
  );

  const handleRestart = useCallback(() => {
    const forgotIds = new Set(
      state.results.filter((r) => r.rating === "forgot").map((r) => r.cardId)
    );
    const forgotCards = sessionCards
      .filter((c) => forgotIds.has(c.id))
      .map((c) => ({ ...c, repetition: 0 }));

    setHasStarted(true);
    setRemaining(0);
    setReviewError(null);
    dispatch({ type: "restart", payload: forgotCards });
  }, [sessionCards, state.results]);

  const handleContinueLesson = useCallback(() => {
    void loadQueue({ autoStart: true });
  }, [loadQueue]);

  const requestExit = useCallback(() => {
    if (phase === "active") {
      setShowExitConfirm(true);
      return;
    }
    router.push(backHref);
  }, [phase, router, backHref]);

  const confirmExit = useCallback(() => {
    setShowExitConfirm(false);
    router.push(backHref);
  }, [router, backHref]);

  // Keyboard: flashcard + Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.repeat) return;

      if (e.key === "Escape") {
        e.preventDefault();
        if (showExitConfirm) {
          setShowExitConfirm(false);
          return;
        }
        requestExit();
        return;
      }

      if (phase !== "active" || exerciseType !== "flashcard") return;

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
  }, [
    exerciseType,
    handleRate,
    phase,
    requestExit,
    showExitConfirm,
    state.isRevealed,
  ]);

  // ── Loading ────────────────────────────────────────────────────────────────
  if (phase === "loading") {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-lk-bg">
        <div className="w-full max-w-sm space-y-3 px-4">
          <div className="h-64 animate-pulse rounded-3xl border border-lk-line bg-lk-card" />
          <div className="h-14 animate-pulse rounded-2xl bg-lk-card2" />
          <p className="text-center text-sm text-lk-faint">Загрузка…</p>
        </div>
      </div>
    );
  }

  // ── Pre-session ────────────────────────────────────────────────────────────
  if (phase === "ready") {
    const mins = Math.max(1, Math.ceil(total * 0.25));
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-lk-bg text-lk-text">
        <header className="flex h-12 shrink-0 items-center justify-between px-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-lk-muted hover:text-lk-text"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Выйти</span>
          </Link>
          <div className="w-16" />
        </header>

        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-6 text-center">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-lk-gold">
              Короткий урок
            </p>
            <h1 className="mt-2 font-serif text-3xl font-bold text-lk-text">
              {topicTitle ?? "Готовы начать?"}
            </h1>
            <p className="mt-3 text-sm text-lk-muted">
              {pluralCards(total)} · ~{mins} мин
            </p>
            {remaining > 0 && (
              <p className="mt-1.5 text-xs text-lk-faint">
                Всего доступно {totalAvailable} · ещё {remaining} после этого урока
              </p>
            )}
          </div>

          {reviewError && (
            <p className="text-sm text-lk-red" role="alert">
              {reviewError}
            </p>
          )}

          <div className="flex w-full max-w-xs flex-col gap-2">
            <button
              type="button"
              onClick={() => setHasStarted(true)}
              className="rounded-2xl bg-lk-gold py-3.5 text-sm font-semibold text-lk-bg transition hover:opacity-90 active:scale-[0.98]"
            >
              Начать урок
            </button>
            <Link
              href={backHref}
              className="rounded-2xl border border-lk-line bg-lk-card py-3.5 text-sm font-semibold text-lk-text transition hover:bg-lk-card2"
            >
              {backLabel}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // ── Finished ───────────────────────────────────────────────────────────────
  if (phase === "finished") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-lk-bg text-lk-text">
        <header className="flex h-12 shrink-0 items-center justify-between border-b border-lk-line px-4">
          <Link
            href={backHref}
            className="inline-flex items-center gap-1.5 text-sm text-lk-muted hover:text-lk-text"
          >
            <ArrowLeft className="h-4 w-4" /> {backLabel}
          </Link>
          <p className="truncate px-2 text-sm font-medium text-lk-muted">
            {topicTitle ? `Итоги · ${topicTitle}` : "Итоги"}
          </p>
          <div className="w-16" />
        </header>
        <SRSSummaryScreen
          total={total}
          results={state.results}
          sessionXP={sessionXP}
          sessionCards={sessionCards}
          remaining={remaining}
          onRestart={handleRestart}
          onContinueLesson={handleContinueLesson}
          continueLoading={continueLoading}
          backHref={backHref}
          backLabel={backLabel}
        />
      </div>
    );
  }

  // ── Active session ─────────────────────────────────────────────────────────
  if (!currentCard) return null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-lk-bg text-lk-text">
      <header className="shrink-0 border-b border-lk-line bg-lk-navy2">
        <div className="flex h-12 items-center justify-between gap-2 px-4">
          <button
            type="button"
            onClick={requestExit}
            className="inline-flex shrink-0 items-center gap-1.5 text-sm text-lk-muted hover:text-lk-text"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Выйти</span>
          </button>

          <div className="min-w-0 flex-1 text-center">
            {topicTitle ? (
              <p className="truncate text-xs font-semibold text-lk-muted">{topicTitle}</p>
            ) : null}
            <div className="flex items-center justify-center gap-2">
              <StageLabel type={exerciseType} />
              <span className="text-xs font-medium text-lk-faint">
                {state.results.length + 1} из {total}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 rounded-full bg-lk-gold-dim px-3 py-1 text-xs font-semibold text-lk-gold">
            <Star className="h-3 w-3" fill="currentColor" />
            {sessionXP}
          </div>
        </div>

        {reviewError && (
          <p className="bg-lk-red-dim px-4 py-1.5 text-center text-xs text-lk-red" role="alert">
            {reviewError}
          </p>
        )}

        <div className="h-1 bg-lk-card2">
          <div
            className="h-full bg-lk-gold transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {total <= 12 && (
          <div className="flex items-center justify-center gap-1 py-1.5">
            {Array.from({ length: total }).map((_, i) => {
              const result = state.results[i];
              let dot = "w-2 bg-lk-faint/40";
              if (result) {
                if (result.rating === "know") dot = "w-4 bg-lk-green";
                else if (result.rating === "unsure") dot = "w-4 bg-lk-gold";
                else dot = "w-4 bg-lk-red";
              } else if (i === state.results.length) {
                dot = "w-4 bg-lk-gold";
              }
              return (
                <div
                  key={i}
                  className={`h-1.5 rounded-full transition-all duration-300 ${dot}`}
                />
              );
            })}
          </div>
        )}
      </header>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 py-4">
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
                allCards={sessionCards}
                reverse={false}
                onRate={handleRate}
              />
            )}
            {exerciseType === "choice-reverse" && (
              <MultipleChoice
                card={currentCard}
                allCards={sessionCards}
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

        {intervalToast && (
          <div
            className="pointer-events-none absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-full border border-lk-line bg-lk-card2 px-4 py-2 text-xs font-medium text-lk-text shadow-lk"
            role="status"
            aria-live="polite"
          >
            {intervalToast}
          </div>
        )}
      </div>

      {/* Sticky rating footer — flashcard only */}
      {exerciseType === "flashcard" && (
        <div className="shrink-0 border-t border-lk-line bg-lk-navy2 px-4 pb-[calc(env(safe-area-inset-bottom)+0.75rem)] pt-3">
          {!state.isRevealed ? (
            <p className="text-center text-xs text-lk-faint">Нажми · Space / Enter</p>
          ) : (
            <div className="mx-auto flex w-full max-w-sm gap-2">
              <button
                type="button"
                onClick={() => handleRate("forgot")}
                className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-lk-red/30 bg-lk-red-dim text-sm font-semibold text-lk-red transition hover:opacity-90 active:scale-[0.97]"
              >
                <X className="h-4 w-4" />
                Забыл
                <span className="font-mono text-[10px] opacity-60">1</span>
              </button>
              <button
                type="button"
                onClick={() => handleRate("unsure")}
                className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-lk-gold-border bg-lk-gold-dim text-sm font-semibold text-lk-gold transition hover:opacity-90 active:scale-[0.97]"
              >
                <HelpCircle className="h-4 w-4" />
                Не уверен
                <span className="font-mono text-[10px] opacity-60">2</span>
              </button>
              <button
                type="button"
                onClick={() => handleRate("know")}
                className="flex min-h-[52px] flex-1 flex-col items-center justify-center gap-0.5 rounded-2xl border-2 border-lk-green/30 bg-lk-green-dim text-sm font-semibold text-lk-green transition hover:opacity-90 active:scale-[0.97]"
              >
                <Check className="h-4 w-4" />
                Знаю
                <span className="font-mono text-[10px] opacity-60">3</span>
              </button>
            </div>
          )}
        </div>
      )}

      {/* Exit confirm */}
      {showExitConfirm && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-5 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="exit-title"
        >
          <div className="w-full max-w-sm rounded-3xl border border-lk-line bg-lk-card p-6 shadow-lk">
            <h2 id="exit-title" className="font-serif text-xl font-bold text-lk-text">
              Выйти из сессии?
            </h2>
            <p className="mt-2 text-sm text-lk-muted">
              Пройдено {state.results.length} из {total}
            </p>
            <div className="mt-5 flex flex-col gap-2">
              <button
                type="button"
                onClick={confirmExit}
                className="rounded-2xl bg-lk-red py-3 text-sm font-semibold text-white transition hover:opacity-90"
              >
                Выйти
              </button>
              <button
                type="button"
                onClick={() => setShowExitConfirm(false)}
                className="rounded-2xl border border-lk-line bg-lk-card2 py-3 text-sm font-semibold text-lk-text transition hover:bg-lk-navy3"
              >
                Остаться
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
