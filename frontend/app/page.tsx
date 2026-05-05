"use client";

import { useEffect, useState } from "react";

import { fetchStats, type StatsResponse } from "../lib/api";
import { getToken } from "../lib/auth";
import { ProgressRing } from "../components/ProgressRing";


export default function DashboardPage() {
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      return;
    }
    fetchStats(token).then(setStats).catch((err) => setError(String(err)));
  }, []);

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-8">
      <h1 className="text-3xl font-semibold">Dashboard</h1>
      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <ProgressRing due={stats?.due_today ?? 0} mastered={stats?.mastered ?? 0} />
        <div className="rounded-xl border border-slate-700 bg-slate-900 p-5">
          <p className="text-slate-400">Streak</p>
          <p className="text-3xl font-semibold">{stats?.streak ?? 0}</p>
          <p className="mt-4 text-slate-400">Accuracy</p>
          <p className="text-3xl font-semibold">{Math.round((stats?.accuracy ?? 0) * 100)}%</p>
        </div>
      </div>
      <a href="/study" className="mt-6 inline-block rounded bg-emerald-700 px-4 py-2">
        Начать занятие
      </a>
      {error ? <p className="mt-4 text-rose-300">{error}</p> : null}
    </main>
  );
}

