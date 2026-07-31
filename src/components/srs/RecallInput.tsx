"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import type { FlashcardData, SRSRating } from "@/types/srs";

interface RecallInputProps {
  card: FlashcardData;
  allCards: FlashcardData[];
  onRate: (rating: SRSRating) => void;
}

function normalize(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[1iIlL|]/g, "I")
    .replace(/\s+/g, " ");
}

type CheckResult =
  | { type: "correct"; typo: false }
  | { type: "correct"; typo: true; inputWord: string; correctWord: string }
  | { type: "wrong" };

function checkAnswer(input: string, correct: string): CheckResult {
  const a = normalize(input);
  const b = normalize(correct);

  if (a === b) return { type: "correct", typo: false };

  if (correct.length > 5) {
    if (Math.abs(a.length - b.length) > 1) return { type: "wrong" };

    const longer = a.length >= b.length ? a : b;
    const shorter = a.length >= b.length ? b : a;
    let diffs = 0;
    let i = 0;
    let j = 0;

    while (i < longer.length && j < shorter.length) {
      if (longer[i] !== shorter[j]) {
        diffs++;
        if (diffs > 1) return { type: "wrong" };
        if (longer.length > shorter.length) i++;
        else if (longer.length < shorter.length) j++;
        else {
          i++;
          j++;
        }
      } else {
        i++;
        j++;
      }
    }

    const totalDiffs = diffs + (longer.length - i);
    if (totalDiffs <= 1) {
      return { type: "correct", typo: true, inputWord: input, correctWord: correct };
    }
  }

  return { type: "wrong" };
}

type AlignedPair = { inp: string | null; cor: string | null };

function alignStrings(input: string, correct: string): AlignedPair[] {
  const pairs: AlignedPair[] = [];
  let i = 0;
  let j = 0;

  while (i < input.length || j < correct.length) {
    const a = input[i] ?? null;
    const b = correct[j] ?? null;

    if (a === null) {
      pairs.push({ inp: null, cor: b });
      j++;
    } else if (b === null) {
      pairs.push({ inp: a, cor: null });
      i++;
    } else if (normalize(a) === normalize(b)) {
      pairs.push({ inp: a, cor: b });
      i++;
      j++;
    } else {
      const nextInputMatchesCorrect =
        input[i + 1] != null && normalize(input[i + 1]) === normalize(b);
      const nextCorrectMatchesInput =
        correct[j + 1] != null && normalize(a) === normalize(correct[j + 1]);

      if (nextInputMatchesCorrect && !nextCorrectMatchesInput) {
        pairs.push({ inp: a, cor: null });
        i++;
      } else if (nextCorrectMatchesInput && !nextInputMatchesCorrect) {
        pairs.push({ inp: null, cor: b });
        j++;
      } else {
        pairs.push({ inp: a, cor: b });
        i++;
        j++;
      }
    }
  }

  return pairs;
}

function InputHighlight({ input, correct }: { input: string; correct: string }) {
  const pairs = alignStrings(input, correct);

  return (
    <span className="text-xl font-bold leading-snug">
      {pairs.map((p, i) => {
        if (p.inp === null) {
          return (
            <span key={i} className="rounded bg-lk-gold-dim px-0.5 text-lk-gold/50">
              _
            </span>
          );
        }
        if (p.cor === null) {
          return (
            <span key={i} className="rounded bg-lk-gold-dim px-0.5 text-lk-gold line-through">
              {p.inp}
            </span>
          );
        }
        if (normalize(p.inp) !== normalize(p.cor)) {
          return (
            <span key={i} className="rounded bg-lk-gold-dim px-0.5 text-lk-gold">
              {p.inp}
            </span>
          );
        }
        return (
          <span key={i} className="text-lk-text">
            {p.inp}
          </span>
        );
      })}
    </span>
  );
}

function CorrectHighlight({ input, correct }: { input: string; correct: string }) {
  const pairs = alignStrings(input, correct);

  return (
    <span className="text-xl font-bold leading-snug">
      {pairs.map((p, i) => {
        if (p.inp === null) {
          return (
            <span key={i} className="rounded bg-lk-green/40 px-0.5 text-lk-text">
              {p.cor}
            </span>
          );
        }
        if (p.cor === null) return null;
        if (normalize(p.inp) !== normalize(p.cor)) {
          return (
            <span key={i} className="rounded bg-lk-green/40 px-0.5 text-lk-text">
              {p.cor}
            </span>
          );
        }
        return (
          <span key={i} className="text-lk-green">
            {p.cor}
          </span>
        );
      })}
    </span>
  );
}

