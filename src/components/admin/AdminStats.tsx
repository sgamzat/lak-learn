"use client";

import { useEffect, useState } from "react";
import { BookOpen, LayoutList, Users, ScrollText } from "lucide-react";

type Stats = {
  totalWords:       number;
  totalCollections: number;
  totalUsers:       number;
  auditToday:       number;
};

type StatusState = "loading" | "ready" | "error";

const CARDS = [
  {
    key:   "totalWords"       as const,
    label: "Слов в базе",
    icon:  <BookOpen className="h-4 w-4" />,
    color: "text-blue-600 bg-blue-50",
  },
  {
    key:   "totalCollections" as const,
    label: "Наборов",
    icon:  <LayoutList className="h-4 w-4" />,
    color: "text-violet-600 bg-violet-50",
  },
  {
    key:   "totalUsers"       as const,
    label: "Пользователей",
    icon:  <Users className="h-4 w-4" />,
    color: "text-emerald-600 bg-emerald-50",
  },
  {
    key:   "auditToday"       as const,
    label: "Действий сегодня",
    icon:  <ScrollText className="h-4 w-4" />,
    color: "text-orange-600 bg-orange-50",
  },
];

export function AdminStats() {
  const [stats, setStats]   = useState<Stats | null>(null);
  const [status, setStatus] = useState<StatusState>("loading");

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        const res = await fetch("/api/admin/stats", {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) throw new Error("not ok");

        const data = (await res.json()) as Stats;

        if (mounted) {
          setStats(data);
          setStatus("ready");
        }
      } catch {
        if (mounted) setStatus("error");
      }
    };

    void load();

    return () => { mounted = false; };
  }, []);

  // ── Skeleton ──────────────────────────────────────────────────────
  if (status === "loading") {
    return (
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CARDS.map((card) => (
          <div
            key={card.key}
            className="h-20 animate-pulse rounded-2xl border border-gray-200 bg-gray-100"
          />
        ))}
      </div>
    );
  }

  if (status === "error" || !stats) {
    return (
      <p className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        Не удалось загрузить статистику
      </p>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {CARDS.map((card) => (
        <div
          key={card.key}
          className="flex items-center gap-3 rounded-2xl border border-gray-200 bg-white px-4 py-3"
        >
          <span className={`rounded-xl p-2 ${card.color}`}>{card.icon}</span>
          <div>
            <p className="text-xl font-bold leading-none text-gray-900">
              {stats[card.key].toLocaleString("ru-RU")}
            </p>
            <p className="mt-0.5 text-xs text-gray-500">{card.label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}