import Link from "next/link";
import type { SRSQueueSummary } from "@/types/dashboard";

interface SRSQueueWidgetProps {
  summary: SRSQueueSummary;
}

export function SRSQueueWidget({ summary }: SRSQueueWidgetProps) {
  const hasQueue = summary.overdue + summary.dueSoon > 0;

  if (!hasQueue) {
    return (
      <section className="h-[160px] rounded-2xl border border-gray-200 bg-gray-100 p-6">
        <h2 className="text-lg font-semibold">Слова на повторение</h2>
        <p className="mt-3 text-sm text-gray-600">Нет слов для повторения</p>
        <Link
          href="/dashboard"
          className="mt-4 inline-flex min-h-11 items-center rounded-xl bg-gray-900 px-4 text-sm font-medium text-white transition hover:bg-gray-700"
        >
          Начать новый урок
        </Link>
      </section>
    );
  }

  return (
    <section className="h-[160px] rounded-2xl border border-gray-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
      <h2 className="text-lg font-semibold">Слова на повторение</h2>
      <div className="mt-3 space-y-1 text-sm">
        <p>🔴 {summary.overdue} слов просрочено</p>
        <p>🟡 {summary.dueSoon} скоро к повторению</p>
      </div>
      <Link
        href="/review"
        className="mt-3 inline-flex min-h-11 items-center rounded-xl bg-blue-600 px-4 text-sm font-medium text-white transition hover:bg-blue-700 active:scale-[0.98]"
      >
        Начать повторение
      </Link>
    </section>
  );
}

