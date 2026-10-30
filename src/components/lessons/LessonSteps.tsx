"use client";

import { useEffect, useRef } from "react";
import { ArrowRight, BookmarkPlus } from "lucide-react";
import type {
  DialogueStep,
  IntroStep,
  LakLine,
  LessonWord,
  RuleStep,
  SoundStep,
  TextStep,
  WordsStep
} from "@/lib/lessons/types";
import { CLASS_LABEL } from "@/lib/lessons/types";
import { RichText } from "./RichText";

// ─── Общие элементы ──────────────────────────────────────────────────────────

export function StepTitle({ kicker, title }: { kicker: string; title?: string }) {
  return (
    <header className="mb-5">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lk-gold">{kicker}</p>
      {title ? <h2 className="mt-1 font-serif text-2xl font-bold leading-tight text-lk-text">{title}</h2> : null}
    </header>
  );
}

function Lak({ children, className = "" }: { children: string; className?: string }) {
  return (
    <span lang="lbe" className={`font-serif ${className}`}>
      {children}
    </span>
  );
}

function LineView({ line, showRu }: { line: LakLine; showRu: boolean }) {
  return (
    <>
      <Lak className="block text-lg font-semibold leading-snug text-lk-text">{line.lak}</Lak>
      {line.tr ? <span className="mt-0.5 block font-mono text-xs text-lk-muted">[{line.tr}]</span> : null}
      {showRu && line.ru ? <span className="mt-1 block text-sm leading-snug text-lk-muted">{line.ru}</span> : null}
    </>
  );
}

// ─── Введение ────────────────────────────────────────────────────────────────