function WrongDiffHighlight({ input, correct }: { input: string; correct: string }) {
  const pairs = alignStrings(input, correct);

  return (
    <span className="text-xl font-bold leading-snug">
      {pairs.map((p, i) => {
        if (p.inp === null) {
          return (
            <span key={i} className="rounded bg-lk-red-dim px-0.5 text-lk-red">
              {p.cor}
            </span>
          );
        }
        if (p.cor === null) return null;
        if (normalize(p.inp) !== normalize(p.cor)) {
          return (
            <span key={i} className="rounded bg-lk-red-dim px-0.5 text-lk-red">
              {p.cor}
            </span>
          );
        }
        return (
          <span key={i} className="text-lk-green">
            {p.cor}
          </span>
        );
      })}
    </span>
  );
}

function findCardByWord(word: string, cards: FlashcardData[]): FlashcardData | null {
  const q = normalize(word);
  return cards.find((c) => normalize(c.word) === q) ?? null;
}

type Phase = "input" | "wrong" | "correct-exact" | "correct-typo";

export function RecallInput({ card, allCards, onRate }: RecallInputProps) {
  const [input, setInput] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [showHint, setShowHint] = useState(false);
  const [inputCard, setInputCard] = useState<FlashcardData | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const advancedRef = useRef(false);

  useEffect(() => {
    setInput("");
    setPhase("input");
    setShowHint(false);
    setInputCard(null);
    advancedRef.current = false;
    const t = window.setTimeout(() => inputRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [card.id]);

  useEffect(() => {
    if (phase === "input") return;
    if (phase === "correct-exact" && !reduceMotion) return;
    const t = window.setTimeout(() => continueRef.current?.focus(), 80);
    return () => window.clearTimeout(t);
  }, [phase, reduceMotion]);

  // Exact correct → auto-advance (~600ms), unless reduced motion
  useEffect(() => {
    if (phase !== "correct-exact") return;
    if (reduceMotion) return;
    if (advancedRef.current) return;

    const t = window.setTimeout(() => {
      if (advancedRef.current) return;
      advancedRef.current = true;
      onRate("know");
    }, 600);

    return () => window.clearTimeout(t);
  }, [phase, reduceMotion, onRate]);

  const handleSubmit = () => {
    if (!input.trim() || phase !== "input") return;
    const result = checkAnswer(input, card.word);

    if (result.type === "correct") {
      setPhase(result.typo ? "correct-typo" : "correct-exact");
    } else {
      setInputCard(findCardByWord(input, allCards));
      setPhase("wrong");
    }
  };

  const handleContinue = () => {
    if (advancedRef.current) return;
    advancedRef.current = true;
    onRate(phase === "wrong" ? "forgot" : "know");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit();
  };

  const handleContinueKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleContinue();
    }
  };

  return (
    <div className="w-full max-w-sm space-y-4">
      <div className="rounded-3xl border border-lk-line bg-lk-card p-7 text-center shadow-lk">
        <p className="mb-2 text-xs font-medium text-lk-muted">Как по-лакски?</p>
        <p className="font-serif text-3xl font-bold text-lk-text">{card.translation}</p>
        {card.exampleSentence && (
          <p className="mt-3 text-sm italic leading-relaxed text-lk-muted">
            «{card.exampleSentence}»
          </p>
        )}
      </div>

      {phase === "input" && (
        <div className="space-y-3">
          <div className="flex min-h-[52px] overflow-hidden rounded-2xl border-2 border-lk-line bg-lk-card transition-colors focus-within:border-lk-gold">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Введи слово на лакском..."
              className="flex-1 bg-transparent px-5 py-4 text-lg text-lk-text outline-none placeholder:text-lk-faint"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
            />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!input.trim()}
              className="px-5 text-sm font-semibold text-lk-gold transition hover:text-lk-gold-hi disabled:text-lk-faint"
            >
              Ввод
            </button>
          </div>

          <p className="text-center text-xs text-lk-faint">
            Вместо Ӏ можно писать I, 1, l или |
          </p>

          <div className="text-center">
            {!showHint ? (
              <button
                type="button"
                onClick={() => setShowHint(true)}
                className="text-xs text-lk-muted underline underline-offset-2 hover:text-lk-text"
              >
                Показать подсказку
              </button>
            ) : (
              <p className="text-sm text-lk-muted">
                Начинается на <span className="font-bold text-lk-text">{card.word[0]}</span>
                {card.word.length > 1 && (
                  <span className="text-lk-faint"> · {card.word.length} букв</span>
                )}
              </p>
            )}
          </div>
        </div>
      )}

      {phase === "wrong" && (
        <div className="space-y-3" aria-live="polite">
          <div className="rounded-2xl border-2 border-lk-red/40 bg-lk-red-dim px-5 py-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-lk-red">
              Твой ответ
            </p>
            <p className="text-lg font-semibold text-lk-red line-through decoration-lk-red/60">
              {input}
            </p>
            {inputCard ? (
              <p className="mt-1.5 text-sm text-lk-red/90">
                «{input}» — это <span className="font-semibold">«{inputCard.translation}»</span>
              </p>
            ) : (
              <p className="mt-1.5 text-xs italic text-lk-red/80">Такого слова нет в словаре</p>
            )}
          </div>

          <div className="rounded-2xl border-2 border-lk-green/40 bg-lk-green-dim px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-lk-green">
              Правильный ответ
            </p>
            <WrongDiffHighlight input={input} correct={card.word} />
            <p className="mt-1.5 text-sm text-lk-text">= {card.translation}</p>
            {card.transcription && (
              <p className="mt-0.5 font-mono text-xs text-lk-muted">[{card.transcription}]</p>
            )}
          </div>

          <button
            ref={continueRef}
            type="button"
            onClick={handleContinue}
            onKeyDown={handleContinueKey}
            className="w-full rounded-2xl border-2 border-lk-line bg-lk-card py-4 text-sm font-semibold text-lk-text transition hover:bg-lk-card2 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lk-gold"
          >
            Понятно, продолжить
          </button>
        </div>
      )}

      {phase === "correct-exact" && (
        <div className="space-y-3" aria-live="polite">
          <div className="rounded-2xl border-2 border-lk-green/40 bg-lk-green-dim px-5 py-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-lk-green">
              Верно
            </p>
            <p className="text-xl font-bold text-lk-text">{card.word}</p>
            <p className="mt-1 text-sm text-lk-muted">= {card.translation}</p>
            {card.transcription && (
              <p className="mt-0.5 font-mono text-xs text-lk-muted">[{card.transcription}]</p>
            )}
          </div>

          <button
            ref={continueRef}
            type="button"
            onClick={handleContinue}
            onKeyDown={handleContinueKey}
            className="w-full rounded-2xl bg-lk-green py-4 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lk-green"
          >
            Продолжить
          </button>
        </div>
      )}

      {phase === "correct-typo" && (
        <div className="space-y-3" aria-live="polite">
          <div className="rounded-2xl border-2 border-lk-gold-border bg-lk-gold-dim px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-lk-gold">
              Почти верно — небольшая опечатка
            </p>
            <InputHighlight input={input} correct={card.word} />
            <p className="mt-2 text-xs text-lk-muted">
              <span className="inline-block rounded bg-lk-gold-dim px-1 text-lk-gold">золотым</span>
              {" "}
              — буква, которую ты ввёл неправильно
            </p>
          </div>

          <div className="rounded-2xl border-2 border-lk-green/40 bg-lk-green-dim px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-lk-green">
              Правильно пишется
            </p>
            <CorrectHighlight input={input} correct={card.word} />
            <p className="mt-2 text-xs text-lk-muted">
              <span className="inline-block rounded bg-lk-green/40 px-1 text-lk-text">зелёным</span>
              {" "}
              — буква, которая должна быть
            </p>
            <p className="mt-1.5 text-sm text-lk-text">= {card.translation}</p>
            {card.transcription && (
              <p className="mt-0.5 font-mono text-xs text-lk-muted">[{card.transcription}]</p>
            )}
          </div>

          <button
            ref={continueRef}
            type="button"
            onClick={handleContinue}
            onKeyDown={handleContinueKey}
            className="w-full rounded-2xl bg-lk-green py-4 text-sm font-semibold text-white transition hover:opacity-90 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lk-green"
          >
            Продолжить
          </button>
        </div>
      )}
    </div>
  );
}
