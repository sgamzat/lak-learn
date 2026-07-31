"use client";

import Link from "next/link";
import { ArrowRight, BookOpen, Check, HelpCircle, Star, Trophy, X } from "lucide-react";
import type { FlashcardData, SRSResult } from "@/types/srs";

interface SRSSummaryScreenProps {
  total: number;
  results: SRSResult[];
  sessionXP: number;
  sessionCards: FlashcardData[];
  remaining: number;
  onRestart: () => void;
  onContinueLesson: () => void;
  continueLoading?: boolean;
  backHref: string;
  backLabel: string;
}

function pluralRemaining(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return `${n} карточка`;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return `${n} карточки`;
  return `${n} карточек`;
}

export function SRSSummaryScreen({
  total,
  results,
  sessionXP,
  sessionCards,
  remaining,
  onRestart,
  onContinueLesson,
  continueLoading = false,
  backHref,
  backLabel,
}: SRSSummaryScreenProps) {
  const knowCount = results.filter((r) => r.rating === "know").length;
  const unsureCount = results.filter((r) => r.rating === "unsure").length;
  const forgotCount = results.filter((r) => r.rating === "forgot").length;
  const accuracy = total > 0 ? Math.round((knowCount / total) * 100) : 0;

  const forgotCards = sessionCards.filter((c) =>
    results.some((r) => r.cardId === c.id && r.rating === "forgot")
  );

  if (total === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-lk-gold-dim">
          <Check className="h-8 w-8 text-lk-gold" strokeWidth={2} />
        </div>
        <div>
          <h2 className="font-serif text-2xl font-bold text-lk-text">Всё повторено</h2>
          <p className="mx-auto mt-2 max-w-xs text-sm text-lk-muted">
            На сегодня карточек нет. Возвращайтесь позже или добавьте новые слова.
          </p>
        </div>
        <div className="flex w-full max-w-xs flex-col gap-2 sm:flex-row">
          <Link
            href="/dictionary"
            className="inline-flex flex-1 items-center justify-center gap-2 rounded-2xl bg-lk-gold px-6 py-3.5 text-sm font-semibold text-lk-bg transition hover:opacity-90"
          >
            <BookOpen className="h-4 w-4" />
            Добавить слова
          </Link>
          <Link
            href={backHref}
            className="inline-flex flex-1 items-center justify-center rounded-2xl border border-lk-line bg-lk-card px-6 py-3.5 text-sm font-semibold text-lk-text transition hover:bg-lk-card2"
          >
            {backLabel}
          </Link>
        </div>
      </div>
    );
  }

  const Icon = accuracy >= 80 ? Trophy : accuracy >= 50 ? Check : BookOpen;

  const message =
    accuracy >= 80
      ? "Отличный результат"
      : accuracy >= 50
        ? "Хороший прогресс"
        : "Продолжайте практиковаться";

  const accuracyColor =
    accuracy >= 80
      ? "text-lk-green"
      : accuracy >= 50
        ? "text-lk-gold"
        : "text-lk-red";

  const barColor =
    accuracy >= 80
      ? "bg-lk-green"
      : accuracy >= 50
        ? "bg-lk-gold"
        : "bg-lk-red";

  const hasMoreLessons = remaining > 0;

  return (
    <div className="flex flex-1 items-center justify-center overflow-y-auto p-4">
      <div className="w-full max-w-sm space-y-5 py-2">
        <div className="text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-lk-gold-dim">
            <Icon className="h-7 w-7 text-lk-gold" strokeWidth={2} />
          </div>
          <h2 className="mt-3 font-serif text-2xl font-bold text-lk-text">Урок завершён</h2>
          <p className="mt-1 text-sm text-lk-muted">{message}</p>
          {hasMoreLessons && (
            <p className="mt-2 text-sm text-lk-gold">
              Ещё {pluralRemaining(remaining)} ждут следующего урока
            </p>
          )}
        </div>

        <div className="rounded-3xl border border-lk-line bg-lk-card p-6 text-center shadow-lk">
          <p className="text-sm font-medium text-lk-muted">Точность</p>
          <p className={`mt-1 text-6xl font-black leading-none ${accuracyColor}`}>
            {accuracy}%
          </p>
          <p className="mt-2 text-sm text-lk-faint">
            {knowCount} из {total} слов
          </p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-lk-card2">
            <div
              className={`h-full rounded-full transition-all duration-700 ${barColor}`}
              style={{ width: `${accuracy}%` }}
            />
          </div>
        </div>

        <div
          className={`grid gap-3 ${unsureCount > 0 ? "grid-cols-3" : "grid-cols-2"}`}
        >
          <div className="rounded-2xl border border-lk-green/30 bg-lk-green-dim p-4 text-center">
            <p className="text-2xl font-bold text-lk-green">{knowCount}</p>
            <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-lk-green">
              <Check className="h-3 w-3" /> Знаю
            </p>
          </div>
          {unsureCount > 0 && (
            <div className="rounded-2xl border border-lk-gold-border bg-lk-gold-dim p-4 text-center">
              <p className="text-2xl font-bold text-lk-gold">{unsureCount}</p>
              <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-lk-gold">
                <HelpCircle className="h-3 w-3" /> Не уверен
              </p>
            </div>
          )}
          <div className="rounded-2xl border border-lk-red/30 bg-lk-red-dim p-4 text-center">
            <p className="text-2xl font-bold text-lk-red">{forgotCount}</p>
            <p className="mt-0.5 flex items-center justify-center gap-1 text-xs text-lk-red">
              <X className="h-3 w-3" /> Не знал
            </p>
          </div>
        </div>

        {forgotCards.length > 0 && (
          <div className="rounded-2xl border border-lk-line bg-lk-card p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-lk-muted">
              Забытые слова
            </p>
            <ul className="max-h-40 space-y-2 overflow-y-auto">
              {forgotCards.map((c) => (
                <li
                  key={c.id}
                  className="flex items-baseline justify-between gap-3 border-b border-lk-line/60 pb-2 last:border-0 last:pb-0"
                >
                  <span className="font-medium text-lk-text">{c.word}</span>
                  <span className="truncate text-sm text-lk-muted">{c.translation}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {sessionXP > 0 && (
          <div className="flex items-center justify-center gap-2 rounded-2xl border border-lk-gold-border bg-lk-gold-dim px-4 py-3">
            <Star className="h-4 w-4 text-lk-gold" fill="currentColor" />
            <p className="text-sm font-semibold text-lk-gold">+{sessionXP} XP</p>
          </div>
        )}

        <div className="flex flex-col gap-2 pb-[env(safe-area-inset-bottom)]">
          {hasMoreLessons && (
            <button
              type="button"
              onClick={onContinueLesson}
              disabled={continueLoading}
              className="flex items-center justify-center gap-2 rounded-2xl bg-lk-gold py-3.5 text-sm font-semibold text-lk-bg transition hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
            >
              {continueLoading ? "Загрузка…" : `Ещё урок (${remaining})`}
              {!continueLoading && <ArrowRight className="h-4 w-4" />}
            </button>
          )}

          {forgotCount > 0 && (
            <button
              type="button"
              onClick={onRestart}
              className={[
                "flex items-center justify-center rounded-2xl py-3.5 text-sm font-semibold transition active:scale-[0.98]",
                hasMoreLessons
                  ? "border border-lk-line bg-lk-card text-lk-text hover:bg-lk-card2"
                  : "bg-lk-gold text-lk-bg hover:opacity-90",
              ].join(" ")}
            >
              Повторить забытые ({forgotCount})
            </button>
          )}

          <Link
            href={backHref}
            className={[
              "flex items-center justify-center rounded-2xl py-3.5 text-sm font-semibold transition",
              !hasMoreLessons && forgotCount === 0
                ? "bg-lk-gold text-lk-bg hover:opacity-90"
                : "border border-lk-line bg-lk-card text-lk-text hover:bg-lk-card2",
            ].join(" ")}
          >
            {backLabel}
          </Link>
        </div>
      </div>
    </div>
  );
}
