"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, Eye, EyeOff, RefreshCw, Trophy, X } from "lucide-react";
import type { Lesson } from "@/lib/lessons/types";
import { EXERCISE_TYPES } from "@/lib/lessons/types";
import { buildQuiz, countExercises, wordMap } from "@/lib/lessons/exercises";
import { DialogueView, IntroView, RuleView, SoundView, TextView, WordsView } from "./LessonSteps";
import { ChoiceStepView, MatchExercise, OrderExercise, QuizQuestionView, type ExerciseResult } from "./LessonExercises";
import { RichText } from "./RichText";

const TRANSLATION_KEY = "lk-lesson-show-ru";

type Props = {
  lesson: Lesson;
  initialStep: number;
  nextLesson: { number: number; title: string } | null;
};

type CompleteResult = { wordsAdded: number; wordsTotal: number } | null;

function readShowRu(): boolean {
  try {
    return window.localStorage.getItem(TRANSLATION_KEY) !== "0";
  } catch {
    return true;
  }
}

export function LessonPlayer({ lesson, initialStep, nextLesson }: Props) {
  const words = useMemo(() => wordMap(lesson), [lesson]);
  const total = lesson.steps.length;
  const [index, setIndex] = useState(() => Math.min(Math.max(initialStep, 0), total - 1));
  // Сколько реплик диалога уже показано
  const [revealed, setRevealed] = useState(1);
  // Номер вопроса внутри квиза
  const [quizIndex, setQuizIndex] = useState(0);
  // Выполнено ли текущее упражнение (или вопрос квиза)
  const [answered, setAnswered] = useState(false);
  const [results, setResults] = useState<Record<string, boolean>>({});
  const [showRu, setShowRu] = useState(true);
  const [complete, setComplete] = useState<CompleteResult>(null);
  const [saveError, setSaveError] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const completedRef = useRef(false);

  const step = lesson.steps[index];
  const quiz = useMemo(
    () => (step.type === "quiz" ? buildQuiz(lesson, step, lesson.number * 1000 + index) : []),
    [lesson, step, index]
  );

  useEffect(() => setShowRu(readShowRu()), []);

  const toggleRu = () => {
    setShowRu((v) => {
      try {
        window.localStorage.setItem(TRANSLATION_KEY, v ? "0" : "1");
      } catch {
        /* приватный режим — просто не запоминаем */
      }
      return !v;
    });
  };

  // Сохраняем шаг, чтобы продолжить с того же места
  useEffect(() => {
    if (step.type === "summary") return;
    void fetch(`/api/lessons/${lesson.number}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ step: index })
    }).catch(() => undefined);
  }, [index, lesson.number, step.type]);

  const exerciseTotal = useMemo(() => countExercises(lesson), [lesson]);
  const firstTryCorrect = Object.values(results).filter(Boolean).length;
  const score = exerciseTotal ? Math.round((firstTryCorrect / exerciseTotal) * 100) : 100;

  // Урок пройден — слова уходят в повторение
  useEffect(() => {
    if (step.type !== "summary" || completedRef.current) return;
    completedRef.current = true;
    fetch(`/api/lessons/${lesson.number}/progress`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completed: true, score })
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(String(res.status));
        const body = (await res.json()) as { wordsAdded: number; wordsTotal: number };
        setComplete({ wordsAdded: body.wordsAdded, wordsTotal: body.wordsTotal });
      })
      .catch(() => setSaveError(true));
  }, [step.type, lesson.number, score]);

  const goTo = useCallback(
    (next: number) => {
      setIndex(Math.min(Math.max(next, 0), total - 1));
      setRevealed(1);
      setQuizIndex(0);
      setAnswered(false);
      scrollRef.current?.scrollTo({ top: 0 });
    },
    [total]
  );

  const record = (key: string) => (r: ExerciseResult) => {
    setResults((prev) => (key in prev ? prev : { ...prev, [key]: r.correct }));
    setAnswered(true);
  };

  // ── Кнопка внизу ────────────────────────────────────────────────────────────
  // Упражнение, решённое раньше (вернулись кнопкой «Назад»), можно пропустить
  const stepDone = answered || (step.type === "quiz" ? `${index}.${quizIndex}` : `${index}`) in results;
  const isExercise = EXERCISE_TYPES.has(step.type);
  let primaryLabel = "Дальше";
  let primaryDisabled = false;
  let onPrimary = () => goTo(index + 1);

  if (step.type === "dialogue" && revealed < step.lines.length) {
    primaryLabel = "Следующая реплика";
    onPrimary = () => setRevealed((r) => r + 1);
  } else if (step.type === "quiz" && quizIndex < quiz.length - 1) {
    primaryDisabled = !stepDone;
    onPrimary = () => {
      setQuizIndex((q) => q + 1);
      setAnswered(false);
    };
  } else if (isExercise) {
    primaryDisabled = !stepDone;
  }

  const showTranslationToggle = step.type === "dialogue" || step.type === "text";

  // ── Шаг ─────────────────────────────────────────────────────────────────────
  const key = `${index}`;
  let body: React.ReactNode = null;
  switch (step.type) {
    case "intro":
      body = <IntroView step={step} title={lesson.title} titleLak={lesson.titleLak} number={lesson.number} />;
      break;
    case "sound":
      body = <SoundView step={step} />;
      break;
    case "dialogue":
      body = <DialogueView step={step} revealed={revealed} showRu={showRu} />;
      break;
    case "text":
      body = <TextView step={step} showRu={showRu} />;
      break;
    case "rule":
      body = <RuleView step={step} />;
      break;
    case "words":
      body = <WordsView step={step} words={words} />;
      break;
    case "choice":
      body = <ChoiceStepView key={key} step={step} onDone={record(key)} />;
      break;
    case "order":
      body = <OrderExercise key={key} step={step} seed={lesson.number * 1000 + index} onDone={record(key)} />;
      break;
    case "match":
      body = <MatchExercise key={key} step={step} words={words} seed={lesson.number * 1000 + index} onDone={record(key)} />;
      break;
    case "quiz": {
      const q = quiz[quizIndex];
      const qKey = `${index}.${quizIndex}`;
      body = q ? <QuizQuestionView key={qKey} q={q} index={quizIndex} total={quiz.length} onDone={record(qKey)} /> : null;
      break;
    }
    case "summary":
      body = (
        <div className="text-center">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full border border-lk-gold-border bg-lk-gold-dim">
            <Trophy size={36} className="text-lk-gold" aria-hidden />
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lk-gold">Урок {lesson.number} пройден</p>
          <h2 className="mt-1 font-serif text-2xl font-bold text-lk-text">{lesson.title}</h2>
          <RichText text={step.text} className="mt-4 text-left" />

          <div className="mt-6 grid grid-cols-2 gap-3 text-left">
            <div className="rounded-2xl border border-lk-line bg-lk-card p-4">
              <p className="text-xs text-lk-muted">С первой попытки</p>
              <p className="mt-1 font-serif text-2xl font-bold text-lk-text">{score}%</p>
            </div>
            <div className="rounded-2xl border border-lk-line bg-lk-card p-4">
              <p className="text-xs text-lk-muted">В повторение</p>
              <p className="mt-1 font-serif text-2xl font-bold text-lk-text">
                {complete ? complete.wordsAdded : saveError ? "—" : "…"}
              </p>
            </div>
          </div>
          {complete && complete.wordsAdded < complete.wordsTotal ? (
            <p className="mt-3 text-left text-xs text-lk-muted">
              Остальные слова урока ({complete.wordsTotal - complete.wordsAdded}) уже были в повторении.
            </p>
          ) : null}
          {saveError ? (
            <p className="mt-3 text-left text-sm text-lk-red">Не удалось сохранить прогресс. Проверьте интернет и откройте урок ещё раз.</p>
          ) : null}

          {step.farewell ? (
            <p className="mt-6">
              <span lang="lbe" className="font-serif text-xl font-semibold text-lk-gold">{step.farewell.lak}</span>
              {step.farewell.ru ? <span className="block text-sm text-lk-muted">{step.farewell.ru}</span> : null}
            </p>
          ) : null}
        </div>
      );
      break;
  }

  const progress = ((index + (step.type === "summary" ? 1 : 0)) / total) * 100;

  return (
    <div className="fixed inset-0 flex flex-col bg-lk-bg text-lk-text">
      {/* Верхняя панель */}
      <div className="mx-auto flex w-full max-w-xl items-center gap-2 px-3 pb-2 pt-[max(env(safe-area-inset-top),12px)]">
        <Link
          href="/lessons"
          aria-label="Закрыть урок"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lk-muted active:bg-lk-card"
        >
          <X size={22} />
        </Link>
        <div
          className="h-2 flex-1 overflow-hidden rounded-full bg-lk-card2"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={index + 1}
          aria-label={`Шаг ${index + 1} из ${total}`}
        >
          <div className="h-full rounded-full bg-lk-gold transition-[width] duration-300" style={{ width: `${progress}%` }} />
        </div>
        {showTranslationToggle ? (
          <button
            type="button"
            onClick={toggleRu}
            aria-pressed={showRu}
            aria-label={showRu ? "Скрыть перевод" : "Показать перевод"}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-lk-muted active:bg-lk-card"
          >
            {showRu ? <Eye size={20} /> : <EyeOff size={20} />}
          </button>
        ) : (
          <span className="w-10 shrink-0" aria-hidden />
        )}
      </div>

      {/* Содержание шага */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto overscroll-contain">
        <div className="mx-auto w-full max-w-xl px-4 pb-8 pt-3">{body}</div>
      </div>

      {/* Нижняя панель — в зоне большого пальца */}
      <div className="border-t border-lk-line bg-lk-navy2">
        <div className="mx-auto flex w-full max-w-xl gap-2 px-4 pb-[max(env(safe-area-inset-bottom),12px)] pt-3">
          {step.type === "summary" ? (
            <>
              <Link
                href="/review"
                className="flex h-12 flex-1 items-center justify-center gap-2 rounded-2xl border border-lk-line bg-lk-card text-sm font-semibold text-lk-text"
              >
                <RefreshCw size={16} aria-hidden /> Повторить
              </Link>
              <Link
                href={nextLesson ? `/lessons/${nextLesson.number}` : "/lessons"}
                className="flex h-12 flex-[1.4] items-center justify-center rounded-2xl bg-lk-gold text-sm font-bold text-lk-bg"
              >
                {nextLesson ? `Урок ${nextLesson.number}` : "К урокам"}
              </Link>
            </>
          ) : (
            <>
              {index > 0 ? (
                <button
                  type="button"
                  onClick={() => goTo(index - 1)}
                  aria-label="Назад"
                  className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-lk-line bg-lk-card text-lk-muted"
                >
                  <ChevronLeft size={20} />
                </button>
              ) : null}
              <button
                type="button"
                onClick={onPrimary}
                disabled={primaryDisabled}
                className="h-12 flex-1 rounded-2xl bg-lk-gold text-sm font-bold text-lk-bg transition active:scale-[0.99] disabled:bg-lk-card2 disabled:text-lk-muted"
              >
                {primaryLabel}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
