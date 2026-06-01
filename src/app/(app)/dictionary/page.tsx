"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStudySelection, setStudySelection } from "@/lib/api/client";
import { Search, SlidersHorizontal, LayoutGrid, List, Check, Plus } from "lucide-react";

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

// Прогресс освоения слова
function getMastery(score: number | null): {
  label: string;
  dot: string;
} | null {
  if (score === null) return null;
  if (score <= 1) return { label: "Новое",      dot: "bg-gray-300" };
  if (score <= 3) return { label: "Знакомое",   dot: "bg-blue-400" };
  if (score <= 6) return { label: "Изучаемое",  dot: "bg-amber-400" };
  return             { label: "Освоено",     dot: "bg-green-500" };
}

// ─── Компонент ────────────────────────────────────────────────────────────────

export default function DictionaryPage() {
  const [allWords, setAllWords]           = useState<DictionaryWord[]>([]);
  const [words, setWords]                 = useState<DictionaryWord[]>([]);
  const [collections, setCollections]     = useState<CollectionCard[]>([]);
  const [state, setState]                 = useState<LoadState>("loading");
  const [hasLoaded, setHasLoaded]         = useState(false);

  const [activeCollectionView, setActiveCollectionView] = useState<number | null>(null);
  const [searchQuery, setSearchQuery]     = useState("");
  const [filterPos, setFilterPos]         = useState<string>("all");
  const [sortBy, setSortBy]               = useState<"default" | "az" | "za">("default");
  const [viewMode, setViewMode]           = useState<"table" | "cards">("table");
  const [showFilters, setShowFilters]     = useState(false);

  const [selectedWordIds, setSelectedWordIds]         = useState<Set<number>>(new Set());
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<number>>(new Set());
  const [pendingWordIds, setPendingWordIds]             = useState<Set<number>>(new Set());
  const [pendingCollectionIds, setPendingCollectionIds] = useState<Set<number>>(new Set());

  const searchRef = useRef<HTMLInputElement>(null);

  // ── Загрузка слов ──────────────────────────────────────────────────────────
  const loadWords = async (collectionId?: number | null) => {
    const params = new URLSearchParams();
    params.set("limit", "1000");
    if (collectionId) params.set("collectionId", String(collectionId));
    const res = await fetch(`/api/words?${params}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = (await res.json()) as { words: DictionaryWord[] };
    return Array.isArray(data.words) ? data.words : [];
  };

  useEffect(() => {
    let mounted = true;
    const init = async () => {
      try {
        const [colRes, wordsData, study] = await Promise.all([
          fetch("/api/collections", { headers: { Accept: "application/json" }, cache: "no-store" }),
          loadWords(null),
          getStudySelection(),
        ]);
        if (!colRes.ok) throw new Error(`${colRes.status}`);
        const colData = (await colRes.json()) as { collections: CollectionCard[] };
        if (mounted) {
          setCollections(Array.isArray(colData.collections) ? colData.collections : []);
          setAllWords(wordsData);
          setWords(wordsData);
          setSelectedWordIds(new Set(study.wordIds));
          setSelectedCollectionIds(new Set(study.collectionIds));
          setState("success");
          setHasLoaded(true);
        }
      } catch {
        if (mounted) setState("error");
      }
    };
    void init();
    return () => { mounted = false; };
  }, []);

  // ── Переключение коллекции ─────────────────────────────────────────────────
  const handleCollectionView = async (id: number | null) => {
    setActiveCollectionView(id);
    setState("loading");
    try {
      setWords(await loadWords(id));
      setState("success");
    } catch {
      setState("error");
    }
  };

  // ── Добавить/убрать слово ──────────────────────────────────────────────────
  const handleToggleWord = async (wordId: number) => {
    if (pendingWordIds.has(wordId)) return;
    const isSelected = selectedWordIds.has(wordId);
    const next = new Set(selectedWordIds);
    isSelected ? next.delete(wordId) : next.add(wordId);
    setSelectedWordIds(next);
    setPendingWordIds(p => new Set(p).add(wordId));
    try {
      const res = await setStudySelection("word", wordId, !isSelected);
      setSelectedWordIds(new Set(res.wordIds));
      setSelectedCollectionIds(new Set(res.collectionIds));
    } catch {
      setSelectedWordIds(new Set(selectedWordIds));
    } finally {
      setPendingWordIds(p => { const n = new Set(p); n.delete(wordId); return n; });
    }
  };

  // ── Добавить/убрать коллекцию ──────────────────────────────────────────────
  const handleToggleCollection = async (colId: number) => {
    if (pendingCollectionIds.has(colId)) return;
    const isSelected = selectedCollectionIds.has(colId);
    const next = new Set(selectedCollectionIds);
    isSelected ? next.delete(colId) : next.add(colId);
    setSelectedCollectionIds(next);
    setPendingCollectionIds(p => new Set(p).add(colId));
    try {
      const res = await setStudySelection("collection", colId, !isSelected);
      setSelectedWordIds(new Set(res.wordIds));
      setSelectedCollectionIds(new Set(res.collectionIds));
    } catch {
      setSelectedCollectionIds(new Set(selectedCollectionIds));
    } finally {
      setPendingCollectionIds(p => { const n = new Set(p); n.delete(colId); return n; });
    }
  };

  // ── Части речи для фильтра ─────────────────────────────────────────────────
  const partsOfSpeech = useMemo(() => {
    const s = new Set<string>();
    words.forEach(w => { if (w.partOfSpeech) s.add(w.partOfSpeech); });
    return Array.from(s).sort();
  }, [words]);

  // ── Фильтрация + сортировка ────────────────────────────────────────────────
  const q = searchQuery.trim().toLowerCase();
  const displayedWords = useMemo(() => {
    let r = words;
    if (q) {
      r = r.filter(w =>
        w.lemma.toLowerCase().includes(q) ||
        w.translation.toLowerCase().includes(q) ||
        (w.transcription?.toLowerCase().includes(q) ?? false)
      );
    }
    if (filterPos !== "all") r = r.filter(w => w.partOfSpeech === filterPos);
    if (sortBy === "az") r = [...r].sort((a, b) => a.lemma.localeCompare(b.lemma));
    if (sortBy === "za") r = [...r].sort((a, b) => b.lemma.localeCompare(a.lemma));
    return r;
  }, [words, q, filterPos, sortBy]);

  const activeTitle = activeCollectionView
    ? (collections.find(c => c.id === activeCollectionView)?.title ?? "Набор")
    : "Все слова";

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="mx-auto max-w-7xl px-4 py-4 space-y-4">

      {/* ── ЗАГОЛОВОК + переключатель вида ──────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Словарь</h1>
          {hasLoaded && (
            <p className="mt-0.5 text-sm text-gray-400">
              {allWords.length} слов · {selectedWordIds.size} в изучении
            </p>
          )}
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
          <button
            type="button"
            onClick={() => setViewMode("table")}
            title="Таблица"
            className={[
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              viewMode === "table" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-700",
            ].join(" ")}
          >
            <List className="h-4 w-4" />
            <span className="hidden sm:inline">Таблица</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode("cards")}
            title="Карточки"
            className={[
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
              viewMode === "cards" ? "bg-gray-900 text-white" : "text-gray-400 hover:text-gray-700",
            ].join(" ")}
          >
            <LayoutGrid className="h-4 w-4" />
            <span className="hidden sm:inline">Карточки</span>
          </button>
        </div>
      </div>

      {/* ── КОЛЛЕКЦИИ — горизонтальный скролл на мобильном ─────────────── */}
      <div className="flex gap-2 overflow-x-auto pb-1 lg:hidden">
        <button
          type="button"
          onClick={() => void handleCollectionView(null)}
          className={[
            "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
            !activeCollectionView
              ? "border-gray-900 bg-gray-900 text-white"
              : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
          ].join(" ")}
        >
          Все слова
          <span className="ml-1.5 text-xs opacity-60">{allWords.length}</span>
        </button>
        {collections.map(col => (
          <button
            key={col.id}
            type="button"
            onClick={() => void handleCollectionView(col.id)}
            className={[
              "shrink-0 rounded-full border px-4 py-1.5 text-sm font-medium transition-colors",
              activeCollectionView === col.id
                ? "border-blue-600 bg-blue-600 text-white"
                : "border-gray-200 bg-white text-gray-600 hover:bg-gray-50",
            ].join(" ")}
          >
            {col.title}
            <span className="ml-1.5 text-xs opacity-60">{col.wordCount}</span>
          </button>
        ))}
      </div>

      {/* ── ОСНОВНАЯ СЕТКА ──────────────────────────────────────────────── */}
      <div className="flex gap-5">

        {/* ── Левая панель (только десктоп) ─────────────────────────────── */}
        <aside className="hidden w-64 shrink-0 space-y-1 lg:block">
          <p className="px-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
            Коллекции
          </p>

          {/* Все слова */}
          <button
            type="button"
            onClick={() => void handleCollectionView(null)}
            className={[
              "flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors",
              !activeCollectionView
                ? "bg-gray-900 font-medium text-white"
                : "text-gray-700 hover:bg-gray-100",
            ].join(" ")}
          >
            <span>Все слова</span>
            <span className={[
              "rounded-full px-2 py-0.5 text-xs",
              !activeCollectionView ? "bg-white/20 text-white" : "bg-gray-100 text-gray-500",
            ].join(" ")}>
              {allWords.length}
            </span>
          </button>

          {state === "loading" && !hasLoaded && (
            <div className="space-y-1 pt-1">
              {[1,2,3,4,5].map(i => (
                <div key={i} className="h-9 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          )}

          {collections.map(col => {
            const isActive   = activeCollectionView === col.id;
            const isStudying = selectedCollectionIds.has(col.id);
            const isPending  = pendingCollectionIds.has(col.id);
            return (
              <div
                key={col.id}
                className={[
                  "group flex items-center gap-1 rounded-xl transition-colors",
                  isActive ? "bg-blue-50" : "hover:bg-gray-50",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => void handleCollectionView(col.id)}
                  className="flex flex-1 items-center justify-between px-3 py-2.5 text-left text-sm"
                >
                  <span className={[
                    "truncate font-medium",
                    isActive ? "text-blue-800" : "text-gray-700",
                  ].join(" ")}>
                    {col.title}
                  </span>
                  <span className={[
                    "ml-2 shrink-0 rounded-full px-2 py-0.5 text-xs",
                    isActive ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500",
                  ].join(" ")}>
                    {col.wordCount}
                  </span>
                </button>

                {/* Кнопка добавления коллекции в изучение */}
                <button
                  type="button"
                  onClick={() => void handleToggleCollection(col.id)}
                  disabled={isPending}
                  title={isStudying ? "Убрать из изучения" : "Добавить в изучение"}
                  className={[
                    "mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border transition-all disabled:opacity-50",
                    isStudying
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                      : "border-gray-200 bg-white text-gray-400 opacity-0 group-hover:opacity-100",
                  ].join(" ")}
                >
                  {isPending ? (
                    <span className="text-[10px]">...</span>
                  ) : isStudying ? (
                    <Check className="h-3 w-3" />
                  ) : (
                    <Plus className="h-3 w-3" />
                  )}
                </button>
              </div>
            );
          })}
        </aside>

        {/* ── Правая панель: поиск + список ─────────────────────────────── */}
        <div className="min-w-0 flex-1 space-y-3">

          {/* Панель поиска и фильтров */}
          <div className="rounded-2xl border border-gray-200 bg-white p-3">
            <div className="flex gap-2">
              {/* Поиск */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  ref={searchRef}
                  type="text"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Поиск на лакском или русском..."
                  className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-4 text-sm text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-blue-300 focus:bg-white focus:ring-2 focus:ring-blue-100"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => { setSearchQuery(""); searchRef.current?.focus(); }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Кнопка фильтров */}
              <button
                type="button"
                onClick={() => setShowFilters(p => !p)}
                className={[
                  "flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition-colors",
                  showFilters || filterPos !== "all" || sortBy !== "default"
                    ? "border-blue-200 bg-blue-50 text-blue-700"
                    : "border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100",
                ].join(" ")}
              >
                <SlidersHorizontal className="h-4 w-4" />
                <span className="hidden sm:inline">Фильтры</span>
                {(filterPos !== "all" || sortBy !== "default") && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-blue-600 text-[10px] text-white">
                    {(filterPos !== "all" ? 1 : 0) + (sortBy !== "default" ? 1 : 0)}
                  </span>
                )}
              </button>
            </div>

            {/* Раскрывающиеся фильтры */}
            {showFilters && (
              <div className="mt-3 flex flex-wrap items-center gap-3 border-t border-gray-100 pt-3">
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500 whitespace-nowrap">Часть речи</label>
                  <select
                    value={filterPos}
                    onChange={e => setFilterPos(e.target.value)}
                    className="rounded-lg border border-gray-200 bg-gray-50 px-2 py-1.5 text-xs text-gray-700 outline-none focus:ring-2 focus:ring-blue-200"
                  >
                    <option value="all">Все</option>
                    {partsOfSpeech.map(pos => (
                      <option key={pos} value={pos}>{pos}</option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">Сортировка</label>
                  <div className="flex gap-1">
                    {([
                      { value: "default", label: "По умолч." },
                      { value: "az",      label: "А → Я" },
                      { value: "za",      label: "Я → А" },
                    ] as const).map(opt => (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setSortBy(opt.value)}
                        className={[
                          "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                          sortBy === opt.value
                            ? "border-gray-800 bg-gray-800 text-white"
                            : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50",
                        ].join(" ")}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </div>
                </div>

                {(filterPos !== "all" || sortBy !== "default") && (
                  <button
                    type="button"
                    onClick={() => { setFilterPos("all"); setSortBy("default"); }}
                    className="ml-auto text-xs text-gray-400 hover:text-gray-700"
                  >
                    Сбросить
                  </button>
                )}
              </div>
            )}

            {/* Строка статуса */}
            {state === "success" && (
              <div className="mt-2 flex items-center justify-between text-xs text-gray-400">
                <span>
                  {q ? (
                    <>
                      Найдено <span className="font-medium text-gray-700">{displayedWords.length}</span> из {words.length}
                    </>
                  ) : (
                    <>{activeTitle} · <span className="font-medium text-gray-700">{displayedWords.length}</span> слов</>
                  )}
                </span>
                {selectedWordIds.size > 0 && (
                  <span className="text-emerald-600">
                    {selectedWordIds.size} в изучении
                  </span>
                )}
              </div>
            )}
          </div>

          {/* Ошибка */}
          {state === "error" && (
            <p className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Не удалось загрузить словарь. Обновите страницу.
            </p>
          )}

          {/* Загрузка */}
          {state === "loading" && (
            <div className="space-y-2">
              {[1,2,3,4,5,6].map(i => (
                <div key={i} className="h-12 animate-pulse rounded-xl bg-gray-100" />
              ))}
            </div>
          )}

          {/* Пусто */}
          {state === "success" && displayedWords.length === 0 && (
            <div className="rounded-2xl border border-gray-200 bg-white p-10 text-center">
              <p className="text-2xl">🔍</p>
              <p className="mt-2 font-medium text-gray-700">
                {q ? `По запросу «${searchQuery}» ничего не найдено` : "Слов нет"}
              </p>
              {q && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-3 text-sm text-blue-600 hover:underline"
                >
                  Очистить поиск
                </button>
              )}
            </div>
          )}

          {/* ── РЕЖИМ: ТАБЛИЦА ──────────────────────────────────────────── */}
          {state === "success" && displayedWords.length > 0 && viewMode === "table" && (
            <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white">
              <table className="min-w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="py-3 pl-4 pr-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Слово
                    </th>
                    <th className="py-3 pr-3 text-xs font-semibold uppercase tracking-wide text-gray-400">
                      Перевод
                    </th>
                    <th className="py-3 pr-3 text-xs font-semibold uppercase tracking-wide text-gray-400 hidden sm:table-cell">
                      Часть речи
                    </th>
                    <th className="py-3 pr-4 text-xs font-semibold uppercase tracking-wide text-gray-400 text-right">
                      Изучение
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {displayedWords.map(word => {
                    const isSelected = selectedWordIds.has(word.id);
                    const isPending  = pendingWordIds.has(word.id);
                    const mastery    = getMastery(word.popularityScore);
                    return (
                      <tr
                        key={word.id}
                        className={[
                          "group transition-colors hover:bg-gray-50",
                          isSelected ? "bg-emerald-50/40" : "",
                        ].join(" ")}
                      >
                        {/* Слово + транскрипция + точка прогресса */}
                        <td className="py-3 pl-4 pr-3">
                          <div className="flex items-center gap-2">
                            {mastery && (
                              <span
                                className={["h-2 w-2 shrink-0 rounded-full", mastery.dot].join(" ")}
                                title={mastery.label}
                              />
                            )}
                            <div>
                              <p className="font-semibold text-gray-900">{word.lemma}</p>
                              {word.transcription && (
                                <p className="font-mono text-xs text-gray-400">{word.transcription}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Перевод */}
                        <td className="py-3 pr-3 text-gray-600">{word.translation}</td>

                        {/* Часть речи */}
                        <td className="py-3 pr-3 hidden sm:table-cell">
                          {word.partOfSpeech ? (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-600">
                              {word.partOfSpeech}
                            </span>
                          ) : (
                            <span className="text-gray-300">—</span>
                          )}
                        </td>

                        {/* Кнопка изучения */}
                        <td className="py-3 pr-4 text-right">
                          <button
                            type="button"
                            onClick={() => void handleToggleWord(word.id)}
                            disabled={isPending}
                            title={isSelected ? "Убрать из изучения" : "Добавить в изучение"}
                            className={[
                              "inline-flex h-8 w-8 items-center justify-center rounded-lg border transition-all disabled:opacity-50",
                              isSelected
                                ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                                : "border-gray-200 bg-white text-gray-400 opacity-0 group-hover:opacity-100 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600",
                            ].join(" ")}
                          >
                            {isPending ? (
                              <span className="text-[10px]">...</span>
                            ) : isSelected ? (
                              <Check className="h-3.5 w-3.5" />
                            ) : (
                              <Plus className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* ── РЕЖИМ: КАРТОЧКИ ─────────────────────────────────────────── */}
          {state === "success" && displayedWords.length > 0 && viewMode === "cards" && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {displayedWords.map(word => {
                const isSelected = selectedWordIds.has(word.id);
                const isPending  = pendingWordIds.has(word.id);
                const mastery    = getMastery(word.popularityScore);
                return (
                  <div
                    key={word.id}
                    className={[
                      "group relative flex flex-col rounded-2xl border p-4 transition-all hover:shadow-sm",
                      isSelected
                        ? "border-emerald-200 bg-emerald-50/50"
                        : "border-gray-200 bg-white",
                    ].join(" ")}
                  >
                    {/* Точка прогресса */}
                    {mastery && (
                      <span
                        className={["absolute right-3 top-3 h-2 w-2 rounded-full", mastery.dot].join(" ")}
                        title={mastery.label}
                      />
                    )}

                    {/* Слово */}
                    <p className="text-xl font-bold leading-tight text-gray-900">{word.lemma}</p>

                    {/* Транскрипция */}
                    {word.transcription && (
                      <p className="mt-0.5 font-mono text-xs text-gray-400">{word.transcription}</p>
                    )}

                    {/* Перевод */}
                    <p className="mt-2 text-sm leading-snug text-gray-600">{word.translation}</p>

                    {/* Нижняя строка */}
                    <div className="mt-3 flex items-center justify-between gap-1">
                      {word.partOfSpeech ? (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          {word.partOfSpeech}
                        </span>
                      ) : <span />}

                      <button
                        type="button"
                        onClick={() => void handleToggleWord(word.id)}
                        disabled={isPending}
                        className={[
                          "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all disabled:opacity-50",
                          isSelected
                            ? "border-emerald-200 bg-white text-emerald-600 hover:border-red-200 hover:text-red-500"
                            : "border-gray-200 bg-white text-gray-400 opacity-0 group-hover:opacity-100 hover:border-blue-200 hover:text-blue-600",
                        ].join(" ")}
                      >
                        {isPending ? "·" : isSelected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}