"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { BookOpen, ChartNoAxesCombined, Flame, Star, Trophy } from "lucide-react";
import { getDashboardData } from "@/lib/api/client";
import { SRSQueueWidget } from "@/components/dashboard/SRSQueueWidget";
import type { DashboardData } from "@/types/dashboard";

const quickLinks = [
  { href: "/dashboard", label: "Словарь" },
  { href: "/dashboard", label: "Грамматика" },
  { href: "/review", label: "Повторение" },
  { href: "/dashboard", label: "Статистика" }
];

export function DashboardShell() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    getDashboardData()
      .then((response) => {
        if (mounted) {
          setData(response);
          setIsLoading(false);
        }
      })
      .catch(() => {
        if (mounted) {
          setData(null);
          setIsLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  const progressWidth = useMemo(() => `${data?.progress.accuracy ?? 0}%`, [data?.progress.accuracy]);

  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, idx) => (
            <div
              key={idx}
              className="h-16 animate-pulse rounded-xl bg-gray-200 first:col-span-1 first:h-40 lg:first:col-span-2"
            />
          ))}
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить dashboard данные.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="flex h-16 items-center justify-between gap-3">
        <h1 className="text-2xl font-bold">Салам, {data.profile.name}</h1>
        <div className="flex items-center gap-3 text-sm">
          <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-orange-100 px-3 font-medium text-orange-700">
            <Flame className="h-4 w-4" /> {data.profile.streak} дней
          </span>
          <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-yellow-100 px-3 font-medium text-yellow-700">
            <Star className="h-4 w-4" /> {data.profile.xp} XP
          </span>
        </div>
      </header>

      <section className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Link
          href="/review"
          className="col-span-1 min-h-[160px] rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 p-6 text-white transition hover:scale-[1.02] hover:shadow-lg active:scale-[0.98] lg:col-span-2"
        >
          <p className="text-sm/6 opacity-90">Продолжить урок</p>
          <h2 className="mt-2 text-2xl font-bold">Интервальное повторение</h2>
          <p className="mt-2 text-sm opacity-90">Откройте очередь карточек и обновите память по словам.</p>
        </Link>

        <SRSQueueWidget summary={data.srsSummary} />

        <section className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-center gap-2">
            <ChartNoAxesCombined className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Прогресс</h2>
          </div>
          <p className="mt-4 text-sm text-gray-600">
            Уроков завершено: <span className="font-semibold text-gray-900">{data.progress.lessonsCompleted}</span>
          </p>
          <p className="mt-1 text-sm text-gray-600">
            Текущий уровень: <span className="font-semibold text-gray-900">{data.progress.currentLevel}</span>
          </p>
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-200" aria-label="Прогресс точности">
            <div
              className="h-full bg-green-500 transition-all duration-1000 ease-out"
              style={{ width: progressWidth }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-700">Точность: {data.progress.accuracy}%</p>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg">
          <div className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            <h2 className="text-lg font-semibold">Быстрые ссылки</h2>
          </div>
          <div className="mt-4 grid grid-flow-col gap-2 overflow-x-auto pb-1 md:grid-flow-row md:grid-cols-2 md:overflow-visible">
            {quickLinks.map((link) => (
              <Link
                key={link.label}
                href={link.href}
                className="inline-flex min-h-11 items-center justify-center whitespace-nowrap rounded-xl border border-gray-200 px-3 text-sm transition hover:bg-gray-50"
              >
                {link.label}
              </Link>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 transition hover:-translate-y-0.5 hover:shadow-lg md:col-span-2 lg:col-span-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-amber-500" />
            <h2 className="text-lg font-semibold">Рейтинг пользователей</h2>
          </div>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead>
                <tr className="text-gray-500">
                  <th className="pb-2 font-medium">#</th>
                  <th className="pb-2 font-medium">Пользователь</th>
                  <th className="pb-2 font-medium">XP</th>
                  <th className="pb-2 font-medium">Серия</th>
                </tr>
              </thead>
              <tbody>
                {data.leaderboard.map((user, index) => {
                  const isCurrentUser = user.name === data.profile.name;

                  return (
                    <tr
                      key={user.id}
                      className={isCurrentUser ? "rounded-xl bg-blue-50 text-blue-900" : "text-gray-700"}
                    >
                      <td className="py-2 pr-2 font-semibold">{index + 1}</td>
                      <td className="py-2 pr-2">{user.name}</td>
                      <td className="py-2 pr-2 font-medium">{user.xp}</td>
                      <td className="py-2">🔥 {user.streak}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}
