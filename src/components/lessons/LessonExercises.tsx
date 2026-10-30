"use client";

import { useMemo, useState } from "react";
import { Check, X } from "lucide-react";
import type { ChoiceStep, LessonWord, MatchStep, OrderStep } from "@/lib/lessons/types";
import { isOrderCorrect, orderTokens, seededRandom, shuffle, shuffleNotIdentity, type QuizQuestion } from "@/lib/lessons/exercises";
import { StepTitle } from "./LessonSteps";

/** Итог упражнения: correct — с первой попытки */
export type ExerciseResult = { correct: boolean };

function Feedback({ correct, answer, explain }: { correct: boolean; answer?: string; explain?: string }) {
  return (
    <div
      role="status"
      className={[
        "mt-4 rounded-2xl border p-4",
        correct ? "border-lk-green/40 bg-lk-green-dim" : "border-lk-red/40 bg-lk-red-dim"
      ].join(" ")}
    >
      <p className={`flex items-center gap-2 text-sm font-semibold ${correct ? "text-lk-green" : "text-lk-red"}`}>
        {correct ? <Check size={16} aria-hidden /> : <X size={16} aria-hidden />}
        {correct ? "Верно!" : "Не совсем"}
      </p>
      {!correct && answer ? (
        <p className="mt-2 text-sm text-lk-text">
          Правильно: <span lang="lbe" className="font-serif text-base font-semibold">{answer}</span>
        </p>
      ) : null}
      {explain ? <p className="mt-1.5 text-sm text-lk-muted">{explain}</p> : null}
    </div>
  );
}

// ─── Выбор варианта ──────────────────────────────────────────────────────────

type ChoiceProps = {
  kicker?: string;
  prompt: string;
  promptIsLak?: boolean;
  options: string[];
  answer: number;
  explain?: string;
  optionsAreLak?: boolean;
  onDone: (result: ExerciseResult) => void;
};

export function ChoiceExercise({ kicker = "Выберите ответ", prompt, promptIsLak, options, answer, explain, optionsAreLak, onDone }: ChoiceProps) {
  const [picked, setPicked] = useState<number | null>(null);

  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    onDone({ correct: i === answer });
  };

  return (
    <div>
      <StepTitle kicker={kicker} />
      <p
        lang={promptIsLak ? "lbe" : undefined}
        className={promptIsLak ? "mb-6 font-serif text-3xl font-bold text-lk-text" : "mb-6 text-lg font-semibold leading-snug text-lk-text"}
      >
        {prompt}
      </p>
      <div className="space-y-2.5" role="group" aria-label="Варианты ответа">
        {options.map((option, i) => {
          let style = "border-lk-line bg-lk-card text-lk-text active:bg-lk-card2";
          if (picked !== null) {
            if (i === answer) style = "border-lk-green/60 bg-lk-green-dim text-lk-text";
            else if (i === picked) style = "border-lk-red/60 bg-lk-red-dim text-lk-text";
            else style = "border-lk-line bg-lk-card text-lk-muted opacity-60";
          }
          return (
            <button
              key={`${option}-${i}`}
              type="button"
              disabled={picked !== null}
              onClick={() => pick(i)}
              className={`flex min-h-[52px] w-full items-center justify-between gap-3 rounded-2xl border-2 px-4 py-3 text-left transition active:scale-[0.99] ${style}`}
            >
              <span lang={optionsAreLak ? "lbe" : undefined} className={optionsAreLak ? "font-serif text-lg font-semibold" : "text-[15px]"}>
                {option}
              </span>
              {picked !== null && i === answer ? <Check size={18} className="shrink-0 text-lk-green" aria-hidden /> : null}
              {picked !== null && i === picked && i !== answer ? <X size={18} className="shrink-0 text-lk-red" aria-hidden /> : null}
            </button>
          );
        })}
      </div>
      {picked !== null && (picked !== answer || explain) ? (
        <Feedback correct={picked === answer} explain={explain} />
      ) : null}
    </div>
  );
}

export function ChoiceStepView({ step, onDone }: { step: ChoiceStep; onDone: (r: ExerciseResult) => void }) {
  return (
    <ChoiceExercise
      prompt={step.prompt}
      options={step.options}
      answer={step.answer}
      explain={step.explain}
      optionsAreLak={!step.optionsRu}
      onDone={onDone}
    />
  );
}

// ─── Собрать фразу ───────────────────────────────────────────────────────────

