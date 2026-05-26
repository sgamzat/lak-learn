"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type AdminCollection = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  coverUrl: string | null;
  isPublic: boolean;
  sortOrder: number;
  ruleTagCodes: string[];
  isActive: boolean;
  wordCount: number;
};

type StatusState =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type AdminWordSuggestion = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  partOfSpeech: string | null;
};

type CollectionWord = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  partOfSpeech: string | null;
  level: string | null;
  popularityScore: number | null;
};

export function AdminCollectionsPanel() {
  const [collections, setCollections] = useState<AdminCollection[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [status, setStatus] = useState<StatusState>({ type: "idle" });

  const [newSlug, setNewSlug] = useState("");
  const [newTitle, setNewTitle] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLevel, setEditLevel] = useState("");
  const [editRuleTagCodes, setEditRuleTagCodes] = useState("");
  const [editSortOrder, setEditSortOrder] = useState("0");
  const [isPublic, setIsPublic] = useState(false);
  const [addWordQuery, setAddWordQuery] = useState("");
  const [wordSuggestions, setWordSuggestions] = useState<AdminWordSuggestion[]>([]);
  const [isSuggestionsLoading, setIsSuggestionsLoading] = useState(false);
  const [collectionWordsQuery, setCollectionWordsQuery] = useState("");
  const [collectionWords, setCollectionWords] = useState<CollectionWord[]>([]);
  const [isCollectionWordsLoading, setIsCollectionWordsLoading] = useState(false);
  const [wordActionIds, setWordActionIds] = useState<Set<number>>(new Set());

  const selectedCollection = useMemo(
    () => collections.find((item) => item.id === selectedId) ?? null,
    [collections, selectedId]
  );

  const syncEditorFromCollection = useCallback((collection: AdminCollection | null) => {
    if (!collection) {
      return;
    }

    setEditTitle(collection.title);
    setEditDescription(collection.description ?? "");
    setEditLevel(collection.level ?? "");
    setEditRuleTagCodes((collection.ruleTagCodes ?? []).join(", "));
    setEditSortOrder(String(collection.sortOrder));
    setIsPublic(collection.isPublic);
    setAddWordQuery("");
    setWordSuggestions([]);
    setCollectionWordsQuery("");
  }, []);

  const loadCollections = useCallback(async () => {
    setIsLoading(true);
    setStatus({ type: "idle" });

    try {
      const response = await fetch("/api/admin/collections", {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        collections?: AdminCollection[];
      };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось загрузить наборы" });
        setCollections([]);
        setSelectedId(null);
        return;
      }

      const nextCollections = payload.collections ?? [];
      setCollections(nextCollections);

      const keepSelected = nextCollections.find((item) => item.id === selectedId) ?? nextCollections[0] ?? null;
      const nextSelectedId = keepSelected?.id ?? null;
      setSelectedId(nextSelectedId);
      syncEditorFromCollection(keepSelected);
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при загрузке наборов" });
      setCollections([]);
      setSelectedId(null);
    } finally {
      setIsLoading(false);
    }
  }, [selectedId, syncEditorFromCollection]);

  useEffect(() => {
    void loadCollections();
  }, [loadCollections]);

  const loadCollectionWords = useCallback(async (collectionId: number, query: string) => {
    setIsCollectionWordsLoading(true);

    try {
      const params = new URLSearchParams();
      params.set("limit", "200");

      const normalizedQuery = query.trim();
      if (normalizedQuery) {
        params.set("q", normalizedQuery);
      }

      const response = await fetch(`/api/admin/collections/${collectionId}?${params.toString()}`, {
        method: "GET",
        headers: { Accept: "application/json" }
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        words?: CollectionWord[];
      };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось загрузить слова набора" });
        setCollectionWords([]);
        return;
      }

      setCollectionWords(payload.words ?? []);
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при загрузке слов набора" });
      setCollectionWords([]);
    } finally {
      setIsCollectionWordsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedCollection) {
      setCollectionWords([]);
      return;
    }

    const timeoutId = window.setTimeout(() => {
      void loadCollectionWords(selectedCollection.id, collectionWordsQuery);
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [collectionWordsQuery, loadCollectionWords, selectedCollection]);

  useEffect(() => {
    const normalized = addWordQuery.trim();

    if (!selectedCollection || normalized.length < 1) {
      setWordSuggestions([]);
      setIsSuggestionsLoading(false);
      return;
    }

    const timeoutId = window.setTimeout(async () => {
      setIsSuggestionsLoading(true);

      try {
        const params = new URLSearchParams();
        params.set("q", normalized);
        params.set("limit", "10");

        const response = await fetch(`/api/admin/words?${params.toString()}`, {
          method: "GET",
          headers: { Accept: "application/json" }
        });

        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          words?: AdminWordSuggestion[];
        };

        if (!response.ok) {
          setStatus({ type: "error", message: payload.error ?? "Не удалось загрузить подсказки" });
          setWordSuggestions([]);
          return;
        }

        setWordSuggestions(payload.words ?? []);
      } catch {
        setStatus({ type: "error", message: "Сетевая ошибка при загрузке подсказок" });
        setWordSuggestions([]);
      } finally {
        setIsSuggestionsLoading(false);
      }
    }, 250);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [addWordQuery, selectedCollection]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsCreating(true);
    setStatus({ type: "idle" });

    try {
      const response = await fetch("/api/admin/collections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          slug: newSlug,
          title: newTitle,
          isPublic: false,
          sortOrder: collections.length
        })
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось создать набор" });
        return;
      }

      setNewSlug("");
      setNewTitle("");
      setStatus({ type: "success", message: "Набор создан" });
      await loadCollections();
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при создании набора" });
    } finally {
      setIsCreating(false);
    }
  }

  async function saveCollection() {
    if (!selectedCollection) {
      return;
    }

    setIsSaving(true);
    setStatus({ type: "idle" });

    try {
      const response = await fetch(`/api/admin/collections/${selectedCollection.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          title: editTitle,
          description: editDescription,
          level: editLevel,
          isPublic,
          sortOrder: Number.parseInt(editSortOrder, 10),
          ruleTagCodes: editRuleTagCodes
            .split(",")
            .map((item) => item.trim())
            .filter((item) => item.length > 0)
        })
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось сохранить набор" });
        return;
      }

      setStatus({ type: "success", message: "Набор сохранён" });
      await loadCollections();
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при сохранении набора" });
    } finally {
      setIsSaving(false);
    }
  }

  async function addWordToCollection(wordId: number) {
    if (!selectedCollection || wordActionIds.has(wordId)) {
      return;
    }

    setWordActionIds((prev) => new Set(prev).add(wordId));
    setStatus({ type: "idle" });

    try {
      const response = await fetch(`/api/admin/collections/${selectedCollection.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          manualIncludeWordIds: [wordId]
        })
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось добавить слово в набор" });
        return;
      }

      setStatus({ type: "success", message: "Слово добавлено в набор" });
      await Promise.all([loadCollections(), loadCollectionWords(selectedCollection.id, collectionWordsQuery)]);
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при добавлении слова" });
    } finally {
      setWordActionIds((prev) => {
        const next = new Set(prev);
        next.delete(wordId);
        return next;
      });
    }
  }

  async function removeWordFromCollection(wordId: number) {
    if (!selectedCollection || wordActionIds.has(wordId)) {
      return;
    }

    setWordActionIds((prev) => new Set(prev).add(wordId));
    setStatus({ type: "idle" });

    try {
      const response = await fetch(`/api/admin/collections/${selectedCollection.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          manualExcludeWordIds: [wordId]
        })
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось удалить слово из набора" });
        return;
      }

      setStatus({ type: "success", message: "Слово удалено из набора" });
      await Promise.all([loadCollections(), loadCollectionWords(selectedCollection.id, collectionWordsQuery)]);
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при удалении слова" });
    } finally {
      setWordActionIds((prev) => {
        const next = new Set(prev);
        next.delete(wordId);
        return next;
      });
    }
  }

  const visibleSuggestions = useMemo(() => {
    const currentWordIds = new Set(collectionWords.map((word) => word.id));
    return wordSuggestions.filter((word) => !currentWordIds.has(word.id));
  }, [collectionWords, wordSuggestions]);

  async function deleteCollection() {
    if (!selectedCollection) {
      return;
    }

    const confirmed = window.confirm(`Удалить набор «${selectedCollection.title}»?`);
    if (!confirmed) {
      return;
    }

    setIsDeleting(true);
    setStatus({ type: "idle" });

    try {
      const response = await fetch(`/api/admin/collections/${selectedCollection.id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" }
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось удалить набор" });
        return;
      }

      setStatus({ type: "success", message: "Набор удалён" });
      await loadCollections();
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при удалении набора" });
    } finally {
      setIsDeleting(false);
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm lg:col-span-2">
      <h2 className="text-lg font-semibold">Наборы карточек</h2>

      {status.type === "error" ? <p className="mt-2 text-sm text-red-600">{status.message}</p> : null}
      {status.type === "success" ? <p className="mt-2 text-sm text-green-700">{status.message}</p> : null}

      <form onSubmit={onCreate} className="mt-4 grid grid-cols-1 gap-2 rounded-xl border border-gray-200 p-3 sm:grid-cols-4">
        <input
          value={newSlug}
          onChange={(event) => setNewSlug(event.target.value)}
          required
          placeholder="slug (например, popular-verbs)"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
        />
        <input
          value={newTitle}
          onChange={(event) => setNewTitle(event.target.value)}
          required
          placeholder="Название набора"
          className="rounded-lg border border-gray-300 px-3 py-2 text-sm sm:col-span-2"
        />
        <button
          type="submit"
          disabled={isCreating}
          className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isCreating ? "Создание..." : "Создать"}
        </button>
      </form>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="max-h-[360px] space-y-2 overflow-auto rounded-xl border border-gray-200 p-2">
          {isLoading ? <p className="p-2 text-sm text-gray-600">Загрузка...</p> : null}
          {!isLoading && collections.length === 0 ? <p className="p-2 text-sm text-gray-600">Наборы не созданы.</p> : null}

          {collections.map((collection) => (
            <button
              key={collection.id}
              type="button"
              onClick={() => {
                setSelectedId(collection.id);
                syncEditorFromCollection(collection);
              }}
              className={
                selectedId === collection.id
                  ? "w-full rounded-lg border border-blue-400 bg-blue-50 p-3 text-left"
                  : "w-full rounded-lg border border-gray-200 p-3 text-left hover:bg-gray-50"
              }
            >
              <p className="font-medium text-gray-900">{collection.title}</p>
              <p className="mt-1 text-xs text-gray-500">
                slug: {collection.slug} · слов: {collection.wordCount}
              </p>
            </button>
          ))}
        </div>

        <div className="space-y-2 rounded-xl border border-gray-200 p-3">
          {!selectedCollection ? <p className="text-sm text-gray-600">Выберите набор для редактирования.</p> : null}

          {selectedCollection ? (
            <>
              <input
                value={editTitle}
                onChange={(event) => setEditTitle(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Название"
              />

              <input
                value={editLevel}
                onChange={(event) => setEditLevel(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Уровень (A1, B2...)"
              />

              <textarea
                value={editDescription}
                onChange={(event) => setEditDescription(event.target.value)}
                className="min-h-20 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Описание"
              />

              <input
                value={editRuleTagCodes}
                onChange={(event) => setEditRuleTagCodes(event.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Теги через запятую (verbs, travel)"
              />

              <section className="space-y-2 rounded-lg border border-blue-200 bg-blue-50 p-3">
                <p className="text-xs font-semibold text-blue-900">Добавить слово в набор</p>
                <input
                  value={addWordQuery}
                  onChange={(event) => setAddWordQuery(event.target.value)}
                  className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm"
                  placeholder="Начните вводить слово на лакском или русском"
                />

                {isSuggestionsLoading ? <p className="text-xs text-blue-800">Поиск слов...</p> : null}

                {!isSuggestionsLoading && addWordQuery.trim().length > 0 && visibleSuggestions.length === 0 ? (
                  <p className="text-xs text-blue-800">Подходящих слов не найдено.</p>
                ) : null}

                {visibleSuggestions.length > 0 ? (
                  <div className="max-h-52 space-y-2 overflow-auto rounded-lg border border-blue-200 bg-white p-2">
                    {visibleSuggestions.map((word) => (
                      <div key={word.id} className="flex items-start justify-between gap-2 rounded-lg border border-blue-100 p-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {word.lemma} — {word.translation}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {word.transcription ?? "—"}
                            {word.partOfSpeech ? ` · ${word.partOfSpeech}` : ""}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            void addWordToCollection(word.id);
                          }}
                          disabled={wordActionIds.has(word.id)}
                          className="shrink-0 rounded-lg bg-blue-600 px-2 py-1 text-xs font-medium text-white disabled:opacity-60"
                        >
                          {wordActionIds.has(word.id) ? "..." : "Добавить"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <section className="space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-gray-900">Слова в наборе</p>
                  <span className="text-xs text-gray-500">{collectionWords.length}</span>
                </div>

                <input
                  value={collectionWordsQuery}
                  onChange={(event) => setCollectionWordsQuery(event.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm"
                  placeholder="Поиск слова в наборе"
                />

                {isCollectionWordsLoading ? <p className="text-xs text-gray-600">Загрузка слов набора...</p> : null}

                {!isCollectionWordsLoading && collectionWords.length === 0 ? (
                  <p className="text-xs text-gray-600">Слова не найдены для текущего фильтра.</p>
                ) : null}

                {collectionWords.length > 0 ? (
                  <div className="max-h-56 space-y-2 overflow-auto rounded-lg border border-gray-200 bg-white p-2">
                    {collectionWords.map((word) => (
                      <div key={word.id} className="flex items-start justify-between gap-2 rounded-lg border border-gray-100 p-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {word.lemma} — {word.translation}
                          </p>
                          <p className="truncate text-xs text-gray-500">
                            {word.transcription ?? "—"}
                            {word.partOfSpeech ? ` · ${word.partOfSpeech}` : ""}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            void removeWordFromCollection(word.id);
                          }}
                          disabled={wordActionIds.has(word.id)}
                          className="shrink-0 rounded-lg border border-red-300 px-2 py-1 text-xs font-medium text-red-700 disabled:opacity-60"
                        >
                          {wordActionIds.has(word.id) ? "..." : "Удалить"}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>

              <div className="grid grid-cols-2 gap-2">
                <input
                  value={editSortOrder}
                  onChange={(event) => setEditSortOrder(event.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Порядок сортировки"
                />

                <label className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={isPublic}
                    onChange={(event) => setIsPublic(event.target.checked)}
                  />
                  Опубликован
                </label>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => void saveCollection()}
                  disabled={isSaving}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white disabled:opacity-60"
                >
                  {isSaving ? "Сохранение..." : "Сохранить"}
                </button>
                <button
                  type="button"
                  onClick={() => void deleteCollection()}
                  disabled={isDeleting}
                  className="rounded-lg border border-red-400 px-3 py-2 text-sm font-medium text-red-700 disabled:opacity-60"
                >
                  {isDeleting ? "Удаление..." : "Удалить"}
                </button>
              </div>
            </>
          ) : null}
        </div>
      </div>
    </section>
  );
}
