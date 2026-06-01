"use client";

import { useEffect, useRef, useState } from "react";
import type { FlashcardData, SRSRating } from "@/types/srs";

interface RecallInputProps {
  card: FlashcardData;
  allCards: FlashcardData[];
  onRate: (rating: SRSRating) => void;
}

// ─── Нормализация ─────────────────────────────────────────────────────────────
function normalize(str: string): string {
  return str
    .trim()
    .toLowerCase()
    .replace(/[1iIlL|]/g, "I")
    .replace(/\s+/g, " ");
}

// ─── Результат проверки ───────────────────────────────────────────────────────
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

    const longer  = a.length >= b.length ? a : b;
    const shorter = a.length >= b.length ? b : a;
    let diffs = 0;
    let i = 0, j = 0;

    while (i < longer.length && j < shorter.length) {
      if (longer[i] !== shorter[j]) {
        diffs++;
        if (diffs > 1) return { type: "wrong" };
        if (longer.length > shorter.length) i++;
        else if (longer.length < shorter.length) j++;
        else { i++; j++; }
      } else { i++; j++; }
    }

    const totalDiffs = diffs + (longer.length - i);
    if (totalDiffs <= 1) {
      return { type: "correct", typo: true, inputWord: input, correctWord: correct };
    }
  }

  return { type: "wrong" };
}

// ─── Выравнивание двух строк для попарного сравнения ─────────────────────────
// Возвращает пары [символ_из_input, символ_из_correct]
// null означает что символа нет (пропуск или лишний)
type AlignedPair = { inp: string | null; cor: string | null };

function alignStrings(input: string, correct: string): AlignedPair[] {
  const pairs: AlignedPair[] = [];
  let i = 0, j = 0;

  while (i < input.length || j < correct.length) {
    const a = input[i]   ?? null;
    const b = correct[j] ?? null;

    if (a === null) {
      pairs.push({ inp: null, cor: b });
      j++;
    } else if (b === null) {
      pairs.push({ inp: a, cor: null });
      i++;
    } else if (normalize(a) === normalize(b)) {
      pairs.push({ inp: a, cor: b });
      i++; j++;
    } else {
      // смотрим вперёд — что лучше: замена или пропуск
      const nextInputMatchesCorrect  = input[i + 1]   != null && normalize(input[i + 1])   === normalize(b);
      const nextCorrectMatchesInput  = correct[j + 1] != null && normalize(a)               === normalize(correct[j + 1]);

      if (nextInputMatchesCorrect && !nextCorrectMatchesInput) {
        // в input лишняя буква
        pairs.push({ inp: a, cor: null });
        i++;
      } else if (nextCorrectMatchesInput && !nextInputMatchesCorrect) {
        // в correct лишняя буква (в input пропустили)
        pairs.push({ inp: null, cor: b });
        j++;
      } else {
        // замена
        pairs.push({ inp: a, cor: b });
        i++; j++;
      }
    }
  }

  return pairs;
}

// ─── Компонент: что ввёл пользователь с выделением его ошибочных букв ────────
function InputHighlight({ input, correct }: { input: string; correct: string }) {
  const pairs = alignStrings(input, correct);

  return (
    <span className="text-xl font-bold leading-snug">
      {pairs.map((p, i) => {
        if (p.inp === null) {
          // пропущенная буква — показываем место пропуска
          return (
            <span key={i} className="rounded bg-amber-100 px-0.5 text-amber-300">
              _
            </span>
          );
        }
        if (p.cor === null) {
          // лишняя буква которую ввёл пользователь
          return (
            <span key={i} className="rounded bg-amber-200 px-0.5 text-amber-800 line-through">
              {p.inp}
            </span>
          );
        }
        if (normalize(p.inp) !== normalize(p.cor)) {
          // неверная буква — подсвечиваем именно ту что ввёл
          return (
            <span key={i} className="rounded bg-amber-200 px-0.5 text-amber-800">
              {p.inp}
            </span>
          );
        }
        // верная буква
        return (
          <span key={i} className="text-gray-800">{p.inp}</span>
        );
      })}
    </span>
  );
}

