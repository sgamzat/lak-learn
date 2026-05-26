"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChartNoAxesCombined, ChevronDown, Flame, LogOut, Settings, Star, Trophy } from "lucide-react";
import { getDashboardData, logout } from "@/lib/api/client";
import { SRSQueueWidget } from "@/components/dashboard/SRSQueueWidget";
import type { DashboardData } from "@/types/dashboard";

const baseQuickLinks = [
  { href: "/dictionary", label: "Словарь" },
  { href: "/letters", label: "БУКВЫ" },
  { href: "/dashboard", label: "Грамматика" },
  { href: "/review", label: "Повторение" },
  { href: "/dashboard", label: "Статистика" }
];

export function DashboardShell() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadDashboard = async () => {
      try {
        const response = await getDashboardData();
        if (mounted) {
          setData(response);
          setIsLoading(false);
        }
      } catch {
        if (mounted) {
          setData(null);
          setIsLoading(false);
        }
      }
    };

    void loadDashboard();

    const intervalId = window.setInterval(() => {
      void loadDashboard();
    }, 60_000);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void loadDashboard();
      }
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  const progressWidth = useMemo(() => `${data?.progress.accuracy ?? 0}%`, [data?.progress.accuracy]);

  async function handleLogout() {
    if (isLoggingOut) {
      return;
    }

    setIsLoggingOut(true);
    const ok = await logout();
    setIsLoggingOut(false);
    setIsProfileMenuOpen(false);

    if (ok) {
      router.push("/login");
      router.refresh();
    }
  }

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
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <h1 className="text-2xl font-black tracking-tight sm:text-3xl">
              <span className="inline-block font-serif leading-none text-black">Laklearn</span>
            </h1>

            <nav className="flex flex-wrap items-center gap-2" aria-label="Быстрые ссылки">
              {baseQuickLinks.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-full border border-gray-200 px-3 text-sm transition hover:bg-gray-50"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>

        </div>

        <div className="relative flex items-center gap-3 text-sm">
          <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-orange-100 px-3 font-medium text-orange-700">
            <Flame className="h-4 w-4" /> {data.profile.streak} дней
          </span>
          <span className="inline-flex min-h-11 items-center gap-1 rounded-full bg-yellow-100 px-3 font-medium text-yellow-700">
            <Star className="h-4 w-4" /> {data.profile.xp} XP
          </span>

          <button
            type="button"
            onClick={() => setIsProfileMenuOpen((prev) => !prev)}
            className="inline-flex min-h-11 items-center gap-1 rounded-full border border-gray-200 bg-white px-3 font-medium text-gray-700 transition hover:bg-gray-50"
            aria-haspopup="menu"
            aria-expanded={isProfileMenuOpen}
          >
            Профиль <ChevronDown className="h-4 w-4" />
          </button>

          {isProfileMenuOpen ? (
            <div
              className="absolute right-0 top-14 z-10 w-64 rounded-xl border border-gray-200 bg-white p-2 shadow-lg"
              role="menu"
              aria-label="Настройки профиля"
            >
              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                role="menuitem"
              >
                <Settings className="h-4 w-4" />
                Сменить пароль (скоро)
              </button>

              {data.profile.role === "admin" ? (
                <Link
                  href="/admin"
                  className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50"
                  role="menuitem"
                  onClick={() => setIsProfileMenuOpen(false)}
                >
                  <Settings className="h-4 w-4" />
                  База знаний (админ)
                </Link>
              ) : null}

              <button
                type="button"
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                role="menuitem"
                onClick={handleLogout}
                disabled={isLoggingOut}
              >
                <LogOut className="h-4 w-4" />
                {isLoggingOut ? "Выход..." : "Выйти"}
              </button>
            </div>
          ) : null}
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
          <div className="mt-4 h-3 overflow-hidden rounded-full bg-gray-200" aria-label="Прогресс точности">
            <div
              className="h-full bg-green-500 transition-all duration-1000 ease-out"
              style={{ width: progressWidth }}
            />
          </div>
          <p className="mt-2 text-sm text-gray-700">Точность: {data.progress.accuracy}%</p>
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
                {data.leaderboardTop.map((user) => {
                  const isCurrentUser = user.name === data.profile.name;

                  return (
                    <tr
                      key={user.id}
                      className={isCurrentUser ? "rounded-xl bg-blue-50 text-blue-900" : "text-gray-700"}
                    >
                      <td className="py-2 pr-2 font-semibold">{user.rank}</td>
                      <td className="py-2 pr-2">{user.name}</td>
                      <td className="py-2 pr-2 font-medium">{user.xp}</td>
                      <td className="py-2">🔥 {user.streak}</td>
                    </tr>
                  );
                })}

                {data.myLeaderboardRow && data.myLeaderboardRow.rank > 10 ? (
                  <>
                    <tr>
                      <td colSpan={4} className="py-2">
                        <div className="h-px w-full bg-gray-200" />
                      </td>
                    </tr>
                    <tr className="rounded-xl bg-blue-50 text-blue-900">
                      <td className="py-2 pr-2 font-semibold">{data.myLeaderboardRow.rank}</td>
                      <td className="py-2 pr-2 font-semibold">Вы ({data.myLeaderboardRow.name})</td>
                      <td className="py-2 pr-2 font-medium">{data.myLeaderboardRow.xp}</td>
                      <td className="py-2">🔥 {data.myLeaderboardRow.streak}</td>
                    </tr>
                  </>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </div>
  );
}