export function IntroView({ step, title, titleLak, number }: { step: IntroStep; title: string; titleLak: string; number: number }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lk-gold">Урок {number}</p>
      <h1 className="mt-1 font-serif text-3xl font-bold leading-tight text-lk-text">{title}</h1>
      <Lak className="mt-1 block text-base text-lk-muted">{titleLak}</Lak>
      <RichText text={step.text} className="mt-6" />
      <div className="mt-6 rounded-2xl border border-lk-line bg-lk-card p-4">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-lk-muted">В этом уроке</p>
        <ul className="space-y-2">
          {step.points.map((p) => (
            <li key={p} className="flex gap-2.5 text-[15px] text-lk-text">
              <span className="mt-[9px] h-1.5 w-1.5 shrink-0 rounded-full bg-lk-gold" aria-hidden />
              {p}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

// ─── Звук ────────────────────────────────────────────────────────────────────

export function SoundView({ step }: { step: SoundStep }) {
  return (
    <div>
      <StepTitle kicker="Звук" />
      <div className="mb-5 flex items-center justify-center rounded-3xl border border-lk-gold-border bg-lk-gold-dim py-8">
        <Lak className="text-6xl font-bold text-lk-gold">{step.sound}</Lak>
      </div>
      <RichText text={step.text} />
      {step.pairs?.length ? (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-lk-muted">Сравните</p>
          <div className="space-y-2">
            {step.pairs.map(([a, b]) => (
              <div key={`${a}-${b}`} className="flex items-center gap-3 rounded-2xl border border-lk-line bg-lk-card px-4 py-3">
                <Lak className="flex-1 text-right text-xl text-lk-muted">{a}</Lak>
                <ArrowRight size={16} className="shrink-0 text-lk-faint" aria-hidden />
                <Lak className="flex-1 text-xl font-semibold text-lk-text">{b}</Lak>
              </div>
            ))}
          </div>
        </div>
      ) : null}
      {step.words?.length ? (
        <div className="mt-5">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-lk-muted">Произнесите вслух</p>
          <div className="flex flex-wrap gap-2">
            {step.words.map((w) => (
              <Lak key={w} className="rounded-xl border border-lk-line bg-lk-card2 px-3.5 py-2 text-lg text-lk-text">
                {w}
              </Lak>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ─── Диалог ──────────────────────────────────────────────────────────────────

export function DialogueView({ step, revealed, showRu }: { step: DialogueStep; revealed: number; showRu: boolean }) {
  const endRef = useRef<HTMLDivElement>(null);
  const speakers = [...new Set(step.lines.map((l) => l.who))];

  useEffect(() => {
    if (revealed > 1) endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [revealed]);

  return (
    <div>
      <StepTitle kicker="Диалог" title={step.title} />
      {step.text ? <RichText text={step.text} className="mb-4 text-lk-muted" /> : null}
      <ol className="space-y-3" aria-live="polite">
        {step.lines.slice(0, revealed).map((line, i) => {
          const right = speakers.indexOf(line.who) % 2 === 1;
          return (
            <li key={i} className={`flex ${right ? "justify-end" : "justify-start"}`}>
              <div
                className={[
                  "max-w-[88%] rounded-2xl border px-4 py-3 animate-[lkFadeIn_.25s_ease-out]",
                  right ? "rounded-br-md border-lk-gold-border bg-lk-gold-dim" : "rounded-bl-md border-lk-line bg-lk-card"
                ].join(" ")}
              >
                <span className="mb-1 block text-[11px] font-semibold text-lk-muted">{line.who}</span>
                <LineView line={line} showRu={showRu} />
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={endRef} />
    </div>
  );
}

// ─── Текст ───────────────────────────────────────────────────────────────────

export function TextView({ step, showRu }: { step: TextStep; showRu: boolean }) {
  return (
    <div>
      <StepTitle kicker="Читаем" title={step.title} />
      {step.text ? <RichText text={step.text} className="mb-4 text-lk-muted" /> : null}
      <ol className="divide-y divide-lk-line overflow-hidden rounded-2xl border border-lk-line bg-lk-card">
        {step.sentences.map((s, i) => (
          <li key={i} className="px-4 py-3">
            <LineView line={s} showRu={showRu} />
          </li>
        ))}
      </ol>
    </div>
  );
}

// ─── Правило ─────────────────────────────────────────────────────────────────

export function RuleView({ step }: { step: RuleStep }) {
  return (
    <div>
      <StepTitle kicker="Запомни" title={step.title} />
      <RichText text={step.text} />
      {step.examples?.length ? (
        <ul className="mt-5 space-y-2">
          {step.examples.map((ex, i) => (
            <li key={i} className="rounded-2xl border-l-4 border-lk-gold bg-lk-card px-4 py-3">
              <LineView line={ex} showRu />
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

// ─── Слова ───────────────────────────────────────────────────────────────────

export function WordsView({ step, words }: { step: WordsStep; words: Map<string, LessonWord> }) {
  return (
    <div>
      <StepTitle kicker="Слова урока" title={step.title ?? "Новые слова"} />
      <p className="mb-4 flex items-start gap-2 text-sm text-lk-muted">
        <BookmarkPlus size={16} className="mt-0.5 shrink-0 text-lk-gold" aria-hidden />
        После урока эти слова появятся в повторении.
      </p>
      <ul className="divide-y divide-lk-line overflow-hidden rounded-2xl border border-lk-line bg-lk-card">
        {step.words.map((key) => {
          const w = words.get(key);
          if (!w) return null;
          return (
            <li key={key} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <Lak className="text-lg font-semibold text-lk-text">{w.lak}</Lak>
                {w.cls ? (
                  <span className="shrink-0 rounded-full bg-lk-gold-dim px-2 py-0.5 text-[10px] font-semibold text-lk-gold">
                    {CLASS_LABEL[w.cls]}
                  </span>
                ) : null}
              </div>
              {w.tr ? <span className="block font-mono text-xs text-lk-muted">[{w.tr}]</span> : null}
              <span className="mt-0.5 block text-sm text-lk-muted">{w.ru}</span>
              {w.note ? <span className="mt-1 block text-xs text-lk-muted">{w.note}</span> : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
