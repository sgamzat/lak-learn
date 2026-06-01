"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { SRSResult } from "@/types/srs";

interface SRSSummaryScreenProps {
  total: number;
  results: SRSResult[];
  sessionXP: number;
  onRestart: () => void; // новый пропс — сброс состояния родителя
}

export function SRSSummaryScreen({
  total,
  results,
  sessionXP,
  onRestart,
}: SRSSummaryScreenProps) {
  const router = useRouter();

  const knowCount   = results.filter((r) => r.rating === "know").length;
  const unsureCount = results.filter((r) => r.rating === "unsure").length;
  const forgotCount = results.filter((r) => r.rating === "forgot").length;
  const accuracy    = total > 0 ? Math.round((knowCount / total) * 100) : 0;

  // Пустая сессия — нечего повторять
  if (total === 0) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6 text-center">
        <span className="text-5xl">🎉</span>
        <h2 className="text-2xl font-bold text-gray-900">Всё повторено!</h2>
        <p className="max-w-xs text-sm text-gray-500">
          На сегодня карточек нет. Возвращайтесь завтра или добавьте новые слова.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link
            href="/dashboard"
            className="inline-flex items-center justify-center rounded-2xl bg-gray-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-gray-700"
          >
            На главную
          </Link>
          <Link
            href="/dictionary"
            className="inline-flex items-center justify-center rounded-2xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 transition hover:bg-gray-50"
          >
            Добавить слова
          </Link>
        </div>
      </div>
    );
  }

  const emoji =
    accuracy >= 80 ? "🏆" :
    accuracy >= 50 ? "💪" : "📚";

  const message =
    accuracy >= 80 ? "Отличный результат!" :
    accuracy >= 50 ? "Хороший прогресс!" :
    "Продолжайте практиковаться!";

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-sm space-y-5">

        {/* Заголовок */}
        <div className="text-center">
          <span className="text-5xl">{emoji}</span>
          <h2 className="mt-3 text-2xl font-bold text-gray-900">Сессия завершена</h2>
          <p className="mt-1 text-sm text-gray-500">{message}</p>
        </div>

        {/* Точность */}
        <div className="rounded-3xl bg-white p-6 text-center shadow-lg">
          <p className="text-sm font-medium text-gray-400">Точность</p>
          <p className={[
            "mt-1 text-6xl font-black leading-none",
            accuracy >= 80 ? "text-emerald-600" :
            accuracy >= 50 ? "text-amber-500" : "text-red-500",
          ].join(" ")}>
            {accuracy}%
          </p>
          <p className="mt-2 text-sm text-gray-400">{knowCount} из {total} слов</p>
          <div className="mt-4 h-2 overflow-hidden rounded-full bg-gray-100">
            <div
              className={[
                "h-full rounded-full transition-all duration-700",
                accuracy >= 80 ? "bg-emerald-500" :
                accuracy >= 50 ? "bg-amber-400" : "bg-red-400",
              ].join(" ")}
              style={{ width: `${accuracy}%` }}
            />
          </div>
        </div>

        {/* Разбивка */}
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-center">
            <p className="text-2xl font-bold text-emerald-700">{knowCount}</p>
            <p className="mt-0.5 text-xs text-emerald-600">Знаю</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50 p-4 text-center">
            <p className="text-2xl font-bold text-amber-700">{unsureCount}</p>
            <p className="mt-0.5 text-xs text-amber-600">Не уверен</p>
          </div>
          <div className="rounded-2xl border border-red-100 bg-red-50 p-4 text-center">
            <p className="text-2xl font-bold text-red-700">{forgotCount}</p>
            <p className="mt-0.5 text-xs text-red-600">Не знал</p>
          </div>
        </div>

        {/* XP */}
        {sessionXP > 0 && (
          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-center">
            <p className="text-sm font-semibold text-yellow-800">
              +{sessionXP} XP заработано ⭐
            </p>
          </div>
        )}

        {/* Кнопки */}
        <div className="flex flex-col gap-2">
          <Link
            href="/dashboard"
            className="flex items-center justify-center rounded-2xl bg-gray-900 py-3.5 text-sm font-semibold text-white transition hover:bg-gray-700"
          >
            На главную
          </Link>

          {/* Повторить забытые — сбрасывает состояние без перехода по URL */}
          {forgotCount > 0 && (
            <button
              type="button"
              onClick={onRestart}
              className="flex items-center justify-center rounded-2xl border border-gray-200 bg-white py-3.5 text-sm font-semibold text-gray-700 transition hover:bg-gray-50 active:scale-[0.98]"
            >
              Повторить забытые ({forgotCount}) →
            </button>
          )}
        </div>

      </div>
    </div>
  );
}