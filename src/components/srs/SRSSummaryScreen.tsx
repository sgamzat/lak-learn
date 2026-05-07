import Link from "next/link";
import type { SRSResult } from "@/types/srs";

interface SRSSummaryScreenProps {
  total: number;
  results: SRSResult[];
  sessionXP: number;
}

export function SRSSummaryScreen({ total, results, sessionXP }: SRSSummaryScreenProps) {
  const knowCount = results.filter((item) => item.rating === "know").length;
  const accuracy = total > 0 ? Math.round((knowCount / total) * 100) : 0;

  return (
    <div className="flex flex-1 items-center justify-center p-4">
      <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-xl">
        <h2 className="text-2xl font-bold">Повторение завершено</h2>
        <p className="mt-4 text-gray-700">Вы повторили {total} слов.</p>
        <p className="mt-2 text-lg font-semibold text-gray-900">Точность: {accuracy}%</p>
        <p className="mt-1 text-sm font-medium text-blue-700">Заработано XP: +{sessionXP}</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-5 py-3 font-medium text-white transition hover:bg-blue-700"
        >
          Вернуться на главную
        </Link>
      </div>
    </div>
  );
}
