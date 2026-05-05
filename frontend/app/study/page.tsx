"use client";

import { useEffect, useState } from "react";

import { Flashcard } from "../../components/Flashcard";
import { fetchQueue, submitReview, type QueueItem } from "../../lib/api";
import { getToken } from "../../lib/auth";


export default function StudyPage() {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      return;
    }
    fetchQueue(token).then(setQueue).catch((err) => setError(String(err)));
  }, []);

  async function onGrade(quality: 0 | 1 | 2 | 3) {
    const token = getToken();
    const current = queue[0];
    if (!token || !current) {
      return;
    }
    await submitReview(token, current.progress_id, quality);
    const updated = await fetchQueue(token);
    setQueue(updated);
  }

  return (
    <main className="mx-auto min-h-screen max-w-3xl p-8">
      <h1 className="mb-6 text-3xl font-semibold">Study</h1>
      {queue[0] ? (
        <Flashcard item={queue[0]} onGrade={onGrade} />
      ) : (
        <p className="rounded bg-slate-900 p-4 text-slate-300">Нет слов в очереди.</p>
      )}
      {error ? <p className="mt-4 text-rose-300">{error}</p> : null}
    </main>
  );
}

