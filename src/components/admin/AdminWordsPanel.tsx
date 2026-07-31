"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Search, Pencil, Trash2, Check, X, Plus } from "lucide-react";

type Word = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  partOfSpeech: string | null;
  gender: string | null;
  verbAspect: string | null;
  wordType: string;
  notes: string | null;
  translationPriority: number;
  synonymGroupId: string | null;
};

type EditState = {
  lemma: string;
  translation: string;
  transcription: string;
  partOfSpeech: string;
  gender: string;
  verbAspect: string;
  wordType: string;
  notes: string;
  translationPriority: string;
  synonymGroupId: string;
};

type StatusState =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

const emptyEdit = (): EditState => ({
  lemma: "",
  translation: "",
  transcription: "",
  partOfSpeech: "",
  gender: "",
  verbAspect: "",
  wordType: "word",
  notes: "",
  translationPriority: "1",
  synonymGroupId: ""
});

function wordToEdit(word: Word): EditState {
  return {
    lemma: word.lemma,
    translation: word.translation,
    transcription: word.transcription ?? "",
    partOfSpeech: word.partOfSpeech ?? "",
    gender: word.gender ?? "",
    verbAspect: word.verbAspect ?? "",
    wordType: word.wordType || "word",
    notes: word.notes ?? "",
    translationPriority: String(word.translationPriority ?? 1),
    synonymGroupId: word.synonymGroupId ?? ""
  };
}

function editToPayload(draft: EditState) {
  const priority = Number.parseInt(draft.translationPriority, 10);
  return {
    lemma: draft.lemma.trim(),
    translation: draft.translation.trim(),
    transcription: draft.transcription.trim() || null,
    partOfSpeech: draft.partOfSpeech.trim() || null,
    gender: draft.gender || null,
    verbAspect: draft.verbAspect || null,
    wordType: draft.wordType === "phrase" ? "phrase" : "word",
    notes: draft.notes.trim() || null,
    translationPriority: Number.isInteger(priority) && priority >= 1 ? priority : 1,
    synonymGroupId: draft.synonymGroupId.trim() || null
  };
}

const inputCls =
  "w-full rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-sm outline-none focus:border-blue-500";
const labelCls = "space-y-0.5";
const hintCls = "text-xs text-gray-500";