// ─── Компонент: правильное слово с выделением буквы которая должна быть ───────
function CorrectHighlight({ input, correct }: { input: string; correct: string }) {
  const pairs = alignStrings(input, correct);

  return (
    <span className="text-xl font-bold leading-snug">
      {pairs.map((p, i) => {
        if (p.inp === null) {
          // пропущенная буква — выделяем её в правильном слове
          return (
            <span key={i} className="rounded bg-emerald-300 px-0.5 text-emerald-900">
              {p.cor}
            </span>
          );
        }
        if (p.cor === null) {
          // лишняя буква в input — в correct её нет, пропускаем
          return null;
        }
        if (normalize(p.inp) !== normalize(p.cor)) {
          // правильная буква вместо неверной — выделяем
          return (
            <span key={i} className="rounded bg-emerald-300 px-0.5 text-emerald-900">
              {p.cor}
            </span>
          );
        }
        // совпадает
        return (
          <span key={i} className="text-emerald-800">{p.cor}</span>
        );
      })}
    </span>
  );
}

// ─── Компонент: подсветка для полностью неверного ответа ─────────────────────
function WrongDiffHighlight({ input, correct }: { input: string; correct: string }) {
  const pairs = alignStrings(input, correct);

  return (
    <span className="text-xl font-bold leading-snug">
      {pairs.map((p, i) => {
        if (p.inp === null) {
          return (
            <span key={i} className="rounded bg-red-200 px-0.5 text-red-700">{p.cor}</span>
          );
        }
        if (p.cor === null) return null;
        if (normalize(p.inp) !== normalize(p.cor)) {
          return (
            <span key={i} className="rounded bg-red-200 px-0.5 text-red-700">{p.cor}</span>
          );
        }
        return <span key={i} className="text-emerald-800">{p.cor}</span>;
      })}
    </span>
  );
}

// Поиск введённого слова в карточках сессии
function findCardByWord(word: string, cards: FlashcardData[]): FlashcardData | null {
  const q = normalize(word);
  return cards.find((c) => normalize(c.word) === q) ?? null;
}

// ─── Фазы ─────────────────────────────────────────────────────────────────────
type Phase = "input" | "wrong" | "correct-exact" | "correct-typo";

