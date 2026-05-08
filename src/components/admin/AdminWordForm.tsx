"use client";

import { FormEvent, useState } from "react";

type StatusState =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function AdminWordForm() {
  const [lemma, setLemma] = useState("");
  const [translation, setTranslation] = useState("");
  const [transcription, setTranscription] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [level, setLevel] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusState>({ type: "idle" });

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: "idle" });

    try {
      const response = await fetch("/api/admin/words", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          lemma,
          translation,
          transcription,
          partOfSpeech,
          level
        })
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; id?: number };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось добавить слово" });
        return;
      }

      setLemma("");
      setTranslation("");
      setTranscription("");
      setPartOfSpeech("");
      setLevel("");
      setStatus({ type: "success", message: `Слово добавлено (id: ${payload.id ?? "n/a"})` });
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка, попробуйте ещё раз" });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Добавить слово</h2>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Слово (lemma) *</span>
        <input
          required
          value={lemma}
          onChange={(event) => setLemma(event.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          placeholder="кьини"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Перевод *</span>
        <input
          required
          value={translation}
          onChange={(event) => setTranslation(event.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          placeholder="книга"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Транскрипция</span>
        <input
          value={transcription}
          onChange={(event) => setTranscription(event.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          placeholder="qini"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Часть речи</span>
        <input
          value={partOfSpeech}
          onChange={(event) => setPartOfSpeech(event.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          placeholder="Сущ."
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Уровень</span>
        <input
          value={level}
          onChange={(event) => setLevel(event.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          placeholder="A1"
        />
      </label>

      {status.type === "error" ? <p className="text-sm text-red-600">{status.message}</p> : null}
      {status.type === "success" ? <p className="text-sm text-green-700">{status.message}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Сохраняю..." : "Добавить слово"}
      </button>
    </form>
  );
}

