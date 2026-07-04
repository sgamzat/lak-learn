"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getStudySelection, setStudySelection } from "@/lib/api/client";
import { Check, Plus, Search, X } from "lucide-react";
import type { DictionaryWord } from "@/types/word";

// ─────────────────────────────────────────────────────────────────────────────
// Типы
// ─────────────────────────────────────────────────────────────────────────────

type CollectionCard = {
  id:          number;
  slug:        string;
  title:       string;
  description: string | null;
  wordCount:   number;
  sortOrder:   number;
};

type LoadState = "loading" | "success" | "error";

// Буквы русского алфавита для навигации
const ALPHABET = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("");

// ─────────────────────────────────────────────────────────────────────────────
// Вспомогательные функции
// ─────────────────────────────────────────────────────────────────────────────

function genderLabel(g: string | null): string | null {
  if (g === "м")  return "м.р.";
  if (g === "ж")  return "ж.р.";
  if (g === "ср") return "ср.р.";
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Компонент: детальная панель выбранного слова
// ─────────────────────────────────────────────────────────────────────────────

function WordDetail({
  word,
  isStudying,
  isPending,
  onToggle,
}: {
  word:       DictionaryWord;
  isStudying: boolean;
  isPending:  boolean;
  onToggle:   () => void;
}) {
  const gl = genderLabel(word.gender ?? null);
  const meta = [word.partOfSpeech, gl, word.verbAspect].filter(Boolean).join(" · ");

  return (
    <div className="flex flex-col h-full">
      {/* Шапка */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-3 mb-2">
          <div>
            <p className="text-2xl font-bold text-gray-900 leading-tight">{word.lemma}</p>
            <p className="text-base text-gray-500 mt-1">{word.translation}</p>
          </div>
          <button
            type="button"
            onClick={onToggle}
            disabled={isPending}
            className={[
              "flex items-center gap-1.5 shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition-all disabled:opacity-50",
              isStudying
                ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-red-50 hover:border-red-200 hover:text-red-600"
                : "border-gray-200 bg-white text-gray-500 hover:border-blue-200 hover:bg-blue-50 hover:text-blue-600",
            ].join(" ")}
          >
            {isPending ? (
              <span>...</span>
            ) : isStudying ? (
              <><Check className="h-3 w-3" /> В изучении</>
            ) : (
              <><Plus className="h-3 w-3" /> Учить</>
            )}
          </button>
        </div>

        {/* Грамматика */}
        {meta && (
          <div className="flex flex-wrap gap-1.5 mt-2">
            {word.partOfSpeech && (
              <span className="rounded-full bg-gray-100 px-2.5 py-0.5 text-xs text-gray-600">
                {word.partOfSpeech}
              </span>
            )}
            {gl && (
              <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs text-indigo-600">
                {gl}
              </span>
            )}
            {word.verbAspect && (
              <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs text-amber-600">
                {word.verbAspect}
              </span>
            )}
            {word.notes && (
              <span className="rounded-full bg-orange-50 px-2.5 py-0.5 text-xs text-orange-600 italic">
                {word.notes}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Карточка SRS */}
      <div className="p-4 border-b border-gray-100">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-3">
          Карточка повторения
        </p>
        <div className="rounded-2xl bg-gray-50 overflow-hidden">
          {/* Лицо */}
          <div className="px-4 py-5 text-center border-b border-gray-100">
            <p className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
              лакский → русский
            </p>
            <p className="text-2xl font-bold text-gray-900">{word.lemma}</p>
            {(word.partOfSpeech || word.gender) && (
              <div className="flex justify-center gap-1.5 mt-2">
                {word.partOfSpeech && (
                  <span className="rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-500">
                    {word.partOfSpeech}
                  </span>
                )}
                {word.gender && (
                  <span className="rounded-full bg-white border border-gray-200 px-2 py-0.5 text-xs text-gray-500">
                    {word.gender}
                  </span>
                )}
              </div>
            )}
          </div>
          {/* Оборот */}
          <div className="px-4 py-4">
            <p className="text-base font-semibold text-gray-800">{word.translation}</p>
            {(word.partOfSpeech || gl) && (
              <p className="text-xs text-gray-400 mt-0.5">
                {[word.partOfSpeech, gl].filter(Boolean).join(", ")}
              </p>
            )}
            <div className="grid grid-cols-2 gap-2 mt-4">
              <button
                type="button"
                className="rounded-xl border border-red-100 bg-red-50 py-2.5 text-sm font-semibold text-red-600"
              >
                Не знал
              </button>
              <button
                type="button"
                className="rounded-xl border border-emerald-100 bg-emerald-50 py-2.5 text-sm font-semibold text-emerald-700"
              >
                Знал
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Транскрипция */}
      {word.transcription && (
        <div className="px-4 py-3 border-b border-gray-100">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Транскрипция
          </p>
          <p className="font-mono text-sm text-gray-600">[{word.transcription}]</p>
        </div>
      )}

      {/* Подсказка про синонимы */}
      {word.translationPriority === 1 && word.synonymGroupId && (
        <div className="px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 mb-1">
            Синонимы
          </p>
          <p className="text-xs text-gray-400">
            Другие лакские слова для «{word.translation}» появятся на карточке при повторении
          </p>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Главный компонент
// ─────────────────────────────────────────────────────────────────────────────

export default function DictionaryPage() {
  const [allWords,     setAllWords]     = useState<DictionaryWord[]>([]);
  const [words,        setWords]        = useState<DictionaryWord[]>([]);
  const [collections,  setCollections]  = useState<CollectionCard[]>([]);
  const [state,        setState]        = useState<LoadState>("loading");
  const [hasLoaded,    setHasLoaded]    = useState(false);

  // Фильтры
  const [activeLetter,  setActiveLetter]  = useState<string>("all");
  const [filterPos,     setFilterPos]     = useState<string>("all");
  const [searchQuery,   setSearchQuery]   = useState("");
  const [selectedWord,  setSelectedWord]  = useState<DictionaryWord | null>(null);

  // Изучение
  const [selectedWordIds,         setSelectedWordIds]         = useState<Set<number>>(new Set());
  const [selectedCollectionIds,   setSelectedCollectionIds]   = useState<Set<number>>(new Set());
  const [pendingWordIds,           setPendingWordIds]          = useState<Set<number>>(new Set());

  const searchInputRef = useRef<HTMLInputElement>(null);

  // ── Загрузка слов ──────────────────────────────────────────────────────────
  const loadWords = useCallback(async (collectionId?: number) => {
    const p = new URLSearchParams({ limit: "30000", wordType: "word" });
    if (collectionId) p.set("collectionId", String(collectionId));
    const res = await fetch(`/api/words?${p}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`${res.status}`);
    const data = await res.json() as { words: DictionaryWord[] };
    return Array.isArray(data.words) ? data.words : [];
  }, []);

  // ── Начальная загрузка ────────────────────────────────────────────────────
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [colRes, wordsData, study] = await Promise.all([
          fetch("/api/collections", { headers: { Accept: "application/json" }, cache: "no-store" }),
          loadWords(),
          getStudySelection(),
        ]);
        if (!colRes.ok) throw new Error(`${colRes.status}`);
        const colData = await colRes.json() as { collections: CollectionCard[] };
        if (mounted) {
          // Только словарные коллекции по slug (slovar-1958-а, slovar-1958-б, ...)
          const dictCols = (colData.collections ?? [])
            .filter(c => c.slug.startsWith("slovar-1958-"))
            .sort((a, b) => a.sortOrder - b.sortOrder);
          setCollections(dictCols);
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
    })();
    return () => { mounted = false; };
  }, [loadWords]);

  // ── Переключение буквы алфавита ───────────────────────────────────────────
  const handleLetterChange = useCallback(async (letter: string) => {
    setActiveLetter(letter);
    setSearchQuery("");
    setSelectedWord(null);
    setFilterPos("all");

    if (letter === "all") {
      setState("loading");
      try {
        const data = await loadWords();
        setWords(data);
        setState("success");
      } catch { setState("error"); }
      return;
    }

    // Ищем коллекцию с этой буквой по slug
    const slugSuffix = letter.toLowerCase();
    const col = collections.find(c => c.slug === `slovar-1958-${slugSuffix}`);
    if (col) {
      setState("loading");
      try {
        const data = await loadWords(col.id);
        setWords(data);
        setState("success");
      } catch { setState("error"); }
    }
  }, [collections, loadWords]);

  // ── Добавить/убрать слово ─────────────────────────────────────────────────
  const handleToggleWord = useCallback(async (wordId: number) => {
    if (pendingWordIds.has(wordId)) return;
    const was = selectedWordIds.has(wordId);
    setSelectedWordIds(prev => {
      const n = new Set(prev);
      was ? n.delete(wordId) : n.add(wordId);
      return n;
    });
    setPendingWordIds(prev => new Set(prev).add(wordId));
    try {
      const r = await setStudySelection("word", wordId, !was);
      setSelectedWordIds(new Set(r.wordIds));
      setSelectedCollectionIds(new Set(r.collectionIds));
    } catch {
      setSelectedWordIds(prev => {
        const n = new Set(prev);
        was ? n.add(wordId) : n.delete(wordId);
        return n;
      });
    } finally {
      setPendingWordIds(prev => {
        const n = new Set(prev);
        n.delete(wordId);
        return n;
      });
    }
  }, [pendingWordIds, selectedWordIds]);

  // ── Фильтрация ────────────────────────────────────────────────────────────
  const partsOfSpeech = useMemo(() => {
    const s = new Set<string>();
    words.forEach(w => { if (w.partOfSpeech) s.add(w.partOfSpeech); });
    return Array.from(s).sort();
  }, [words]);

  const q = searchQuery.trim().toLowerCase();
  const displayedWords = useMemo(() => {
    // Показываем только основные слова (priority=1) в списке
    let r = words.filter(w => w.translationPriority === 1);
    if (q) {
      r = r.filter(w =>
        w.lemma.toLowerCase().includes(q) ||
        w.translation.toLowerCase().includes(q)
      );
    }
    if (filterPos !== "all") r = r.filter(w => w.partOfSpeech === filterPos);
    return r;
  }, [words, q, filterPos]);

  // Буквы у которых есть коллекция в БД
  const lettersWithData = useMemo(() => {
    const s = new Set<string>();
    collections.forEach(c => {
      // slug вида "slovar-1958-а" → берём последний сегмент и приводим к верхнему регистру
      const parts = c.slug.split("-");
      const letter = parts[parts.length - 1].toUpperCase();
      if (letter) s.add(letter);
    });
    return s;
  }, [collections]);

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-screen bg-gray-50 overflow-hidden">

      {/* ── ВЕРХНЯЯ ПАНЕЛЬ ────────────────────────────────────────────────── */}
      <div className="bg-white border-b border-gray-100 px-4 pt-4 pb-0 shrink-0">

        {/* Заголовок + кнопка повторить */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Словарь</h1>
            {hasLoaded && (
              <p className="text-xs text-gray-400 mt-0.5">
                {displayedWords.length.toLocaleString()} слов
                {selectedWordIds.size > 0 && (
                  <> · <span className="text-emerald-600 font-medium">{selectedWordIds.size} в изучении</span></>
                )}
              </p>
            )}
          </div>
          <a
            href="/study"
            className="flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            Повторить
          </a>
        </div>

        {/* Поиск */}
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={e => {
              setSearchQuery(e.target.value);
              if (e.target.value) setActiveLetter("all");
            }}
            placeholder="Поиск по-лакски или по-русски..."
            className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-9 pr-9 text-sm text-gray-900 placeholder-gray-400 outline-none focus:border-emerald-300 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => { setSearchQuery(""); searchInputRef.current?.focus(); }}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Алфавит — горизонтальный скролл */}
        <div className="flex gap-1 overflow-x-auto scrollbar-none pb-3">
          <button
            type="button"
            onClick={() => void handleLetterChange("all")}
            className={[
              "shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors",
              activeLetter === "all"
                ? "bg-emerald-500 text-white"
                : "text-gray-500 hover:bg-gray-100",
            ].join(" ")}
          >
            Все
          </button>
          {ALPHABET.map(letter => {
            const hasData = lettersWithData.has(letter);
            const isActive = activeLetter === letter;
            return (
              <button
                key={letter}
                type="button"
                onClick={() => hasData ? void handleLetterChange(letter) : undefined}
                disabled={!hasData}
                className={[
                  "relative shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition-colors",
                  isActive
                    ? "bg-emerald-500 text-white"
                    : hasData
                      ? "text-gray-700 hover:bg-gray-100"
                      : "text-gray-300 cursor-default",
                ].join(" ")}
              >
                {letter}
                {/* Зелёная точка — буква в изучении */}
                {hasData && selectedCollectionIds.has(
                  collections.find(c => c.slug === `slovar-1958-${letter.toLowerCase()}`)?.id ?? -1
                ) && (
                  <span className="absolute top-0.5 right-0.5 h-1.5 w-1.5 rounded-full bg-emerald-400" />
                )}
              </button>
            );
          })}
        </div>

        {/* Фильтр по части речи */}
        {partsOfSpeech.length > 0 && !searchQuery && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none pb-3">
            <button
              type="button"
              onClick={() => setFilterPos("all")}
              className={[
                "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                filterPos === "all"
                  ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                  : "border-gray-200 bg-white text-gray-500 hover:border-gray-300",
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
                  "shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                  filterPos === pos
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-gray-200 bg-white text-gray-500 hover:border-gray-300",
                ].join(" ")}
              >
                {pos}
              </button>
            ))}
          </div>
        )}

        {/* Статус */}
        <div className="flex items-center justify-between pb-2 text-xs text-gray-400">
          {activeLetter !== "all" && !searchQuery
            ? <span><span className="font-medium text-gray-700">{activeLetter}</span> — {displayedWords.length} слов</span>
            : searchQuery
              ? <span>Найдено: <span className="font-medium text-gray-700">{displayedWords.length}</span></span>
              : <span>Всего: <span className="font-medium text-gray-700">{displayedWords.length.toLocaleString()}</span></span>
          }
        </div>
      </div>

      {/* ── ОСНОВНАЯ ОБЛАСТЬ ────────────────────────────────────────────── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── СПИСОК СЛОВ ─────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Загрузка */}
          {state === "loading" && (
            <div className="space-y-0">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-3 border-b border-gray-100">
                  <div className="h-2 w-2 rounded-full bg-gray-200 shrink-0" />
                  <div className="h-4 w-32 rounded bg-gray-200 animate-pulse" />
                  <div className="h-3 w-24 rounded bg-gray-100 animate-pulse ml-2" />
                </div>
              ))}
            </div>
          )}

          {/* Ошибка */}
          {state === "error" && (
            <p className="m-4 rounded-2xl border border-red-100 bg-red-50 p-4 text-sm text-red-600">
              Не удалось загрузить словарь. Обновите страницу.
            </p>
          )}

          {/* Пустой результат поиска */}
          {state === "success" && displayedWords.length === 0 && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <p className="text-4xl mb-3">🔍</p>
              <p className="text-sm font-medium text-gray-700">Ничего не найдено</p>
              <p className="text-xs text-gray-400 mt-1">Попробуйте другой запрос или букву</p>
            </div>
          )}

          {/* Список */}
          {state === "success" && displayedWords.length > 0 && (
            <>
              {displayedWords.map(word => {
                const isSelected = selectedWordIds.has(word.id);
                const isPending  = pendingWordIds.has(word.id);
                const isActive   = selectedWord?.id === word.id;
                const gl         = genderLabel(word.gender ?? null);

                return (
                  <div
                    key={word.id}
                    onClick={() => setSelectedWord(isActive ? null : word)}
                    className={[
                      "group flex items-center gap-3 px-4 py-3 border-b border-gray-100 cursor-pointer transition-colors",
                      isActive
                        ? "bg-emerald-50"
                        : "hover:bg-gray-50",
                    ].join(" ")}
                  >
                    {/* Точка изучения */}
                    <span className={[
                      "h-2 w-2 shrink-0 rounded-full transition-colors",
                      isSelected ? "bg-emerald-500" : "bg-gray-200",
                    ].join(" ")} />

                    {/* Лакское слово */}
                    <div className="w-44 shrink-0">
                      <p className={[
                        "text-sm font-semibold truncate",
                        isActive ? "text-emerald-900" : "text-gray-900",
                      ].join(" ")}>
                        {word.lemma}
                      </p>
                    </div>

                    {/* Перевод */}
                    <p className="flex-1 min-w-0 text-sm text-gray-500 truncate">
                      {word.translation}
                    </p>

                    {/* Бейджи */}
                    <div className="hidden sm:flex items-center gap-1.5 shrink-0">
                      {word.partOfSpeech && (
                        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
                          {word.partOfSpeech}
                        </span>
                      )}
                      {gl && (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-500">
                          {gl}
                        </span>
                      )}
                      {word.verbAspect && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs text-amber-600">
                          {word.verbAspect}
                        </span>
                      )}
                    </div>

                    {/* Кнопка изучать */}
                    <button
                      type="button"
                      onClick={e => { e.stopPropagation(); void handleToggleWord(word.id); }}
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
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Plus className="h-3.5 w-3.5" />
                      )}
                    </button>
                  </div>
                );
              })}
              <div className="h-8" />
            </>
          )}
        </div>

        {/* ── ДЕТАЛЬНАЯ ПАНЕЛЬ (десктоп) ──────────────────────────────── */}
        <div className="hidden lg:flex w-80 shrink-0 border-l border-gray-100 bg-white overflow-y-auto flex-col">
          {selectedWord ? (
            <WordDetail
              word={selectedWord}
              isStudying={selectedWordIds.has(selectedWord.id)}
              isPending={pendingWordIds.has(selectedWord.id)}
              onToggle={() => void handleToggleWord(selectedWord.id)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-gray-400">
              <span className="text-4xl">👈</span>
              <p className="text-sm">Выберите слово<br />чтобы увидеть карточку</p>
            </div>
          )}
        </div>
      </div>

      {/* ── ШТОРКА СНИЗУ (мобильный) ─────────────────────────────────── */}
      {selectedWord && (
        <div className="lg:hidden fixed inset-x-0 bottom-0 z-40 bg-white rounded-t-2xl shadow-xl border-t border-gray-100 max-h-[70vh] overflow-y-auto">
          {/* Ручка */}
          <div className="flex justify-center pt-3 pb-1">
            <div className="h-1 w-10 rounded-full bg-gray-200" />
          </div>
          {/* Крестик */}
          <button
            type="button"
            onClick={() => setSelectedWord(null)}
            className="absolute right-4 top-3 text-gray-400 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
          <WordDetail
            word={selectedWord}
            isStudying={selectedWordIds.has(selectedWord.id)}
            isPending={pendingWordIds.has(selectedWord.id)}
            onToggle={() => void handleToggleWord(selectedWord.id)}
          />
        </div>
      )}

      {/* Затемнение под шторкой */}
      {selectedWord && (
        <div
          className="lg:hidden fixed inset-0 z-30 bg-black/20"
          onClick={() => setSelectedWord(null)}
        />
      )}

    </div>
  );
}