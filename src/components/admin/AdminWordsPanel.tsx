"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Search, Pencil, Trash2, Check, X } from "lucide-react";

// ── Типы ─────────────────────────────────────────────────────────────────────
type Word = {
  id:            number;
  lemma:         string;
  translation:   string;
  transcription: string | null;
  partOfSpeech:  string | null;
};

type EditState = {
  lemma:         string;
  translation:   string;
  transcription: string;
  partOfSpeech:  string;
};

type StatusState =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error";   message: string };

// ── Вспомогательный компонент: модалка подтверждения удаления ────────────────
function ConfirmDeleteModal({
  word,
  onConfirm,
  onCancel,
  isDeleting,
}: {
  word:       Word;
  onConfirm:  () => void;
  onCancel:   () => void;
  isDeleting: boolean;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="w-full max-w-sm rounded-2xl border border-gray-200 bg-white p-6 shadow-xl">
        <h3 className="text-base font-semibold text-gray-900">Удалить слово?</h3>
        <p className="mt-2 text-sm text-gray-600">
          <span className="font-medium">{word.lemma}</span> — {word.translation}
        </p>
        <p className="mt-1 text-xs text-gray-400">
          Слово будет деактивировано (soft delete). Его история SRS сохранится.
        </p>
        <div className="mt-5 flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={isDeleting}
            className="inline-flex flex-1 items-center justify-center rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 transition hover:bg-gray-50 disabled:opacity-60"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isDeleting}
            className="inline-flex flex-1 items-center justify-center rounded-xl bg-red-500 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-red-600 disabled:opacity-60"
          >
            {isDeleting ? "Удаляю..." : "Удалить"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Строка слова ──────────────────────────────────────────────────────────────
function WordRow({
  word,
  onUpdated,
  onDeleted,
}: {
  word:      Word;
  onUpdated: (w: Word) => void;
  onDeleted: (id: number) => void;
}) {
  const [editing, setEditing]     = useState(false);
  const [saving,  setSaving]      = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting]   = useState(false);
  const [rowError, setRowError]   = useState<string | null>(null);

  const [draft, setDraft] = useState<EditState>({
    lemma:         word.lemma,
    translation:   word.translation,
    transcription: word.transcription ?? "",
    partOfSpeech:  word.partOfSpeech  ?? "",
  });

  function startEdit() {
    setDraft({
      lemma:         word.lemma,
      translation:   word.translation,
      transcription: word.transcription ?? "",
      partOfSpeech:  word.partOfSpeech  ?? "",
    });
    setRowError(null);
    setEditing(true);
  }

  async function saveEdit() {
    if (!draft.lemma.trim() || !draft.translation.trim()) {
      setRowError("Слово и перевод обязательны");
      return;
    }

    setSaving(true);
    setRowError(null);

    try {
      const res = await fetch(`/api/admin/words/${word.id}`, {
        method:  "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          lemma:         draft.lemma.trim(),
          translation:   draft.translation.trim(),
          transcription: draft.transcription.trim() || null,
          partOfSpeech:  draft.partOfSpeech.trim()  || null,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as { error?: string; word?: Word };

      if (!res.ok) {
        setRowError(payload.error ?? "Не удалось сохранить");
        return;
      }

      if (payload.word) onUpdated(payload.word);
      setEditing(false);
    } catch {
      setRowError("Сетевая ошибка");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDeleteWord() {
    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/words/${word.id}`, {
        method:  "DELETE",
        headers: { Accept: "application/json" },
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setRowError(payload.error ?? "Не удалось удалить");
        setConfirmDelete(false);
        return;
      }

      onDeleted(word.id);
    } catch {
      setRowError("Сетевая ошибка при удалении");
      setConfirmDelete(false);
    } finally {
      setDeleting(false);
    }
  }

  const inputCls =
    "w-full rounded-lg border border-blue-300 bg-white px-2 py-1 text-sm outline-none focus:border-blue-500";

  return (
    <>
      {confirmDelete && (
        <ConfirmDeleteModal
          word={word}
          onConfirm={() => void confirmDeleteWord()}
          onCancel={() => setConfirmDelete(false)}
          isDeleting={deleting}
        />
      )}

      <article className="rounded-xl border border-gray-200 bg-white p-3">
        {editing ? (
          // ── Режим редактирования ───────────────────────────────────────────
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <label className="space-y-0.5">
                <span className="text-xs text-gray-500">Слово *</span>
                <input
                  className={inputCls}
                  value={draft.lemma}
                  onChange={(e) => setDraft((d) => ({ ...d, lemma: e.target.value }))}
                  autoFocus
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-xs text-gray-500">Перевод *</span>
                <input
                  className={inputCls}
                  value={draft.translation}
                  onChange={(e) => setDraft((d) => ({ ...d, translation: e.target.value }))}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-xs text-gray-500">Транскрипция</span>
                <input
                  className={inputCls}
                  value={draft.transcription}
                  onChange={(e) => setDraft((d) => ({ ...d, transcription: e.target.value }))}
                />
              </label>
              <label className="space-y-0.5">
                <span className="text-xs text-gray-500">Часть речи</span>
                <input
                  className={inputCls}
                  value={draft.partOfSpeech}
                  onChange={(e) => setDraft((d) => ({ ...d, partOfSpeech: e.target.value }))}
                />
              </label>
            </div>

            {rowError && <p className="text-xs text-red-600">{rowError}</p>}

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => void saveEdit()}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
              >
                <Check className="h-3.5 w-3.5" />
                {saving ? "Сохраняю..." : "Сохранить"}
              </button>
              <button
                type="button"
                onClick={() => { setEditing(false); setRowError(null); }}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" />
                Отмена
              </button>
            </div>
          </div>
        ) : (
          // ── Режим просмотра ────────────────────────────────────────────────
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900">
                {word.lemma}
                {word.transcription && (
                  <span className="ml-1.5 font-normal text-gray-400 font-mono text-sm">
                    [{word.transcription}]
                  </span>
                )}
              </p>
              <p className="mt-0.5 truncate text-sm text-gray-600">{word.translation}</p>
              {word.partOfSpeech && (
                <span className="mt-1 inline-block rounded-md bg-blue-50 px-1.5 py-0.5 text-xs text-blue-700">
                  {word.partOfSpeech}
                </span>
              )}
              {rowError && <p className="mt-1 text-xs text-red-600">{rowError}</p>}
            </div>

            <div className="flex shrink-0 gap-1">
              <button
                type="button"
                onClick={startEdit}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition hover:border-blue-300 hover:text-blue-600"
                aria-label="Редактировать"
              >
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="rounded-lg border border-gray-200 p-1.5 text-gray-500 transition hover:border-red-300 hover:text-red-600"
                aria-label="Удалить"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </article>
    </>
  );
}

// ── Основной компонент ────────────────────────────────────────────────────────
export function AdminWordsPanel() {
  const [query,    setQuery]    = useState("");
  const [words,    setWords]    = useState<Word[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [status,   setStatus]   = useState<StatusState>({ type: "idle" });
  const [searched, setSearched] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const search = useCallback(async (q: string) => {
    const trimmed = q.trim();
    if (!trimmed) {
      setWords([]);
      setSearched(false);
      return;
    }

    setLoading(true);
    setStatus({ type: "idle" });

    try {
      const res = await fetch(
        `/api/admin/words?q=${encodeURIComponent(trimmed)}&limit=30`,
        { headers: { Accept: "application/json" } }
      );

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
        words?: Word[];
      };

      if (!res.ok) {
        setStatus({ type: "error", message: payload.error ?? "Ошибка поиска" });
        setWords([]);
      } else {
        setWords(payload.words ?? []);
        setSearched(true);
      }
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка" });
      setWords([]);
    } finally {
      setLoading(false);
    }
  }, []);

  // Debounce 350ms
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => void search(query), 350);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query, search]);

  function handleUpdated(updated: Word) {
    setWords((prev) => prev.map((w) => (w.id === updated.id ? { ...w, ...updated } : w)));
    setStatus({ type: "success", message: `«${updated.lemma}» обновлено` });
    setTimeout(() => setStatus({ type: "idle" }), 3000);
  }

  function handleDeleted(id: number) {
    setWords((prev) => prev.filter((w) => w.id !== id));
    setStatus({ type: "success", message: "Слово удалено" });
    setTimeout(() => setStatus({ type: "idle" }), 3000);
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Все слова</h2>
      <p className="mt-0.5 text-sm text-gray-500">
        Поиск по всей базе, инлайн-редактирование и удаление.
      </p>

      {/* Поиск */}
      <div className="relative mt-4">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 pointer-events-none" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Введите слово на лакском или по-русски…"
          className="w-full rounded-xl border border-gray-300 py-2.5 pl-9 pr-4 text-sm outline-none transition focus:border-blue-500"
        />
      </div>

      {/* Статус */}
      {status.type === "error" && (
        <p className="mt-3 text-sm text-red-600">{status.message}</p>
      )}
      {status.type === "success" && (
        <p className="mt-3 text-sm text-green-700">{status.message}</p>
      )}

      {/* Результаты */}
      <div className="mt-4 space-y-2">
        {loading && (
          <>
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-100" />
            ))}
          </>
        )}

        {!loading && searched && words.length === 0 && (
          <p className="py-6 text-center text-sm text-gray-400">Ничего не найдено</p>
        )}

        {!loading && words.map((word) => (
          <WordRow
            key={word.id}
            word={word}
            onUpdated={handleUpdated}
            onDeleted={handleDeleted}
          />
        ))}

        {!loading && !searched && (
          <p className="py-6 text-center text-sm text-gray-400">
            Начните вводить запрос для поиска
          </p>
        )}
      </div>
    </section>
  );
}