export function OrderExercise({ step, seed, onDone }: { step: OrderStep; seed: number; onDone: (r: ExerciseResult) => void }) {
  const tokens = useMemo(() => {
    const base = [...orderTokens(step.answer), ...(step.extra ?? [])];
    const rand = seededRandom(seed);
    return shuffleNotIdentity(
      base.map((t, i) => ({ t, i })),
      rand,
      (a, b) => a.every((x, k) => x.t === b[k]?.t)
    );
  }, [step, seed]);
  const [chosen, setChosen] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);

  const need = orderTokens(step.answer).length;
  const words = chosen.map((i) => tokens.find((t) => t.i === i)!.t);

  const check = () => {
    const ok = isOrderCorrect(words, step.answer);
    setResult(ok);
    onDone({ correct: ok });
  };

  return (
    <div>
      <StepTitle kicker="Соберите фразу" />
      <p className="mb-5 text-lg font-semibold leading-snug text-lk-text">{step.prompt}</p>

      <div
        className={[
          "mb-5 flex min-h-[64px] flex-wrap content-start gap-2 rounded-2xl border-2 border-dashed p-3",
          result === null ? "border-lk-line" : result ? "border-lk-green/60 bg-lk-green-dim" : "border-lk-red/60 bg-lk-red-dim"
        ].join(" ")}
        aria-label="Ваш ответ"
      >
        {chosen.length === 0 ? <span className="self-center px-1 text-sm text-lk-muted">Нажимайте на слова по порядку</span> : null}
        {chosen.map((i) => {
          const tok = tokens.find((t) => t.i === i)!;
          return (
            <button
              key={i}
              type="button"
              disabled={result !== null}
              onClick={() => setChosen((c) => c.filter((x) => x !== i))}
              className="rounded-xl border border-lk-gold-border bg-lk-gold-dim px-3 py-2 font-serif text-lg font-semibold text-lk-text"
            >
              {tok.t}
            </button>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        {tokens.map(({ t, i }) => {
          const used = chosen.includes(i);
          return (
            <button
              key={i}
              type="button"
              disabled={used || result !== null}
              onClick={() => setChosen((c) => [...c, i])}
              className={[
                "rounded-xl border px-3 py-2 font-serif text-lg font-semibold transition active:scale-95",
                used ? "border-lk-line bg-transparent text-transparent" : "border-lk-line bg-lk-card2 text-lk-text"
              ].join(" ")}
              aria-hidden={used}
            >
              {t}
            </button>
          );
        })}
      </div>

      {result === null ? (
        <button
          type="button"
          disabled={chosen.length < need}
          onClick={check}
          className="mt-6 w-full rounded-2xl border border-lk-gold-border bg-lk-card py-3 text-sm font-semibold text-lk-gold disabled:opacity-40"
        >
          Проверить
        </button>
      ) : (
        <Feedback correct={result} answer={step.answer} />
      )}
    </div>
  );
}

// ─── Сопоставить ─────────────────────────────────────────────────────────────

export function MatchExercise({
  step,
  words,
  seed,
  onDone
}: {
  step: MatchStep;
  words: Map<string, LessonWord>;
  seed: number;
  onDone: (r: ExerciseResult) => void;
}) {
  const pairs = useMemo(() => step.words.map((k) => words.get(k)).filter((w): w is LessonWord => Boolean(w)), [step, words]);
  const right = useMemo(() => shuffle(pairs, seededRandom(seed)), [pairs, seed]);
  const [selected, setSelected] = useState<string | null>(null);
  const [matched, setMatched] = useState<Set<string>>(new Set());
  const [wrong, setWrong] = useState<string | null>(null);
  const [mistakes, setMistakes] = useState(0);
  const done = matched.size === pairs.length;

  const pickRight = (lak: string) => {
    if (!selected || matched.has(lak)) return;
    if (selected === lak) {
      const next = new Set(matched).add(lak);
      setMatched(next);
      setSelected(null);
      if (next.size === pairs.length) onDone({ correct: mistakes === 0 });
    } else {
      setMistakes((m) => m + 1);
      setWrong(lak);
      window.setTimeout(() => setWrong(null), 500);
    }
  };

  const cell = "flex min-h-[56px] w-full items-center rounded-2xl border-2 px-3 py-2 text-left transition";

  return (
    <div>
      <StepTitle kicker="Найдите пары" />
      <p className="mb-4 text-sm text-lk-muted">Выберите слово слева, затем перевод справа.</p>
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-2.5">
          {pairs.map((w) => {
            const isDone = matched.has(w.lak);
            const isSel = selected === w.lak;
            return (
              <button
                key={w.lak}
                type="button"
                disabled={isDone}
                onClick={() => setSelected(w.lak)}
                className={`${cell} ${
                  isDone
                    ? "border-lk-green/40 bg-lk-green-dim opacity-60"
                    : isSel
                      ? "border-lk-gold bg-lk-gold-dim"
                      : "border-lk-line bg-lk-card"
                }`}
              >
                <span lang="lbe" className="font-serif text-base font-semibold text-lk-text">{w.lak}</span>
              </button>
            );
          })}
        </div>
        <div className="space-y-2.5">
          {right.map((w) => {
            const isDone = matched.has(w.lak);
            return (
              <button
                key={w.lak}
                type="button"
                disabled={isDone}
                onClick={() => pickRight(w.lak)}
                className={`${cell} ${
                  isDone
                    ? "border-lk-green/40 bg-lk-green-dim opacity-60"
                    : wrong === w.lak
                      ? "border-lk-red bg-lk-red-dim"
                      : "border-lk-line bg-lk-card"
                }`}
              >
                <span className="text-sm leading-snug text-lk-text">{w.ru}</span>
              </button>
            );
          })}
        </div>
      </div>
      {done ? <Feedback correct={mistakes === 0} explain={mistakes ? `Ошибок: ${mistakes}. Эти слова будут в повторении.` : undefined} /> : null}
    </div>
  );
}

// ─── Квиз ────────────────────────────────────────────────────────────────────

export function QuizQuestionView({ q, index, total, onDone }: { q: QuizQuestion; index: number; total: number; onDone: (r: ExerciseResult) => void }) {
  return (
    <ChoiceExercise
      kicker={`${q.promptIsLak ? "Что значит" : "Как по-лакски"} · ${index + 1} из ${total}`}
      prompt={q.prompt}
      promptIsLak={q.promptIsLak}
      options={q.options}
      answer={q.answer}
      optionsAreLak={!q.promptIsLak}
      onDone={onDone}
    />
  );
}
