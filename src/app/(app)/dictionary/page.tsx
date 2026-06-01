"use client";

import { useEffect, useMemo, useState } from "react";
import { getStudySelection, setStudySelection } from "@/lib/api/client";

// ─── Типы ─────────────────────────────────────────────────────────────────────

type DictionaryWord = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  partOfSpeech: string | null;
  level: string | null;
  popularityScore: number | null;
};

type CollectionCard = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  wordCount: number;
  sortOrder: number;
};

type LoadState = "loading" | "success" | "error";

// Уровни освоения слова на основе popularityScore
function getMasteryLabel(score: number | null): { label: string; color: string } | null {
  if (score === null) return null;
  if (score <= 1) return { label: "Новое", color: "bg-gray-100 text-gray-500" };
  if (score <= 3) return { label: "Знакомое", color: "bg-blue-100 text-blue-700" };
  if (score <= 6) return { label: "Изучаемое", color: "bg-amber-100 text-amber-700" };
  return { label: "Освоено", color: "bg-green-100 text-green-700" };
}

// ─── Компонент ────────────────────────────────────────────────────────────────

export default function DictionaryPage() {
  const [allWords, setAllWords] = useState<DictionaryWord[]>([]);
  const [words, setWords] = useState<DictionaryWord[]>([]);
  const [collections, setCollections] = useState<CollectionCard[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const [hasLoadedInitialData, setHasLoadedInitialData] = useState(false);

  const [activeCollectionView, setActiveCollectionView] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPartOfSpeech, setFilterPartOfSpeech] = useState<string>("all");
  const [sortBy, setSortBy] = useState<"default" | "az" | "za">("default");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");

  const [selectedWordIds, setSelectedWordIds] = useState<Set<number>>(new Set());
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<number>>(new Set());
  const [pendingWordIds, setPendingWordIds] = useState<Set<number>>(new Set());
  const [pendingCollectionIds, setPendingCollectionIds] = useState<Set<number>>(new Set());

  // Загрузка слов
  const loadWords = async (collectionId?: number | null) => {
    const params = new URLSearchParams();
    params.set("limit", "1000");
    if (collectionId) params.set("collectionId", String(collectionId));

    const response = await fetch(`/api/words?${params.toString()}`, {
      method: "GET",
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`Request failed: ${response.status}`);
    const payload = (await response.json()) as { words: DictionaryWord[] };
    return Array.isArray(payload.words) ? payload.words : [];
  };

  useEffect(() => {
    let mounted = true;
    const loadInitialData = async () => {
      try {
        const [collectionsResponse, wordsData, studySelection] = await Promise.all([
          fetch("/api/collections", { method: "GET", headers: { Accept: "application/json" }, cache: "no-store" }),
          loadWords(null),
          getStudySelection(),
        ]);
        if (!collectionsResponse.ok) throw new Error(`Request failed: ${collectionsResponse.status}`);
        const collectionsPayload = (await collectionsResponse.json()) as { collections: CollectionCard[] };
        const nextCollections = Array.isArray(collectionsPayload.collections) ? collectionsPayload.collections : [];
        if (mounted) {
          setCollections(nextCollections);
          setAllWords(wordsData);
          setWords(wordsData);
          setSelectedWordIds(new Set(studySelection.wordIds));
          setSelectedCollectionIds(new Set(studySelection.collectionIds));
          setState("success");
          setHasLoadedInitialData(true);
        }
      } catch {
        if (mounted) setState("error");
      }
    };
    void loadInitialData();
    return () => { mounted = false; };
  }, []);

  // Переключение коллекций
  const handleCollectionView = async (collectionId: number | null) => {
    setActiveCollectionView(collectionId);
    setState("loading");
    try {
      const nextWords = await loadWords(collectionId);
      setWords(nextWords);
      setState("success");
    } catch {
      setState("error");
    }
  };

  // Добавление/удаление слова в учёбу
  const handleToggleWord = async (wordId: number) => {
    if (pendingWordIds.has(wordId)) return;
    const isSelected = selectedWordIds.has(wordId);
    const optimistic = new Set(selectedWordIds);
    if (isSelected) optimistic.delete(wordId); else optimistic.add(wordId);
    setSelectedWordIds(optimistic);
    setPendingWordIds((prev) => new Set(prev).add(wordId));
    try {
      const response = await setStudySelection("word", wordId, !isSelected);
      setSelectedWordIds(new Set(response.wordIds));
      setSelectedCollectionIds(new Set(response.collectionIds));
    } catch {
      setSelectedWordIds(new Set(selectedWordIds));
    } finally {
      setPendingWordIds((prev) => { const next = new Set(prev); next.delete(wordId); return next; });
    }
  };

  // Добавление/удаление коллекции в учёбу
  const handleToggleCollection = async (collectionId: number) => {
    if (pendingCollectionIds.has(collectionId)) return;
    const isSelected = selectedCollectionIds.has(collectionId);
    const optimistic = new Set(selectedCollectionIds);
    if (isSelected) optimistic.delete(collectionId); else optimistic.add(collectionId);
    setSelectedCollectionIds(optimistic);
    setPendingCollectionIds((prev) => new Set(prev).add(collectionId));
    try {
      const response = await setStudySelection("collection", collectionId, !isSelected);
      setSelectedWordIds(new Set(response.wordIds));
      setSelectedCollectionIds(new Set(response.collectionIds));
    } catch {
      setSelectedCollectionIds(new Set(selectedCollectionIds));
    } finally {
      setPendingCollectionIds((prev) => { const next = new Set(prev); next.delete(collectionId); return next; });
    }
  };

  // Уникальные части речи для фильтра
  const partsOfSpeech = useMemo(() => {
    const set = new Set<string>();
    words.forEach((w) => { if (w.partOfSpeech) set.add(w.partOfSpeech); });
    return Array.from(set).sort();
  }, [words]);

  // Поиск, фильтр, сортировка
  const normalizedQuery = searchQuery.trim().toLowerCase();

  const displayedWords = useMemo(() => {
    let result = words;

    if (normalizedQuery) {
      result = result.filter(
        (w) =>
          w.lemma.toLowerCase().includes(normalizedQuery) ||
          w.translation.toLowerCase().includes(normalizedQuery) ||
          (w.transcription?.toLowerCase().includes(normalizedQuery) ?? false)
      );
    }

    if (filterPartOfSpeech !== "all") {
      result = result.filter((w) => w.partOfSpeech === filterPartOfSpeech);
    }

    if (sortBy === "az") result = [...result].sort((a, b) => a.lemma.localeCompare(b.lemma));
    if (sortBy === "za") result = [...result].sort((a, b) => b.lemma.localeCompare(a.lemma));

    return result;
  }, [words, normalizedQuery, filterPartOfSpeech, sortBy]);

  const activeCollectionTitle = activeCollectionView
    ? (collections.find((c) => c.id === activeCollectionView)?.title ?? "Набор")
    : "Все слова";

  const selectedCollections = collections.filter((c) => selectedCollectionIds.has(c.id));

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 space-y-5">

      {/* Заголовок */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Словарь</h1>
            {hasLoadedInitialData && (
              <p className="mt-1 text-sm text-gray-500">
                {allWords.length} слов · {selectedWordIds.size} в изучении
              </p>
            )}
          </div>
          {/* Переключение вида */}
          <div className="flex items-center gap-1 rounded-xl border border-gray-200 p-1">
            <button
              type="button"
              onClick={() => setViewMode("table")}
              className={["rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", viewMode === "table" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-800"].join(" ")}
            >
              Таблица
            </button>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              className={["rounded-lg px-3 py-1.5 text-sm font-medium transition-colors", viewMode === "cards" ? "bg-gray-900 text-white" : "text-gray-500 hover:text-gray-800"].join(" ")}
            >
              Карточки
            </button>
          </div>
        </div>
      </section>

      {/* Быстрый перевод */}
      <section className="rounded-2xl border border-blue-200 bg-blue-50 p-5">
        <h2 className="text-sm font-semibold text-blue-900">Быстрый перевод</h2>
        <p className="mt-0.5 text-xs text-blue-700">Введите слово на лакском или русском</p>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Например: гьалмахчу или товарищ"
          className="mt-3 w-full rounded-xl border border-blue-200 bg-white px-4 py-3 text-sm text-gray-900 outline-none ring-blue-300 placeholder:text-gray-400 focus:ring-2"
        />
        {normalizedQuery && (
          <p className="mt-2 text-xs text-blue-700">
            Найдено: <span className="font-semibold">{displayedWords.length}</span> из {words.length}
          </p>
        )}
      </section>

      {/* Выбранные коллекции */}
      {selectedCollections.length > 0 && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <h2 className="text-sm font-semibold text-emerald-800">Изучаемые наборы</h2>
          <div className="mt-2 flex flex-wrap gap-2">
            {selectedCollections.map((c) => (
              <div key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-white px-3 py-1 text-xs font-medium text-emerald-800">
                {c.title}
                <span className="text-emerald-500">{c.wordCount}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="grid gap-5 lg:grid-cols-[300px_1fr]">

        {/* Левая панель: Наборы слов */}
        <aside className="space-y-3">
          <section className="rounded-2xl border border-gray-200 bg-white p-4">
            <h2 className="text-sm font-semibold text-gray-900">Наборы слов</h2>
            <div className="mt-3 space-y-1.5">

              {/* Все слова */}
              <button
                type="button"
                onClick={() => handleCollectionView(null)}
                className={[
                  "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
                  !activeCollectionView
                    ? "bg-gray-900 text-white"
                    : "text-gray-700 hover:bg-gray-50",
                ].join(" ")}
              >
                <span className="font-medium">Все слова</span>
                <span className={["rounded-full px-2 py-0.5 text-xs font-semibold", !activeCollectionView ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500"].join(" ")}>
                  {allWords.length}
                </span>
              </button>

              {/* Коллекции */}
              {collections.map((collection) => {
                const isActive = activeCollectionView === collection.id;
                const isStudying = selectedCollectionIds.has(collection.id);
                const isPending = pendingCollectionIds.has(collection.id);
                return (
                  <div key={collection.id} className={["group flex items-center gap-1 rounded-xl transition-colors", isActive ? "bg-blue-50" : "hover:bg-gray-50"].join(" ")}>
                    <button
                      type="button"
                      onClick={() => handleCollectionView(collection.id)}
                      className="flex flex-1 items-center justify-between px-3 py-2.5 text-left text-sm"
                    >
                      <span className={["font-medium truncate", isActive ? "text-blue-800" : "text-gray-700"].join(" ")}>
                        {collection.title}
                      </span>
                      <span className={["ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold", isActive ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"].join(" ")}>
                        {collection.wordCount}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleToggleCollection(collection.id)}
                      disabled={isPending}
                      title={isStudying ? "Убрать из изучения" : "Добавить в изучение"}
                      className={[
                        "mr-2 shrink-0 rounded-lg border px-2 py-1 text-xs font-medium transition-colors disabled:opacity-50",
                        isStudying
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                          : "border-gray-200 bg-white text-gray-400 opacity-0 group-hover:opacity-100 hover:text-gray-700",
                      ].join(" ")}
                    >
                      {isPending ? "..." : isStudying ? "✓" : "+"}
                    </button>
                  </div>
                );
              })}

              {state === "loading" && !hasLoadedInitialData && (
                <div className="space-y-2 px-1 pt-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-10 animate-pulse rounded-xl bg-gray-100" />
                  ))}
                </div>
              )}
            </div>
          </section>
        </aside>

        {/* Правая панель: Список слов */}
        <main className="space-y-3">

          {/* Фильтры */}
          <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-gray-200 bg-white p-3">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Фильтр:</span>

            <select
              value={filterPartOfSpeech}
              onChange={(e) => setFilterPartOfSpeech(e.target.value)}
              className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="all">Все части речи</option>
              {partsOfSpeech.map((pos) => (
                <option key={pos} value={pos}>{pos}</option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as "default" | "az" | "za")}
              className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-blue-300"
            >
              <option value="default">По умолчанию</option>
              <option value="az">А → Я</option>
              <option value="za">Я → А</option>
            </select>

            <div className="ml-auto text-xs text-gray-400">
              {state === "success" ? (
                <span>
                  {activeCollectionTitle} · <span className="font-semibold text-gray-700">{displayedWords.length}</span> слов
                </span>
              ) : null}
            </div>
          </div>

          {/* Ошибка */}
          {state === "error" && (
            <p className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Не удалось загрузить словарь. Обновите страницу.
            </p>
          )}

          {/* Загрузка */}
          {state === "loading" && (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          )}

          {/* Пусто */}
          {state === "success" && displayedWords.length === 0 && (
            <p className="rounded-xl border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
              {normalizedQuery
                ? `По запросу «${searchQuery}» ничего не найдено`
                : activeCollectionView
                ? "В выбранном наборе пока нет слов"
                : "Словарь пуст"}
            </p>
          )}

          {/* РЕЖИМ: ТАБЛИЦА */}
          {state === "success" && displayedWords.length > 0 && viewMode === "table" && (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-400">
                    <th className="py-3 pl-4 pr-4 font-medium">Слово</th>
                    <th className="py-3 pr-4 font-medium">Перевод</th>
                    <th className="py-3 pr-4 font-medium">Транскрипция</th>
                    <th className="py-3 pr-4 font-medium">Часть речи</th>
                    <th className="py-3 pr-4 font-medium">Уровень</th>
                    <th className="py-3 pr-4 font-medium">Прогресс</th>
                    <th className="py-3 pr-4 font-medium">Изучение</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {displayedWords.map((word) => {
                    const isSelected = selectedWordIds.has(word.id);
                    const isPending = pendingWordIds.has(word.id);
                    const mastery = getMasteryLabel(word.popularityScore);
                    return (
                      <tr key={word.id} className={["transition-colors hover:bg-gray-50", isSelected ? "bg-emerald-50/30" : ""].join(" ")}>
                        <td className="py-3 pl-4 pr-4 font-semibold text-gray-900">{word.lemma}</td>
                        <td className="py-3 pr-4 text-gray-600">{word.translation}</td>
                        <td className="py-3 pr-4 font-mono text-xs text-gray-400">{word.transcription ?? "—"}</td>
                        <td className="py-3 pr-4">
                          {word.partOfSpeech ? (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{word.partOfSpeech}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 pr-4">
                          {word.level ? (
                            <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">{word.level}</span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 pr-4">
                          {mastery ? (
                            <span className={["rounded-full px-2 py-0.5 text-xs font-medium", mastery.color].join(" ")}>
                              {mastery.label}
                            </span>
                          ) : <span className="text-gray-300">—</span>}
                        </td>
                        <td className="py-3 pr-4">
                          <button
                            type="button"
                            onClick={() => void handleToggleWord(word.id)}
                            disabled={isPending}
                            className={[
                              "min-h-8 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60",
                              isSelected
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                                : "border-gray-200 bg-white text-gray-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700",
                            ].join(" ")}
                          >
                            {isPending ? "..." : isSelected ? "Учу ✓" : "+ Учить"}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* РЕЖИМ: КАРТОЧКИ */}
          {state === "success" && displayedWords.length > 0 && viewMode === "cards" && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {displayedWords.map((word) => {
                const isSelected = selectedWordIds.has(word.id);
                const isPending = pendingWordIds.has(word.id);
                const mastery = getMasteryLabel(word.popularityScore);
                return (
                  <div
                    key={word.id}
                    className={[
                      "group flex flex-col justify-between rounded-2xl border p-4 transition-shadow hover:shadow-sm",
                      isSelected ? "border-emerald-200 bg-emerald-50/40" : "border-gray-200 bg-white",
                    ].join(" ")}
                  >
                    <div>
                      <p className="text-lg font-bold text-gray-900">{word.lemma}</p>
                      <p className="mt-0.5 text-sm text-gray-600">{word.translation}</p>
                      {word.transcription && (
                        <p className="mt-1 font-mono text-xs text-gray-400">{word.transcription}</p>
                      )}
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-2">
                      <div className="flex flex-wrap gap-1.5">
                        {word.partOfSpeech && (
                          <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">{word.partOfSpeech}</span>
                        )}
                        {mastery && (
                          <span className={["rounded-full px-2 py-0.5 text-xs font-medium", mastery.color].join(" ")}>
                            {mastery.label}
                          </span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleToggleWord(word.id)}
                        disabled={isPending}
                        className={[
                          "shrink-0 rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-60",
                          isSelected
                            ? "border-emerald-200 bg-white text-emerald-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                            : "border-gray-200 bg-white text-gray-400 hover:border-blue-200 hover:text-blue-700",
                        ].join(" ")}
                      >
                        {isPending ? "..." : isSelected ? "✓" : "+"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    </div>
  );
}