function WordFields({
  draft,
  setDraft,
  autoFocus
}: {
  draft: EditState;
  setDraft: (fn: (d: EditState) => EditState) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
      <label className={labelCls}>
        <span className={hintCls}>Лакское слово *</span>
        <input
          className={inputCls}
          value={draft.lemma}
          onChange={(e) => setDraft((d) => ({ ...d, lemma: e.target.value }))}
          autoFocus={autoFocus}
          required
        />
      </label>
      <label className={labelCls}>
        <span className={hintCls}>Русский перевод *</span>
        <input
          className={inputCls}
          value={draft.translation}
          onChange={(e) => setDraft((d) => ({ ...d, translation: e.target.value }))}
          required
        />
      </label>
      <label className={labelCls}>
        <span className={hintCls}>Транскрипция</span>
        <input
          className={inputCls}
          value={draft.transcription}
          onChange={(e) => setDraft((d) => ({ ...d, transcription: e.target.value }))}
        />
      </label>
      <label className={labelCls}>
        <span className={hintCls}>Часть речи</span>
        <select
          className={inputCls}
          value={draft.partOfSpeech}
          onChange={(e) => setDraft((d) => ({ ...d, partOfSpeech: e.target.value }))}
        >
          <option value="">—</option>
          <option value="Сущ.">Сущ.</option>
          <option value="Глаг.">Глаг.</option>
          <option value="Прил.">Прил.</option>
          <option value="Нареч.">Нареч.</option>
          <option value="Предл.">Предл.</option>
          <option value="Союз">Союз</option>
          <option value="Мест.">Мест.</option>
          <option value="Межд.">Межд.</option>
          <option value="Частица">Частица</option>
          <option value="Фраза">Фраза</option>
          <option value="Числ.">Числ.</option>
        </select>
      </label>
      <label className={labelCls}>
        <span className={hintCls}>Род</span>
        <select
          className={inputCls}
          value={draft.gender}
          onChange={(e) => setDraft((d) => ({ ...d, gender: e.target.value }))}
        >
          <option value="">—</option>
          <option value="м">м</option>
          <option value="ж">ж</option>
          <option value="ср">ср</option>
        </select>
      </label>
      <label className={labelCls}>
        <span className={hintCls}>Вид глагола</span>
        <select
          className={inputCls}
          value={draft.verbAspect}
          onChange={(e) => setDraft((d) => ({ ...d, verbAspect: e.target.value }))}
        >
          <option value="">—</option>
          <option value="сов.">сов.</option>
          <option value="несов.">несов.</option>
          <option value="однокр.">однокр.</option>
        </select>
      </label>
      <label className={labelCls}>
        <span className={hintCls}>Тип</span>
        <select
          className={inputCls}
          value={draft.wordType}
          onChange={(e) => setDraft((d) => ({ ...d, wordType: e.target.value }))}
        >
          <option value="word">слово</option>
          <option value="phrase">фраза</option>
        </select>
      </label>
      <label className={labelCls}>
        <span className={hintCls}>Приоритет (1 = в SRS)</span>
        <input
          className={inputCls}
          type="number"
          min={1}
          value={draft.translationPriority}
          onChange={(e) => setDraft((d) => ({ ...d, translationPriority: e.target.value }))}
        />
      </label>
      <label className={`${labelCls} sm:col-span-2`}>
        <span className={hintCls}>Группа синонимов (напр. грязь#1)</span>
        <input
          className={inputCls}
          value={draft.synonymGroupId}
          onChange={(e) => setDraft((d) => ({ ...d, synonymGroupId: e.target.value }))}
          placeholder="пусто = без группы"
        />
      </label>
      <label className={`${labelCls} sm:col-span-2`}>
        <span className={hintCls}>Пометы / notes</span>
        <input
          className={inputCls}
          value={draft.notes}
          onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
          placeholder="перен., устар., тж. …"
        />
      </label>
    </div>
  );
}

function ConfirmDeleteModal({
  word,
  onConfirm,
  onCancel,
  isDeleting
}: {
  word: Word;
  onConfirm: () => void;
  onCancel: () => void;
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
          Soft delete: слово скроется из словаря, история SRS сохранится.
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

function WordRow({
  word,
  onUpdated,
  onDeleted
}: {
  word: Word;
  onUpdated: (w: Word) => void;
  onDeleted: (id: number) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [rowError, setRowError] = useState<string | null>(null);
  const [draft, setDraft] = useState<EditState>(() => wordToEdit(word));

  function startEdit() {
    setDraft(wordToEdit(word));
    setRowError(null);
    setEditing(true);
  }

  async function saveEdit() {
    const payload = editToPayload(draft);
    if (!payload.lemma || !payload.translation) {
      setRowError("Слово и перевод обязательны");
      return;
    }

    setSaving(true);
    setRowError(null);

    try {
      const res = await fetch(`/api/admin/words/${word.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      });

      const body = (await res.json().catch(() => ({}))) as { error?: string; word?: Word };

      if (!res.ok) {
        setRowError(body.error ?? "Не удалось сохранить");
        return;
      }

      if (body.word) {
        onUpdated(body.word);
      }
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
        method: "DELETE",
        headers: { Accept: "application/json" }
      });

      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        setRowError(body.error ?? "Не удалось удалить");
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

  const meta = [
    word.partOfSpeech,
    word.gender,
    word.verbAspect,
    word.wordType === "phrase" ? "фраза" : null,
    word.translationPriority > 1 ? `p${word.translationPriority}` : null,
    word.synonymGroupId,
    word.notes
  ].filter(Boolean);

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
          <div className="space-y-3">
            <WordFields draft={draft} setDraft={setDraft} autoFocus />
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
                onClick={() => {
                  setEditing(false);
                  setRowError(null);
                }}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
              >
                <X className="h-3.5 w-3.5" />
                Отмена
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-gray-900">
                {word.lemma}
                {word.transcription && (
                  <span className="ml-1.5 font-mono text-sm font-normal text-gray-400">
                    [{word.transcription}]
                  </span>
                )}
              </p>
              <p className="mt-0.5 truncate text-sm text-gray-600">{word.translation}</p>
              {meta.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {meta.map((item) => (
                    <span
                      key={String(item)}
                      className="inline-block rounded-md bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600"
                    >
                      {item}
                    </span>
                  ))}
                </div>
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

export function AdminWordsPanel() {
  const [query, setQuery] = useState("");
  const [words, setWords] = useState<Word[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<StatusState>({ type: "idle" });
  const [searched, setSearched] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [createDraft, setCreateDraft] = useState<EditState>(emptyEdit);
  const [isCreating, setIsCreating] = useState(false);

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
      const res = await fetch(`/api/admin/words?q=${encodeURIComponent(trimmed)}&limit=40`, {
        headers: { Accept: "application/json" }
      });

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

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    debounceRef.current = setTimeout(() => void search(query), 350);
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
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

  async function createWord(event: FormEvent) {
    event.preventDefault();
    const payload = editToPayload(createDraft);
    if (!payload.lemma || !payload.translation) {
      setStatus({ type: "error", message: "Слово и перевод обязательны" });
      return;
    }

    setIsCreating(true);
    setStatus({ type: "idle" });

    try {
      const res = await fetch("/api/admin/words", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(payload)
      });

      const body = (await res.json().catch(() => ({}))) as {
        error?: string;
        word?: Word;
      };

      if (!res.ok) {
        setStatus({ type: "error", message: body.error ?? "Не удалось добавить слово" });
        return;
      }

      const created = body.word;
      if (created) {
        setWords((prev) => [created, ...prev.filter((w) => w.id !== created.id)]);
        setQuery(created.lemma);
      }
      setCreateDraft(emptyEdit());
      setShowCreate(false);
      setSearched(true);
      setStatus({ type: "success", message: `«${payload.lemma}» добавлено` });
      setTimeout(() => setStatus({ type: "idle" }), 3000);
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при создании" });
    } finally {
      setIsCreating(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Слова</h2>
          <p className="mt-0.5 text-sm text-gray-500">
            Поиск, правка ошибок импорта, добавление новых слов.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowCreate((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
        >
          <Plus className="h-4 w-4" />
          {showCreate ? "Скрыть форму" : "Добавить слово"}
        </button>
      </div>

      {showCreate && (
        <form
          onSubmit={(e) => void createWord(e)}
          className="mt-4 space-y-3 rounded-xl border border-blue-200 bg-blue-50/60 p-4"
        >
          <p className="text-sm font-medium text-blue-900">Новое слово</p>
          <WordFields draft={createDraft} setDraft={setCreateDraft} autoFocus />
          <button
            type="submit"
            disabled={isCreating}
            className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {isCreating ? "Добавляю..." : "Создать"}
          </button>
        </form>
      )}

      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по лакскому, русскому или группе синонимов…"
          className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
        />
      </div>

      {status.type !== "idle" && (
        <p
          className={`mt-3 text-sm ${status.type === "error" ? "text-red-600" : "text-green-700"}`}
        >
          {status.message}
        </p>
      )}

      <div className="mt-4 space-y-2">
        {loading && <p className="text-sm text-gray-500">Ищу…</p>}
        {!loading && searched && words.length === 0 && (
          <p className="text-sm text-gray-500">Ничего не найдено</p>
        )}
        {!loading &&
          words.map((word) => (
            <WordRow
              key={word.id}
              word={word}
              onUpdated={handleUpdated}
              onDeleted={handleDeleted}
            />
          ))}
      </div>
    </section>
  );
}
