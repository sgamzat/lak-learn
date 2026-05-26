"use client";

import { useEffect, useMemo, useState } from "react";
import { getStudySelection, setStudySelection } from "@/lib/api/client";

type DictionaryWord = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  partOfSpeech: string | null;
  level: string | null;
  popularityScore: number | null;
};

type DictionaryResponse = {
  words: DictionaryWord[];
};

type CollectionCard = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  coverUrl: string | null;
  sortOrder: number;
  ruleTagCodes: string[];
  wordCount: number;
};

type CollectionsResponse = {
  collections: CollectionCard[];
};

type LoadState = "loading" | "success" | "error";

export default function DictionaryPage() {
  const [allWords, setAllWords] = useState<DictionaryWord[]>([]);
  const [words, setWords] = useState<DictionaryWord[]>([]);
  const [collections, setCollections] = useState<CollectionCard[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);
  const [activeCollectionView, setActiveCollectionView] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedWordIds, setSelectedWordIds] = useState<Set<number>>(new Set());
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<number>>(new Set());
  const [pendingWordIds, setPendingWordIds] = useState<Set<number>>(new Set());
  const [pendingCollectionIds, setPendingCollectionIds] = useState<Set<number>>(new Set());

  const loadWords = async (collectionId?: number | null) => {
    const params = new URLSearchParams();
    params.set("limit", "1000");

    if (collectionId) {
      params.set("collectionId", String(collectionId));
    }

    const response = await fetch(`/api/words?${params.toString()}`, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      cache: "no-store"
    });

    if (!response.ok) {
      throw new Error(`Request failed: ${response.status}`);
    }

    const payload = (await response.json()) as DictionaryResponse;
    return Array.isArray(payload.words) ? payload.words : [];
  };

  useEffect(() => {
    let mounted = true;

    const loadInitialData = async () => {
      try {
        const [collectionsResponse, wordsData, studySelection] = await Promise.all([
          fetch("/api/collections", {
            method: "GET",
            headers: {
              Accept: "application/json"
            },
            cache: "no-store"
          }),
          loadWords(null),
          getStudySelection()
        ]);

        if (!collectionsResponse.ok) {
          throw new Error(`Request failed: ${collectionsResponse.status}`);
        }

        const collectionsPayload = (await collectionsResponse.json()) as CollectionsResponse;
        const nextCollections = Array.isArray(collectionsPayload.collections) ? collectionsPayload.collections : [];

        if (!mounted) {
          return;
        }

        setCollections(nextCollections);
        setAllWords(wordsData);
        setWords(wordsData);
        setSelectedWordIds(new Set(studySelection.wordIds));
        setSelectedCollectionIds(new Set(studySelection.collectionIds));
        setState("success");
        setHasLoadedInitialData(true);
      } catch {
        if (mounted) {
          setState("error");
        }
      }
    };

    void loadInitialData();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedInitialData) {
      return;
    }

    let mounted = true;

    const reloadByCollectionView = async () => {
      if (!activeCollectionView) {
        setWords(allWords);
        setState("success");
        return;
      }

      setState("loading");

      try {
        const nextWords = await loadWords(activeCollectionView);

        if (!mounted) {
          return;
        }

        setWords(nextWords);
        setState("success");
      } catch {
        if (mounted) {
          setState("error");
        }
      }
    };

    void reloadByCollectionView();

    return () => {
      mounted = false;
    };
  }, [activeCollectionView, allWords, hasLoadedInitialData]);

  const toggleWordSelection = async (wordId: number) => {
    if (pendingWordIds.has(wordId)) {
      return;
    }

    const isSelected = selectedWordIds.has(wordId);
    const optimistic = new Set(selectedWordIds);

    if (isSelected) {
      optimistic.delete(wordId);
    } else {
      optimistic.add(wordId);
    }

    setSelectedWordIds(optimistic);
    setPendingWordIds((prev) => new Set(prev).add(wordId));

    try {
      const response = await setStudySelection("word", wordId, !isSelected);
      setSelectedWordIds(new Set(response.wordIds));
      setSelectedCollectionIds(new Set(response.collectionIds));
    } catch {
      setSelectedWordIds(new Set(selectedWordIds));
    } finally {
      setPendingWordIds((prev) => {
        const next = new Set(prev);
        next.delete(wordId);
        return next;
      });
    }
  };

  const toggleCollectionSelection = async (collectionId: number) => {
    if (pendingCollectionIds.has(collectionId)) {
      return;
    }

    const isSelected = selectedCollectionIds.has(collectionId);
    const optimistic = new Set(selectedCollectionIds);

    if (isSelected) {
      optimistic.delete(collectionId);
    } else {
      optimistic.add(collectionId);
    }

    setSelectedCollectionIds(optimistic);
    setPendingCollectionIds((prev) => new Set(prev).add(collectionId));

    try {
      const response = await setStudySelection("collection", collectionId, !isSelected);
      setSelectedWordIds(new Set(response.wordIds));
      setSelectedCollectionIds(new Set(response.collectionIds));
    } catch {
      setSelectedCollectionIds(new Set(selectedCollectionIds));
    } finally {
      setPendingCollectionIds((prev) => {
        const next = new Set(prev);
        next.delete(collectionId);
        return next;
      });
    }
  };

  const selectedCollections = collections.filter((collection) => selectedCollectionIds.has(collection.id));
  const activeCollectionTitle = activeCollectionView
    ? collections.find((collection) => collection.id === activeCollectionView)?.title ?? "Выбранный набор"
    : "Все слова";

  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const searchResults = useMemo(() => {
    if (!normalizedSearchQuery) {
      return [];
    }

    return allWords.filter((word) => {
      const lemma = word.lemma.toLocaleLowerCase();
      const translation = word.translation.toLocaleLowerCase();
      return lemma.includes(normalizedSearchQuery) || translation.includes(normalizedSearchQuery);
    });
  }, [allWords, normalizedSearchQuery]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <h1 className="text-2xl font-bold">Словарь</h1>

        <section className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <h2 className="text-sm font-semibold text-blue-900">Быстрый перевод</h2>
          <p className="mt-1 text-xs text-blue-900/80">Введите слово на лакском или русском языке для мгновенного поиска.</p>

          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Например: гьалмахчу или товарищ"
            className="mt-3 w-full rounded-xl border border-blue-300 bg-white px-4 py-3 text-sm text-gray-900 outline-none ring-blue-300 placeholder:text-gray-400 focus:ring"
          />

          {normalizedSearchQuery ? (
            <p className="mt-2 text-xs text-blue-900/80">
              Найдено: <span className="font-semibold text-blue-900">{searchResults.length}</span>
            </p>
          ) : null}

          {normalizedSearchQuery && searchResults.length > 0 ? (
            <div className="mt-3 overflow-x-auto rounded-xl border border-blue-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-blue-100 text-blue-900/80">
                    <th className="py-2 pr-4 pl-3 font-medium">Слово</th>
                    <th className="py-2 pr-4 font-medium">Перевод</th>
                    <th className="py-2 pr-4 font-medium">Транскрипция</th>
                  </tr>
                </thead>
                <tbody>
                  {searchResults.map((word) => (
                    <tr key={`search-${word.id}`} className="border-b border-blue-50 text-gray-700 last:border-b-0">
                      <td className="py-2 pr-4 pl-3 font-medium text-gray-900">{word.lemma}</td>
                      <td className="py-2 pr-4">{word.translation}</td>
                      <td className="py-2 pr-4">{word.transcription ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {normalizedSearchQuery && searchResults.length === 0 ? (
            <p className="mt-3 rounded-lg border border-blue-200 bg-white p-3 text-sm text-blue-900">
              По запросу ничего не найдено. Проверьте написание слова и попробуйте другой вариант.
            </p>
          ) : null}
        </section>

        <section className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Наборы слов</h2>
            <button
              type="button"
              disabled
              title="Скоро появится создание пользовательских наборов"
              className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-500 opacity-90"
            >
              Создать набор
            </button>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <button
              type="button"
              onClick={() => setActiveCollectionView(null)}
              className={
                !activeCollectionView
                  ? "rounded-xl border border-blue-500 bg-blue-50 p-3 text-left"
                  : "rounded-xl border border-gray-200 bg-white p-3 text-left hover:bg-gray-50"
              }
            >
              <p className="font-medium text-gray-900">Все слова</p>
              <p className="mt-1 text-xs text-gray-500">Слов: {allWords.length}</p>
            </button>

            {collections.map((collection) => {
              const isActive = activeCollectionView === collection.id;

              return (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => setActiveCollectionView(collection.id)}
                  className={
                    isActive
                      ? "rounded-xl border border-blue-500 bg-blue-50 p-3 text-left"
                      : "rounded-xl border border-gray-200 bg-white p-3 text-left hover:bg-gray-50"
                  }
                >
                  <p className="font-medium text-gray-900">{collection.title}</p>
                  <p className="mt-1 text-xs text-gray-500">Слов: {collection.wordCount}</p>
                  {collection.description ? <p className="mt-1 text-xs text-gray-600">{collection.description}</p> : null}
                  <label
                    className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs text-gray-700"
                    onClick={(event) => event.stopPropagation()}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCollectionIds.has(collection.id)}
                      disabled={pendingCollectionIds.has(collection.id)}
                      onChange={() => {
                        void toggleCollectionSelection(collection.id);
                      }}
                    />
                    Изучать набор
                  </label>
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-blue-900">Мои выбранные наборы</h2>
            <span className="rounded-full bg-white px-2 py-1 text-xs font-medium text-blue-700">{selectedCollections.length}</span>
          </div>

          {selectedCollections.length === 0 ? (
            <p className="mt-2 text-sm text-blue-900/80">Пока нет выбранных наборов. Отметьте нужные наборы в каталоге выше.</p>
          ) : (
            <div className="mt-3 flex flex-wrap gap-2">
              {selectedCollections.map((collection) => (
                <button
                  key={collection.id}
                  type="button"
                  onClick={() => {
                    void toggleCollectionSelection(collection.id);
                  }}
                  disabled={pendingCollectionIds.has(collection.id)}
                  className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm text-blue-900 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <span className="font-medium">{collection.title}</span>
                  <span className="text-xs text-blue-700">Убрать</span>
                </button>
              ))}
            </div>
          )}
        </section>

        {state === "loading" ? <p className="mt-3 text-sm text-gray-600">Загрузка слов...</p> : null}

        {state === "error" ? (
          <p className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            Не удалось загрузить словарь. Обновите страницу.
          </p>
        ) : null}

        {state === "success" && words.length === 0 ? (
          <p className="mt-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            {activeCollectionView ? "В выбранном наборе пока нет слов." : "Список слов пуст."}
          </p>
        ) : null}

        {state === "success" && words.length > 0 ? (
          <section className="mt-4">
            <div className="mb-2 flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-gray-900">Список слов: {activeCollectionTitle}</h2>
              <span className="text-xs text-gray-500">{words.length} слов</span>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-200 text-gray-500">
                    <th className="py-2 pr-4 font-medium">Слово</th>
                    <th className="py-2 pr-4 font-medium">Перевод</th>
                    <th className="py-2 pr-4 font-medium">Транскрипция</th>
                    <th className="py-2 pr-4 font-medium">Часть речи</th>
                    <th className="py-2 pr-4 font-medium">Уровень</th>
                    <th className="py-2 font-medium">Популярность</th>
                    <th className="py-2 pl-3 font-medium">Изучение</th>
                  </tr>
                </thead>
                <tbody>
                  {words.map((word) => (
                    <tr key={word.id} className="border-b border-gray-100 text-gray-700">
                      <td className="py-2 pr-4 font-medium text-gray-900">{word.lemma}</td>
                      <td className="py-2 pr-4">{word.translation}</td>
                      <td className="py-2 pr-4">{word.transcription ?? "—"}</td>
                      <td className="py-2 pr-4">{word.partOfSpeech ?? "—"}</td>
                      <td className="py-2 pr-4">{word.level ?? "—"}</td>
                      <td className="py-2">{word.popularityScore ?? "—"}</td>
                      <td className="py-2 pl-3">
                        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 text-xs">
                          <input
                            type="checkbox"
                            checked={selectedWordIds.has(word.id)}
                            disabled={pendingWordIds.has(word.id)}
                            onChange={() => {
                              void toggleWordSelection(word.id);
                            }}
                          />
                          Изучать
                        </label>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ) : null}
      </section>
    </div>
  );
}

