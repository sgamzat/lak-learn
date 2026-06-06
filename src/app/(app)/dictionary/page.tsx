"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStudySelection, setStudySelection } from "@/lib/api/client";
import { Search, Check, Plus, X } from "lucide-react";

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

type Mastery = { dot: string; label: string };

function getMastery(score: number | null): Mastery {
  if (score === null || score <= 1) return { dot: "bg-gray-300",  label: "Новое" };
  if (score <= 3)                   return { dot: "bg-blue-400",  label: "Знакомое" };
  if (score <= 6)                   return { dot: "bg-amber-400", label: "Изучаемое" };
  return                                   { dot: "bg-green-500", label: "Освоено" };
}

// ─── Компонент ────────────────────────────────────────────────────────────────

export default function DictionaryPage() {
  const [allWords, setAllWords]       = useState<DictionaryWord[]>([]);
  const [words, setWords]             = useState<DictionaryWord[]>([]);
  const [collections, setCollections] = useState<CollectionCard[]>([]);
  const [state, setState]             = useState<LoadState>("loading");
  const [hasLoaded, setHasLoaded]     = useState(false);

  const [activeCollectionId, setActiveCollectionId] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPos, setFilterPos]     = useState("all");
  const [sortBy, setSortBy]           = useState<"default" | "az" | "za">("default");

  const [selectedWordIds, setSelectedWordIds]             = useState<Set<number>>(new Set());
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<number>>(new Set());
  const [pendingWordIds, setPendingWordIds]               = useState<Set<number>>(new Set());
  const [pendingCollectionIds, setPendingCollectionIds]   = useState<Set<number>>(new Set());

  const searchRef = useRef<HTMLInputElement>(null);

  // ── Загрузка слов ──────────────────────────────────────────────────────────
  const loadWords = async (collectionId: number | null) => {
    const p = new URLSearchParams({ limit: "1000" });
    if (collectionId) p.set("collectionId", String(collectionId));
    const res = await fetch(`/api/words?${p}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json() as { words: DictionaryWord[] };
    return Array.isArray(data.words) ? data.words : [];
  };

  // ── Начальная загрузка ────────────────────────────────────────────────────
  useEffect(() => {
    let ok = true;
    (async () => {
      try {
        const [colRes, wordsData, study] = await Promise.all([
          fetch("/api/collections", { headers: { Accept: "application/json" }, cache: "no-store" }),
          loadWords(null),
          getStudySelection(),
        ]);
        if (!colRes.ok) throw new Error(`${colRes.status}`);
        const colData = await colRes.json() as { collections: CollectionCard[] };
        if (ok) {
          // ── Только словарные коллекции (sortOrder >= 31) ──────────────────
          const dictCollections = (colData.collections ?? []).filter(
            c => c.sortOrder >= 31
          );
          setCollections(dictCollections);
          setAllWords(wordsData);
          setWords(wordsData);
          setSelectedWordIds(new Set(study.wordIds));
          setSelectedCollectionIds(new Set(study.collectionIds));
          setState("success");
          setHasLoaded(true);
        }
      } catch { if (ok) setState("error"); }
    })();
    return () => { ok = false; };
  }, []);

  // ── Выбор коллекции ───────────────────────────────────────────────────────
  const handleCollectionSelect = async (id: number | null) => {
    setActiveCollectionId(id);
    setSearchQuery("");
    setState("loading");
    try {
      setWords(await loadWords(id));
      setState("success");
    } catch { setState("error"); }
  };

  // ── Добавить/убрать слово ─────────────────────────────────────────────────
  const handleToggleWord = async (wordId: number) => {
    if (pendingWordIds.has(wordId)) return;
    const was = selectedWordIds.has(wordId);
    const next = new Set(selectedWordIds);
    was ? next.delete(wordId) : next.add(wordId);
    setSelectedWordIds(next);
    setPendingWordIds(p => new Set(p).add(wordId));
    try {
      const r = await setStudySelection("word", wordId, !was);
      setSelectedWordIds(new Set(r.wordIds));
      setSelectedCollectionIds(new Set(r.collectionIds));
    } catch { setSelectedWordIds(new Set(selectedWordIds)); }
    finally {
      setPendingWordIds(p => { const n = new Set(p); n.delete(wordId); return n; });
    }
  };

  // ── Добавить/убрать коллекцию ─────────────────────────────────────────────
  const handleToggleCollection = async (colId: number) => {
    if (pendingCollectionIds.has(colId)) return;
    const was = selectedCollectionIds.has(colId);
    const next = new Set(selectedCollectionIds);
    was ? next.delete(colId) : next.add(colId);
    setSelectedCollectionIds(next);
    setPendingCollectionIds(p => new Set(p).add(colId));
    try {
      const r = await setStudySelection("collection", colId, !was);
      setSelectedWordIds(new Set(r.wordIds));
      setSelectedCollectionIds(new Set(r.collectionIds));
    } catch { setSelectedCollectionIds(new Set(selectedCollectionIds)); }
    finally {
      setPendingCollectionIds(p => { const n = new Set(p); n.delete(colId); return n; });
    }
  };

  // ── Фильтрация + сортировка ───────────────────────────────────────────────
  const partsOfSpeech = useMemo(() => {
    const s = new Set<string>();
    words.forEach(w => { if (w.partOfSpeech) s.add(w.partOfSpeech); });
    return Array.from(s).sort();
  }, [words]);

  const q = searchQuery.trim().toLowerCase();

  const displayedWords = useMemo(() => {
    let r = words;
    if (q) r = r.filter(w =>
      w.lemma.toLowerCase().includes(q) ||
      w.translation.toLowerCase().includes(q) ||
      (w.transcription?.toLowerCase().includes(q) ?? false)
    );
    if (filterPos !== "all") r = r.filter(w => w.partOfSpeech === filterPos);
    if (sortBy === "az") r = [...r].sort((a, b) => a.lemma.localeCompare(b.lemma));
    if (sortBy === "za") r = [...r].sort((a, b) => b.lemma.localeCompare(a.lemma));
    return r;
  }, [words, q, filterPos, sortBy]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex h-[calc(100vh-56px)] overflow-hidden">

      {/* ── ЛЕВАЯ КОЛОНКА — Коллекции ───────────────────────────────────── */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-gray-200 bg-white lg:w-64">

        {/* Шапка */}
        <div className="shrink-0 border-b border-gray-100 px-3 py-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
            Части речи
          </p>
          {hasLoaded && (
            <p className="mt-0.5 text-xs text-gray-400">
              {allWords.length} слов · {selectedWordIds.size} учу
            </p>
          )}
        </div>

        {/* Список коллекций — независимый скролл */}
        <div className="flex-1 overflow-y-auto py-1.5">

          {/* Все слова */}
          <button
            type="button"
            onClick={() => void handleCollectionSelect(null)}
            className={[
              "flex w-full items-center justify-between px-3 py-2.5 text-left text-sm transition-colors",
              !activeCollectionId
                ? "bg-gray-900 font-semibold text-white"
                : "text-gray-700 hover:bg-gray-50",
            ].join(" ")}
          >
            <span>Все слова</span>
            <span className={[
              "rounded-full px-1.5 py-0.5 text-xs",
              !activeCollectionId
                ? "bg-white/20 text-white"
                : "bg-gray-100 text-gray-500",
            ].join(" ")}>
              {allWords.length}
            </span>
          </button>

          {/* Коллекции */}
          {collections.map(col => {
            const isActive   = activeCollectionId === col.id;
            const isSelected = selectedCollectionIds.has(col.id);
            const isPending  = pendingCollectionIds.has(col.id);
            return (
              <div key={col.id} className="group relative flex items-center">
                <button
                  type="button"
                  onClick={() => void handleCollectionSelect(col.id)}
                  className={[
                    "flex flex-1 items-center justify-between px-3 py-2.5 text-left text-sm transition-colors",
                    isActive
                      ? "bg-gray-900 font-semibold text-white"
                      : "text-gray-700 hover:bg-gray-50",
                  ].join(" ")}
                >
                  <span className="flex items-center gap-2">
                    {isSelected && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                    )}
                    <span className="truncate">{col.title}</span>
                  </span>
                  <span className={[
                    "ml-1 shrink-0 rounded-full px-1.5 py-0.5 text-xs",
                    isActive
                      ? "bg-white/20 text-white"
                      : "bg-gray-100 text-gray-500",
                  ].join(" ")}>
                    {col.wordCount}
                  </span>
                </button>

                {/* Кнопка «Учить» — видна при наведении */}
                <button
                  type="button"
                  onClick={() => void handleToggleCollection(col.id)}
                  disabled={isPending}
                  title={isSelected ? "Убрать из изучения" : "Учить коллекцию"}
                  className={[
                    "absolute right-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border text-xs transition-all disabled:opacity-50",
                    "opacity-0 group-hover:opacity-100",
                    isSelected
                      ? "border-emerald-200 bg-emerald-50 text-emerald-600"
                      : "border-gray-200 bg-white text-gray-400",
                  ].join(" ")}
                >
                  {isPending ? "·" : isSelected ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                </button>
              </div>
            );
          })}
        </div>

        {/* Легенда прогресса */}
        <div className="shrink-0 border-t border-gray-100 bg-gray-50 px-3 py-2 space-y-1">
          <p className="text-xs text-gray-400 mb-1.5">Прогресс:</p>
          {[
            { dot: "bg-gray-300",  label: "Новое" },
            { dot: "bg-blue-400",  label: "Знакомое" },
            { dot: "bg-amber-400", label: "Изучаемое" },
            { dot: "bg-green-500", label: "Освоено" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-2">
              <span className={["h-2 w-2 rounded-full shrink-0", item.dot].join(" ")} />
              <span className="text-xs text-gray-500">{item.label}</span>
            </div>
          ))}
        </div>
      </aside>

      {/* ── ПРАВАЯ КОЛОНКА — Слова ──────────────────────────────────────── */}
      <div className="flex flex-1 flex-col overflow-hidden">

        {/* Панель поиска и фильтров */}
        <div className="shrink-0 space-y-2 border-b border-gray-100 bg-white px-4 py-3">

          {/* Поиск */}
          <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2">
            <Search className="h-4 w-4 shrink-0 text-gray-400" />
            <input
              ref={searchRef}
              type="search"
              placeholder="Поиск по лакскому или русскому..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-gray-400"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Фильтр по части речи + сортировка */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Фильтр части речи */}
            {partsOfSpeech.length > 0 && (
              <div className="flex flex-wrap gap-1">
                <button
                  type="button"
                  onClick={() => setFilterPos("all")}
                  className={[
                    "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                    filterPos === "all"
                      ? "border-gray-800 bg-gray-800 text-white"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50",
                  ].join(" ")}
                >
                  Все
                </button>
                {partsOfSpeech.map(pos => (
                  <button
                    key={pos}
                    type="button"
                    onClick={() => setFilterPos(pos)}
                    className={[
                      "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                      filterPos === pos
                        ? "border-gray-800 bg-gray-800 text-white"
                        : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {pos}
                  </button>
                ))}
              </div>
            )}

            {/* Сортировка */}
            <div className="ml-auto flex gap-1">
              {(["az", "za"] as const).map(s => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSortBy(sortBy === s ? "default" : s)}
                  className={[
                    "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                    sortBy === s
                      ? "border-gray-800 bg-gray-800 text-white"
                      : "border-gray-200 bg-white text-gray-500 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {s === "az" ? "А → Я" : "Я → А"}
                </button>
              ))}
            </div>
          </div>

          {/* Статус */}
          {state === "success" && (
            <div className="flex items-center justify-between text-xs text-gray-400">
              <span>
                {q
                  ? <><span className="font-medium text-gray-700">{displayedWords.length}</span> из {words.length} слов</>
                  : <><span className="font-medium text-gray-700">{displayedWords.length}</span> слов</>
                }
              </span>
              {selectedWordIds.size > 0 && (
                <span className="font-medium text-emerald-600">{selectedWordIds.size} в изучении</span>
              )}
            </div>
          )}
        </div>

        {/* Список слов — независимый скролл */}
        <div className="flex-1 overflow-y-auto">

          {/* Ошибка */}
          {state === "error" && (
            <p className="m-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              Не удалось загрузить. Обновите страницу.
            </p>
          )}

          {/* Загрузка */}
          {state === "loading" && (
            <div className="divide-y divide-gray-50">
              {Array.from({ length: 14 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-gray-200" />
                  <div className="h-4 flex-1 animate-pulse rounded bg-gray-100" style={{ maxWidth: `${45 + (i * 13) % 35}%` }} />
                  <div className="h-4 w-20 animate-pulse rounded bg-gray-100" />
                </div>
              ))}
            </div>
          )}

          {/* Пусто */}
          {state === "success" && displayedWords.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-3xl">🔍</p>
              <p className="mt-2 font-medium text-gray-700">
                {q ? `По запросу «${searchQuery}» ничего не найдено` : "Слов нет"}
              </p>
              {q && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="mt-2 text-sm text-blue-600 hover:underline"
                >
                  Очистить поиск
                </button>
              )}
            </div>
          )}

          {/* Слова */}
          {state === "success" && displayedWords.length > 0 && (
            <div className="divide-y divide-gray-50">
              {displayedWords.map(word => {
                const isSelected = selectedWordIds.has(word.id);
                const isPending  = pendingWordIds.has(word.id);
                const mastery    = getMastery(word.popularityScore);

                return (
                  <div
                    key={word.id}
                    className={[
                      "group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-gray-50",
                      isSelected ? "bg-emerald-50/40" : "",
                    ].join(" ")}
                  >
                    {/* Точка прогресса */}
                    <span
                      className={["h-2 w-2 shrink-0 rounded-full", mastery.dot].join(" ")}
                      title={mastery.label}
                    />

                    {/* Слово + транскрипция */}
                    <div className="min-w-0 w-48 shrink-0">
                      <p className="truncate font-semibold text-gray-900">{word.lemma}</p>
                      {word.transcription && (
                        <p className="truncate font-mono text-xs text-gray-400">
                          {word.transcription}
                        </p>
                      )}
                    </div>

                    {/* Перевод */}
                    <p className="flex-1 min-w-0 truncate text-sm text-gray-500">
                      {word.translation}
                    </p>

                    {/* Часть речи */}
                    {word.partOfSpeech && (
                      <span className="hidden shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500 sm:inline">
                        {word.partOfSpeech}
                      </span>
                    )}

                    {/* Кнопка изучения */}
                    <button
                      type="button"
                      onClick={() => void handleToggleWord(word.id)}
                      disabled={isPending}
                      title={isSelected ? "Убрать из изучения" : "Добавить в изучение"}
                      className={[
                        "flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border transition-all disabled:opacity-50",
                        isSelected
                          ? "border-emerald-200 bg-emerald-50 text-emerald-600 hover:border-red-200 hover:bg-red-50 hover:text-red-500"
                          : "border-gray-200 bg-white text-gray-400 opacity-0 group-hover:opacity-100 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600",
                      ].join(" ")}
                    >
                      {isPending ? (
                        <span className="text-[10px]">·</span>
                      ) : isSelected ? (
                        <Check className="h-3 w-3" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                    </button>
                  </div>
                );
              })}
              {/* Отступ снизу */}
              <div className="h-6" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}