// ─── Основной компонент ───────────────────────────────────────────────────────
export function RecallInput({ card, allCards, onRate }: RecallInputProps) {
  const [input, setInput]         = useState("");
  const [phase, setPhase]         = useState<Phase>("input");
  const [showHint, setShowHint]   = useState(false);
  const [inputCard, setInputCard] = useState<FlashcardData | null>(null);

  const inputRef    = useRef<HTMLInputElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setInput("");
    setPhase("input");
    setShowHint(false);
    setInputCard(null);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [card.id]);

  useEffect(() => {
    if (phase !== "input") {
      setTimeout(() => continueRef.current?.focus(), 80);
    }
  }, [phase]);

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
    onRate(phase === "wrong" ? "forgot" : "know");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") handleSubmit();
  };

  const handleContinueKey = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleContinue(); }
  };

  return (
    <div className="w-full max-w-sm space-y-4">

      {/* Этап */}
      <div className="text-center">
        <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-600">
          Этап 3 · Напиши слово
        </span>
      </div>

      {/* Задание */}
      <div className="rounded-3xl bg-white p-7 text-center shadow-lg">
        <p className="mb-2 text-xs font-medium text-gray-400">Как по-лакски?</p>
        <p className="text-3xl font-bold text-gray-900">{card.translation}</p>
        {card.exampleSentence && (
          <p className="mt-3 text-sm italic leading-relaxed text-gray-400">
            «{card.exampleSentence}»
          </p>
        )}
      </div>

      {/* ── Ввод ────────────────────────────────────────────────────────── */}
      {phase === "input" && (
        <div className="space-y-3">
          <div className="flex overflow-hidden rounded-2xl border-2 border-gray-200 bg-white transition-colors focus-within:border-blue-400">
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Введи слово на лакском..."
              className="flex-1 bg-transparent px-5 py-4 text-lg text-gray-900 outline-none placeholder:text-gray-300"
              autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            />
            <button
              type="button" onClick={handleSubmit} disabled={!input.trim()}
              className="px-5 text-sm font-semibold text-blue-600 transition hover:text-blue-800 disabled:text-gray-300"
            >
              Ввод
            </button>
          </div>

          <p className="text-center text-xs text-gray-400">
            Вместо Ӏ можно писать I, 1, l или |
          </p>

          <div className="text-center">
            {!showHint ? (
              <button type="button" onClick={() => setShowHint(true)}
                className="text-xs text-gray-400 underline underline-offset-2 hover:text-gray-600">
                Показать подсказку
              </button>
            ) : (
              <p className="text-sm text-gray-500">
                Начинается на <span className="font-bold text-gray-800">{card.word[0]}</span>
                {card.word.length > 1 && <span className="text-gray-400"> · {card.word.length} букв</span>}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ── Неверно ──────────────────────────────────────────────────────── */}
      {phase === "wrong" && (
        <div className="space-y-3">
          <div className="rounded-2xl border-2 border-red-200 bg-red-50 px-5 py-4">
            <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-red-400">Твой ответ</p>
            <p className="text-lg font-semibold text-red-700 line-through decoration-red-400">{input}</p>
            {inputCard ? (
              <p className="mt-1.5 text-sm text-red-500">
                «{input}» — это <span className="font-semibold">«{inputCard.translation}»</span>
              </p>
            ) : (
              <p className="mt-1.5 text-xs italic text-red-400">Такого слова нет в словаре</p>
            )}
          </div>

          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-500">Правильный ответ</p>
            <WrongDiffHighlight input={input} correct={card.word} />
            <p className="mt-1.5 text-sm text-emerald-700">= {card.translation}</p>
            {card.transcription && (
              <p className="mt-0.5 font-mono text-xs text-emerald-500">[{card.transcription}]</p>
            )}
          </div>

          <button ref={continueRef} type="button" onClick={handleContinue} onKeyDown={handleContinueKey}
            className="w-full rounded-2xl border-2 border-gray-200 bg-white py-4 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400">
            Понятно, продолжить →
          </button>
        </div>
      )}

      {/* ── Точный ответ ─────────────────────────────────────────────────── */}
      {phase === "correct-exact" && (
        <div className="space-y-3">
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-500">Верно! 🎉</p>
            <p className="text-xl font-bold text-emerald-800">{card.word}</p>
            <p className="mt-1 text-sm text-emerald-700">= {card.translation}</p>
            {card.transcription && (
              <p className="mt-0.5 font-mono text-xs text-emerald-500">[{card.transcription}]</p>
            )}
          </div>

          <button ref={continueRef} type="button" onClick={handleContinue} onKeyDown={handleContinueKey}
            className="w-full rounded-2xl bg-emerald-500 py-4 text-sm font-semibold text-white transition hover:bg-emerald-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            Продолжить →
          </button>
        </div>
      )}

      {/* ── Верно с опечаткой ────────────────────────────────────────────── */}
      {phase === "correct-typo" && (
        <div className="space-y-3">

          {/* Что ввёл — с выделением его ошибочной буквы жёлтым */}
          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50 px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-amber-500">
              Почти верно — небольшая опечатка
            </p>
            <InputHighlight input={input} correct={card.word} />
            <p className="mt-2 text-xs text-amber-600">
              <span className="inline-block rounded bg-amber-200 px-1 text-amber-800">жёлтым</span>
              {" "}— буква которую ты ввёл неправильно
            </p>
          </div>

          {/* Правильное написание — с выделением правильной буквы зелёным */}
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50 px-5 py-4">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-emerald-500">
              Правильно пишется
            </p>
            <CorrectHighlight input={input} correct={card.word} />
            <p className="mt-2 text-xs text-emerald-600">
              <span className="inline-block rounded bg-emerald-300 px-1 text-emerald-900">зелёным</span>
              {" "}— буква которая должна быть
            </p>
            <p className="mt-1.5 text-sm text-emerald-700">= {card.translation}</p>
            {card.transcription && (
              <p className="mt-0.5 font-mono text-xs text-emerald-500">[{card.transcription}]</p>
            )}
          </div>

          <button ref={continueRef} type="button" onClick={handleContinue} onKeyDown={handleContinueKey}
            className="w-full rounded-2xl bg-emerald-500 py-4 text-sm font-semibold text-white transition hover:bg-emerald-600 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400">
            Продолжить →
          </button>
        </div>
      )}

    </div>
  );
}