"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, BookOpen, Flame, Star, Trophy, ChevronDown } from "lucide-react";
import { getDashboardData, logout } from "@/lib/api/client";
import type { DashboardData } from "@/types/dashboard";

// Слово дня — статичный список, можно вынести в API позже
const WORD_OF_DAY = { lak: "Барчаллагь", ru: "Спасибо", transcription: "bar-cha-llagh" };

// Навигационные ссылки
const NAV_LINKS = [
  { href: "/dictionary", label: "Словарь", ready: true },
  { href: "/letters",    label: "Буквы",   ready: true },
  { href: "/review",     label: "Повторение", ready: true },
  { href: "/dashboard",  label: "Грамматика", ready: false },
  { href: "/dashboard",  label: "Статистика", ready: false },
];

// Получаем инициалы из имени для аватара
function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

// Метка рейтингового места
function RankMedal({ rank }: { rank: number }) {
  if (rank === 1) return <span>🥇</span>;
  if (rank === 2) return <span>🥈</span>;
  if (rank === 3) return <span>🥉</span>;
  return <span className="text-xs text-gray-500">{rank}</span>;
}

export function DashboardShell() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Загрузка данных
  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const response = await getDashboardData();
        if (mounted) { setData(response); setIsLoading(false); }
      } catch {
        if (mounted) { setData(null); setIsLoading(false); }
      }
    };

    void load();

    const intervalId = window.setInterval(() => void load(), 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  // Закрытие меню при клике вне
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const progressWidth = useMemo(() => `${data?.progress.accuracy ?? 0}%`, [data?.progress.accuracy]);

  // Цель на день: сколько слов повторено сегодня (из lessonsCompleted как прокси)
  const dailyGoal = 10;
  const dailyDone = Math.min(data?.progress.lessonsCompleted ?? 0, dailyGoal);
  const dailyPercent = Math.round((dailyDone / dailyGoal) * 100);

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    const ok = await logout();
    setIsLoggingOut(false);
    setIsProfileMenuOpen(false);
    if (ok) { router.push("/login"); router.refresh(); }
  }

  // ── Skeleton загрузки ─────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-4 space-y-4">
        <div className="h-14 animate-pulse rounded-2xl bg-gray-200" />
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          <div className="col-span-1 h-44 animate-pulse rounded-2xl bg-gray-200 lg:col-span-2" />
          <div className="h-44 animate-pulse rounded-2xl bg-gray-200" />
          <div className="h-36 animate-pulse rounded-2xl bg-gray-200" />
          <div className="h-36 animate-pulse rounded-2xl bg-gray-200" />
          <div className="h-36 animate-pulse rounded-2xl bg-gray-200 lg:col-span-1" />
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-7xl px-4 py-6">
        <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          Не удалось загрузить данные. Обновите страницу.
        </p>
      </div>
    );
  }

  const totalSRS = data.srsSummary.overdue + data.srsSummary.dueSoon;

  return (
    <div className="mx-auto max-w-7xl px-4 py-4 space-y-4">

      {/* ── ТОПБАР ─────────────────────────────────────────────────── */}
      <header className="flex items-center justify-between gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-2.5">

        {/* Логотип */}
        <span className="text-xl font-black tracking-tight font-serif shrink-0">Laklearn</span>

        {/* Навигация */}
        <nav className="hidden items-center gap-1 sm:flex" aria-label="Основная навигация">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className={[
                "relative inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm transition",
                link.ready
                  ? "text-gray-700 hover:bg-gray-100"
                  : "cursor-default text-gray-400",
              ].join(" ")}
              onClick={!link.ready ? (e) => e.preventDefault() : undefined}
            >
              {link.label}
              {!link.ready && (
                <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-medium text-orange-600">
                  Скоро
                </span>
              )}
            </Link>
          ))}
        </nav>

        {/* Правая часть: streak, xp, профиль */}
        <div className="flex items-center gap-2 shrink-0">
          <span className="inline-flex items-center gap-1 rounded-full bg-orange-100 px-3 py-1.5 text-sm font-medium text-orange-700">
            <Flame className="h-3.5 w-3.5" />
            {data.profile.streak} дней
          </span>
          <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-3 py-1.5 text-sm font-medium text-yellow-700">
            <Star className="h-3.5 w-3.5" />
            {data.profile.xp} XP
          </span>

          {/* Профиль */}
          <div ref={menuRef} className="relative">
            <button
              type="button"
              onClick={() => setIsProfileMenuOpen((p) => !p)}
              className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-gray-50 pl-1 pr-2.5 py-1 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
              aria-haspopup="menu"
              aria-expanded={isProfileMenuOpen}
            >
              <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                {getInitials(data.profile.name)}
              </span>
              {data.profile.name}
              <ChevronDown className="h-3.5 w-3.5 text-gray-400" />
            </button>

            {isProfileMenuOpen && (
              <div
                className="absolute right-0 top-12 z-20 w-56 rounded-2xl border border-gray-200 bg-white p-2 shadow-xl"
                role="menu"
              >
                <div className="mb-1 px-3 py-2 text-xs text-gray-400">{data.profile.name}</div>

                <button
                  type="button"
                  disabled
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-400"
                  role="menuitem"
                >
                  <Settings className="h-4 w-4" />
                  Сменить пароль
                  <span className="ml-auto text-[10px] text-orange-500">скоро</span>
                </button>

                {data.profile.role === "admin" && (
                  <Link
                    href="/admin"
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-gray-700 transition hover:bg-gray-50"
                    role="menuitem"
                    onClick={() => setIsProfileMenuOpen(false)}
                  >
                    <BookOpen className="h-4 w-4" />
                    Админ-панель
                  </Link>
                )}

                <div className="my-1 h-px bg-gray-100" />

                <button
                  type="button"
                  onClick={() => void handleLogout()}
                  disabled={isLoggingOut}
                  className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm text-red-600 transition hover:bg-red-50 disabled:opacity-60"
                  role="menuitem"
                >
                  <LogOut className="h-4 w-4" />
                  {isLoggingOut ? "Выход..." : "Выйти"}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* ── ОСНОВНАЯ СЕТКА ─────────────────────────────────────────── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">

        {/* 1. Главный CTA — повторение */}
        <Link
          href="/review"
          className="group relative col-span-1 flex min-h-[168px] flex-col justify-between overflow-hidden rounded-2xl bg-[#0F3F8C] p-6 text-white transition hover:bg-[#0d3578] active:scale-[0.99] lg:col-span-2"
        >
          {/* Декоративный текст-фон */}
          <span
            aria-hidden
            className="pointer-events-none absolute right-4 bottom-2 text-[80px] font-black opacity-10 select-none leading-none"
          >
            лак
          </span>

          {totalSRS > 0 && (
            <span className="absolute right-4 top-4 rounded-full bg-white/20 px-2.5 py-1 text-xs font-medium backdrop-blur-sm">
              {totalSRS} карточек ждут
            </span>
          )}

          <div>
            <p className="text-sm opacity-75">Сегодняшняя сессия</p>
            <h2 className="mt-1 text-2xl font-bold">Продолжить повторение</h2>
            <p className="mt-1 text-sm opacity-70">Не дай словам забыться — 5 минут в день</p>
          </div>

          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-2 rounded-xl bg-white/20 px-4 py-2 text-sm font-medium backdrop-blur-sm transition group-hover:bg-white/30">
              ▶ Начать
              <span className="text-xs opacity-60">Space</span>
            </span>
            {data.srsSummary.overdue > 0 && (
              <span className="text-xs opacity-60">
                🔴 {data.srsSummary.overdue} просрочено
              </span>
            )}
          </div>
        </Link>

        {/* 2. Очередь SRS */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Очередь повторения</p>

          <div className="mt-3 flex gap-2">
            <div className="flex flex-1 flex-col items-center rounded-xl bg-red-50 py-3">
              <span className="text-xl font-bold text-red-700">{data.srsSummary.overdue}</span>
              <span className="mt-0.5 text-[11px] text-red-600">Просрочено</span>
            </div>
            <div className="flex flex-1 flex-col items-center rounded-xl bg-amber-50 py-3">
              <span className="text-xl font-bold text-amber-700">{data.srsSummary.dueSoon}</span>
              <span className="mt-0.5 text-[11px] text-amber-600">Скоро</span>
            </div>
          </div>

          {data.srsSummary.nextReviewTime ? (
            <p className="mt-3 text-xs text-gray-400">
              Следующее повторение:{" "}
              <span className="font-medium text-gray-600">
                {new Date(data.srsSummary.nextReviewTime).toLocaleTimeString("ru-RU", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </p>
          ) : (
            <p className="mt-3 text-xs text-gray-400">Нет запланированных повторений</p>
          )}
        </section>

        {/* 3. Прогресс */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Прогресс сегодня</p>

          {/* Цель дня */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Цель: слова</span>
              <span className="font-semibold text-gray-900">{dailyDone} / {dailyGoal}</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-700"
                style={{ width: `${dailyPercent}%` }}
              />
            </div>
          </div>

          {/* Точность */}
          <div className="mt-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Точность</span>
              <span className="font-semibold text-gray-900">{data.progress.accuracy}%</span>
            </div>
            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-full rounded-full bg-blue-500 transition-all duration-700"
                style={{ width: progressWidth }}
              />
            </div>
          </div>

          <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm">
            <div>
              <p className="text-xs text-gray-400">Уроков</p>
              <p className="font-semibold text-gray-900">{data.progress.lessonsCompleted}</p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">XP всего</p>
              <p className="font-semibold text-gray-900">{data.profile.xp}</p>
            </div>
          </div>
        </section>

        {/* 4. Слово дня */}
        <section className="rounded-2xl bg-[#1B5E20] p-5 text-white">
          <p className="text-xs font-semibold uppercase tracking-wide opacity-60">Слово дня</p>
          <p className="mt-3 text-3xl font-bold leading-none">{WORD_OF_DAY.lak}</p>
          <p className="mt-1.5 text-base opacity-80">{WORD_OF_DAY.ru}</p>
          <p className="mt-1 font-mono text-xs opacity-50">{WORD_OF_DAY.transcription}</p>

          <Link
            href="/dictionary"
            className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-white/15 px-3 py-1.5 text-xs font-medium transition hover:bg-white/25"
          >
            + Найти в словаре
          </Link>
        </section>

        {/* 5. Быстрые разделы */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Разделы</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            {[
              { href: "/dictionary", icon: "📖", label: "Словарь", ready: true },
              { href: "/letters",    icon: "🔤", label: "Алфавит", ready: true },
              { href: "/dashboard",  icon: "📊", label: "Статистика", ready: false },
              { href: "/dashboard",  icon: "📝", label: "Грамматика", ready: false },
            ].map((item) => (
              <Link
                key={item.label}
                href={item.href}
                onClick={!item.ready ? (e) => e.preventDefault() : undefined}
                className={[
                  "flex flex-col items-center gap-1.5 rounded-xl border p-3 text-center transition",
                  item.ready
                    ? "border-gray-100 bg-gray-50 hover:bg-gray-100 cursor-pointer"
                    : "border-gray-100 bg-gray-50 cursor-default opacity-60",
                ].join(" ")}
              >
                <span className="text-xl">{item.icon}</span>
                <span className="text-xs font-medium text-gray-700">{item.label}</span>
                {!item.ready && (
                  <span className="rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] text-orange-600">
                    Скоро
                  </span>
                )}
              </Link>
            ))}
          </div>
        </section>

        {/* 6. Совет дня */}
        <section className="rounded-2xl border border-gray-200 bg-white p-5">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Совет дня</p>
          <div className="mt-3 flex gap-3">
            <span className="mt-0.5 text-xl shrink-0">💡</span>
            <p className="text-sm leading-relaxed text-gray-600">
              В лакском языке глагол меняется в зависимости от пола говорящего.{" "}
              <span className="font-semibold text-gray-900">«На увкIра»</span> — я пришёл (муж.),{" "}
              <span className="font-semibold text-gray-900">«На бувкIра»</span> — я пришла (жен.).
            </p>
          </div>
        </section>

        {/* 7. Рейтинг — на всю ширину */}
        <section className="col-span-1 rounded-2xl border border-gray-200 bg-white p-5 md:col-span-2 lg:col-span-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-4 w-4 text-amber-500" />
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">Рейтинг</p>
          </div>

          <div className="mt-3 divide-y divide-gray-50">
            {data.leaderboardTop.map((user) => {
              const isMe = user.name === data.profile.name;
              return (
                <div
                  key={user.id}
                  className={[
                    "flex items-center gap-3 py-2.5 text-sm",
                    isMe ? "rounded-xl bg-blue-50 px-3 -mx-3" : "",
                  ].join(" ")}
                >
                  <span className="w-6 shrink-0 text-center">
                    <RankMedal rank={user.rank} />
                  </span>
                  <span className={["flex-1 truncate", isMe ? "font-semibold text-blue-800" : "text-gray-700"].join(" ")}>
                    {isMe ? `Вы (${user.name})` : user.name}
                  </span>
                  <span className={["font-medium", isMe ? "text-blue-700" : "text-gray-500"].join(" ")}>
                    {user.xp} XP
                  </span>
                  <span className="text-orange-500 text-xs">
                    🔥 {user.streak}
                  </span>
                </div>
              );
            })}

            {/* Позиция текущего пользователя если он вне топ-10 */}
            {data.myLeaderboardRow && data.myLeaderboardRow.rank > 10 && (
              <>
                <div className="py-1 text-center text-xs text-gray-300">· · ·</div>
                <div className="flex items-center gap-3 rounded-xl bg-blue-50 px-3 py-2.5 text-sm -mx-3">
                  <span className="w-6 shrink-0 text-center text-xs text-gray-500">
                    {data.myLeaderboardRow.rank}
                  </span>
                  <span className="flex-1 truncate font-semibold text-blue-800">
                    Вы ({data.myLeaderboardRow.name})
                  </span>
                  <span className="font-medium text-blue-700">{data.myLeaderboardRow.xp} XP</span>
                  <span className="text-orange-500 text-xs">🔥 {data.myLeaderboardRow.streak}</span>
                </div>
              </>
            )}
          </div>
        </section>

      </div>
    </div>
  );
}