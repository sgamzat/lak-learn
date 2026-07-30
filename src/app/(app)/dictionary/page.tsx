"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  BookMarked, Check, ChevronRight, Plus, RefreshCw, Search, Sparkles, Type, X,
} from "lucide-react";
import { getStudySelection, setStudySelection } from "@/lib/api/client";
import { useTheme } from "@/components/ThemeProvider";
import type { DictionaryWord } from "@/types/word";
import type { CollectionKind } from "@/types/collection";

type DictMode = "search" | "start" | "alphabet" | "mine";
type AlphaMode = "lak" | "ru";
type LoadState = "idle" | "loading" | "success" | "error";

type CollectionCard = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  wordCount: number;
  sortOrder: number;
  kind: CollectionKind;
};

const RU_ALPHABET = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ".split("");

/** Лакский алфавитный индекс (как на /letters), удобный для навигации по леммам */
const LAK_ALPHABET = [
  "А", "Аь", "Б", "В", "Г", "Гъ", "Гь", "Д", "Е", "Ж", "З", "И",
  "К", "Кк", "Кь", "Къ", "КI", "Л", "М", "Н", "О", "Оь", "П", "Пп", "ПI",
  "Р", "С", "Сс", "Т", "Тт", "ТI", "У", "Х", "Хх", "Хъ", "Хь", "Хьхь", "ХI",
  "Ц", "Цц", "ЦI", "Ч", "Чч", "ЧI", "Ш", "Щ", "Ю", "Я",
];

const MODES: { id: DictMode; label: string; hint: string }[] = [
  { id: "start", label: "Начать", hint: "Готовые наборы" },
  { id: "search", label: "Искать", hint: "Поиск по словарю" },
  { id: "alphabet", label: "Алфавит", hint: "По буквам" },
  { id: "mine", label: "Моё", hint: "В изучении" },
];

function genderLabel(g: string | null): string | null {
  if (g === "м") return "м.р.";
  if (g === "ж") return "ж.р.";
  if (g === "ср") return "ср.р.";
  return null;
}

async function fetchWords(params: Record<string, string>): Promise<DictionaryWord[]> {
  const qs = new URLSearchParams({ wordType: "word", primaryOnly: "true", ...params });
  const res = await fetch(`/api/words?${qs}`, {
    headers: { Accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(String(res.status));
  const data = (await res.json()) as { words?: DictionaryWord[] };
  return Array.isArray(data.words) ? data.words : [];
}

function WordDetail({
  word,
  isStudying,
  isPending,
  onToggle,
  onClose,
}: {
  word: DictionaryWord;
  isStudying: boolean;
  isPending: boolean;
  onToggle: () => void;
  onClose?: () => void;
}) {
  const { tokens: T } = useTheme();
  const gl = genderLabel(word.gender ?? null);

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-lk-line px-4 py-4">
        <div className="min-w-0">
          <p className="font-serif text-2xl font-bold leading-tight text-lk-text">{word.lemma}</p>
          <p className="mt-1 text-base text-lk-muted">{word.translation}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggle}
            disabled={isPending}
            className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
              isStudying
                ? "border-lk-green bg-lk-green-dim text-lk-green"
                : "border-lk-line bg-lk-navy2 text-lk-muted hover:border-lk-gold-border hover:text-lk-gold"
            }`}
          >
            {isPending ? "…" : isStudying ? <><Check size={12} /> В изучении</> : <><Plus size={12} /> Учить</>}
          </button>
          {onClose ? (
            <button type="button" onClick={onClose} className="text-lk-faint hover:text-lk-text" aria-label="Закрыть">
              <X size={18} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="space-y-4 px-4 py-4">
        <div className="flex flex-wrap gap-1.5">
          {word.partOfSpeech ? (
            <span className="rounded-full bg-lk-navy3 px-2.5 py-0.5 text-xs text-lk-muted">{word.partOfSpeech}</span>
          ) : null}
          {gl ? <span className="rounded-full bg-lk-gold-dim px-2.5 py-0.5 text-xs text-lk-gold">{gl}</span> : null}
          {word.verbAspect ? (
            <span className="rounded-full bg-lk-green-dim px-2.5 py-0.5 text-xs text-lk-green">{word.verbAspect}</span>
          ) : null}
          {word.notes ? (
            <span className="rounded-full bg-lk-red-dim px-2.5 py-0.5 text-xs italic text-lk-red">{word.notes}</span>
          ) : null}
        </div>

        {word.transcription ? (
          <div>
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-lk-faint">Транскрипция</p>
            <p className="font-mono text-sm text-lk-muted">[{word.transcription}]</p>
          </div>
        ) : null}

        {word.translationPriority === 1 && word.synonymGroupId ? (
          <div className="rounded-xl border border-lk-line bg-lk-navy2 p-3">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-lk-faint">Синонимы</p>
            <p className="text-xs text-lk-muted">
              Другие лакские слова для «{word.translation}» появятся на карточке при повторении.
            </p>
          </div>
        ) : null}

        <Link
          href="/review"
          className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-lk-gold py-3 text-sm font-bold text-lk-bg no-underline transition hover:brightness-110"
          style={{ fontFamily: T.sans }}
        >
          <RefreshCw size={14} /> Перейти к повторению
        </Link>
      </div>
    </div>
  );
}

function WordRow({
  word,
  isActive,
  isStudying,
  isPending,
  onSelect,
  onToggle,
}: {
  word: DictionaryWord;
  isActive: boolean;
  isStudying: boolean;
  isPending: boolean;
  onSelect: () => void;
  onToggle: () => void;
}) {
  const gl = genderLabel(word.gender ?? null);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={`flex cursor-pointer items-center gap-3 border-b border-lk-line px-4 py-3 transition-colors ${
        isActive ? "bg-lk-gold-dim" : "hover:bg-lk-navy2"
      }`}
    >
      <span className={`h-2 w-2 shrink-0 rounded-full ${isStudying ? "bg-lk-green" : "bg-lk-navy3"}`} />
      <div className="w-40 shrink-0 sm:w-48">
        <p className={`truncate text-sm font-semibold ${isActive ? "text-lk-gold" : "text-lk-text"}`}>
          {word.lemma}
        </p>
      </div>
      <p className="min-w-0 flex-1 truncate text-sm text-lk-muted">{word.translation}</p>
      <div className="hidden items-center gap-1.5 sm:flex">
        {word.partOfSpeech ? (
          <span className="rounded-full bg-lk-navy3 px-2 py-0.5 text-xs text-lk-muted">{word.partOfSpeech}</span>
        ) : null}
        {gl ? <span className="rounded-full bg-lk-gold-dim px-2 py-0.5 text-xs text-lk-gold">{gl}</span> : null}
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onToggle();
        }}
        disabled={isPending}
        title={isStudying ? "Убрать из изучения" : "Добавить в изучение"}
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border transition disabled:opacity-50 ${
          isStudying
            ? "border-lk-green bg-lk-green-dim text-lk-green"
            : "border-lk-line bg-lk-navy2 text-lk-muted hover:border-lk-gold-border hover:text-lk-gold"
        }`}
      >
        {isPending ? <span className="text-[10px]">·</span> : isStudying ? <Check size={14} /> : <Plus size={14} />}
      </button>
    </div>
  );
}

export default function DictionaryPage() {
  const { tokens: T } = useTheme();

  const [mode, setMode] = useState<DictMode>("start");
  const [alphaMode, setAlphaMode] = useState<AlphaMode>("lak");
  const [activeLetter, setActiveLetter] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPos, setFilterPos] = useState("all");

  const [words, setWords] = useState<DictionaryWord[]>([]);
  const [collections, setCollections] = useState<CollectionCard[]>([]);
  const [state, setState] = useState<LoadState>("idle");
  const [bootstrapped, setBootstrapped] = useState(false);

  const [selectedWord, setSelectedWord] = useState<DictionaryWord | null>(null);
  const [selectedWordIds, setSelectedWordIds] = useState<Set<number>>(new Set());
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<number>>(new Set());
  const [pendingWordIds, setPendingWordIds] = useState<Set<number>>(new Set());
  const [pendingCollectionIds, setPendingCollectionIds] = useState<Set<number>>(new Set());
  const [bulkPending, setBulkPending] = useState(false);
  const [packTitle, setPackTitle] = useState<string | null>(null);

  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const letterCollections = useMemo(() => {
    const map = new Map<string, CollectionCard>();
    for (const c of collections) {
      if (!c.slug.startsWith("slovar-1958-")) continue;
      const letter = c.slug.slice("slovar-1958-".length).toUpperCase();
      map.set(letter, c);
    }
    return map;
  }, [collections]);

  const topicCollections = useMemo(
    () => collections.filter((c) => c.kind === "topic" && c.wordCount > 0),
    [collections]
  );

  const alphabetLetters = alphaMode === "lak" ? LAK_ALPHABET : RU_ALPHABET;

  const loadList = useCallback(async (loader: () => Promise<DictionaryWord[]>) => {
    setState("loading");
    setSelectedWord(null);
    try {
      const data = await loader();
      setWords(data);
      setState("success");
    } catch {
      setWords([]);
      setState("error");
    }
  }, []);

  // Bootstrap collections + study selection
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const [colRes, study] = await Promise.all([
          fetch("/api/collections", { headers: { Accept: "application/json" }, cache: "no-store" }),
          getStudySelection(),
        ]);
        if (!colRes.ok) throw new Error(String(colRes.status));
        const colData = (await colRes.json()) as { collections?: CollectionCard[] };
        if (!mounted) return;
        setCollections(colData.collections ?? []);
        setSelectedWordIds(new Set(study.wordIds));
        setSelectedCollectionIds(new Set(study.collectionIds));
        setBootstrapped(true);
      } catch {
        if (mounted) {
          setBootstrapped(true);
          setState("error");
        }
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Mode-driven data loading (не трогаем pack-просмотр из «Начать»)
  useEffect(() => {
    if (!bootstrapped) return;
    if (mode === "start") return;

    if (mode === "search") {
      const q = searchQuery.trim();
      if (q.length < 1) {
        setWords([]);
        setState("idle");
        return;
      }
      if (searchTimer.current) clearTimeout(searchTimer.current);
      searchTimer.current = setTimeout(() => {
        void loadList(() => fetchWords({ q, limit: "80" }));
      }, 280);
      return () => {
        if (searchTimer.current) clearTimeout(searchTimer.current);
      };
    }

    if (mode === "alphabet") {
      if (!activeLetter) {
        setWords([]);
        setState("idle");
        return;
      }
      const col = letterCollections.get(activeLetter);
      void loadList(() =>
        col
          ? fetchWords({ collectionId: String(col.id), limit: "2000" })
          : fetchWords({ startsWith: activeLetter.toLowerCase(), limit: "500" })
      );
      return;
    }

    if (mode === "mine") {
      const ids = Array.from(selectedWordIds);
      if (ids.length === 0) {
        setWords([]);
        setState("success");
        return;
      }
      void loadList(() => fetchWords({ ids: ids.slice(0, 500).join(","), limit: "500" }));
    }
  }, [bootstrapped, mode, searchQuery, activeLetter, letterCollections, loadList, selectedWordIds]);

  const partsOfSpeech = useMemo(() => {
    const s = new Set<string>();
    words.forEach((w) => {
      if (w.partOfSpeech) s.add(w.partOfSpeech);
    });
    return Array.from(s).sort();
  }, [words]);

  const displayedWords = useMemo(() => {
    if (filterPos === "all") return words;
    return words.filter((w) => w.partOfSpeech === filterPos);
  }, [words, filterPos]);

  const handleToggleWord = useCallback(
    async (wordId: number) => {
      if (pendingWordIds.has(wordId)) return;
      const was = selectedWordIds.has(wordId);
      setSelectedWordIds((prev) => {
        const n = new Set(prev);
        was ? n.delete(wordId) : n.add(wordId);
        return n;
      });
      setPendingWordIds((prev) => new Set(prev).add(wordId));
      try {
        const r = await setStudySelection("word", wordId, !was);
        setSelectedWordIds(new Set(r.wordIds));
        setSelectedCollectionIds(new Set(r.collectionIds));
      } catch {
        setSelectedWordIds((prev) => {
          const n = new Set(prev);
          was ? n.add(wordId) : n.delete(wordId);
          return n;
        });
      } finally {
        setPendingWordIds((prev) => {
          const n = new Set(prev);
          n.delete(wordId);
          return n;
        });
      }
    },
    [pendingWordIds, selectedWordIds]
  );

  const handleToggleCollection = useCallback(
    async (collectionId: number) => {
      if (pendingCollectionIds.has(collectionId)) return;
      const was = selectedCollectionIds.has(collectionId);
      setSelectedCollectionIds((prev) => {
        const n = new Set(prev);
        was ? n.delete(collectionId) : n.add(collectionId);
        return n;
      });
      setPendingCollectionIds((prev) => new Set(prev).add(collectionId));
      try {
        const r = await setStudySelection("collection", collectionId, !was);
        setSelectedWordIds(new Set(r.wordIds));
        setSelectedCollectionIds(new Set(r.collectionIds));
      } catch {
        setSelectedCollectionIds((prev) => {
          const n = new Set(prev);
          was ? n.add(collectionId) : n.delete(collectionId);
          return n;
        });
      } finally {
        setPendingCollectionIds((prev) => {
          const n = new Set(prev);
          n.delete(collectionId);
          return n;
        });
      }
    },
    [pendingCollectionIds, selectedCollectionIds]
  );

  const handleAddVisible = useCallback(async () => {
    const toAdd = displayedWords.filter((w) => !selectedWordIds.has(w.id)).slice(0, 100);
    if (toAdd.length === 0) return;
    setBulkPending(true);
    try {
      let last = { wordIds: Array.from(selectedWordIds), collectionIds: Array.from(selectedCollectionIds) };
      for (const w of toAdd) {
        last = await setStudySelection("word", w.id, true);
      }
      setSelectedWordIds(new Set(last.wordIds));
      setSelectedCollectionIds(new Set(last.collectionIds));
    } finally {
      setBulkPending(false);
    }
  }, [displayedWords, selectedWordIds, selectedCollectionIds]);

  const openPack = useCallback(
    async (title: string, loader: () => Promise<DictionaryWord[]>) => {
      setMode("start");
      setPackTitle(title);
      setSearchQuery("");
      setFilterPos("all");
      setActiveLetter(null);
      await loadList(loader);
    },
    [loadList]
  );

  const activeLetterCollection = activeLetter ? letterCollections.get(activeLetter) ?? null : null;
  const letterInStudy = activeLetterCollection
    ? selectedCollectionIds.has(activeLetterCollection.id)
    : false;

  const showWordList =
    (mode === "search" && (searchQuery.trim().length > 0 || state === "loading" || state === "success")) ||
    (mode === "alphabet" && activeLetter !== null) ||
    mode === "mine" ||
    (mode === "start" && packTitle !== null);

  return (
    <div className="flex min-h-[calc(100vh-3.5rem)] flex-col bg-lk-bg font-sans text-lk-text">
      {/* Header */}
      <div className="shrink-0 border-b border-lk-line bg-lk-bg/95 px-4 pt-4 backdrop-blur">
        <div className="mx-auto flex max-w-[1200px] items-start justify-between gap-3">
          <div>
            <h1 className="font-serif text-xl font-bold text-lk-text">Словарь</h1>
            <p className="mt-0.5 text-xs text-lk-faint">
              {selectedWordIds.size > 0 ? (
                <>
                  <span className="font-medium text-lk-green">{selectedWordIds.size} в изучении</span>
                  {" · "}выбирайте слова и наборы, затем повторяйте
                </>
              ) : (
                "Найдите слова или добавьте набор — потом откройте повторение"
              )}
            </p>
          </div>
          <Link
            href="/review"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-lk-gold-border bg-lk-gold-dim px-3 py-1.5 text-xs font-semibold text-lk-gold no-underline transition hover:brightness-110"
          >
            <RefreshCw size={13} /> Повторение
          </Link>
        </div>

        {/* Mode tabs */}
        <div className="mx-auto mt-3 flex max-w-[1200px] gap-1 overflow-x-auto pb-3">
          {MODES.map((m) => {
            const active = mode === m.id && !(m.id === "start" && packTitle);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => {
                  setPackTitle(null);
                  setMode(m.id);
                  setFilterPos("all");
                  if (m.id === "search") {
                    setTimeout(() => searchRef.current?.focus(), 50);
                  }
                  if (m.id !== "alphabet") setActiveLetter(null);
                }}
                className={`shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${
                  active || (m.id === "start" && mode === "start" && !packTitle)
                    ? "bg-lk-gold text-lk-bg"
                    : "bg-lk-navy2 text-lk-muted hover:text-lk-text"
                }`}
              >
                {m.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mx-auto flex w-full max-w-[1200px] flex-1 overflow-hidden">
        {/* Main column */}
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
          {/* START mode hub */}
          {mode === "start" && !packTitle && (
            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <section>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-lk-faint">С чего начать</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => void openPack("100 частых слов", () => fetchWords({ limit: "100" }))}
                    className="lk-card lk-lift flex items-start gap-3 p-4 text-left"
                  >
                    <span className="rounded-xl bg-lk-gold-dim p-2 text-lk-gold"><Sparkles size={18} /></span>
                    <span>
                      <span className="block font-semibold text-lk-text">100 частых слов</span>
                      <span className="mt-0.5 block text-xs text-lk-muted">Лучший старт — высокая частотность</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void openPack("500 частых слов", () => fetchWords({ limit: "500" }))}
                    className="lk-card lk-lift flex items-start gap-3 p-4 text-left"
                  >
                    <span className="rounded-xl bg-lk-green-dim p-2 text-lk-green"><BookMarked size={18} /></span>
                    <span>
                      <span className="block font-semibold text-lk-text">500 частых слов</span>
                      <span className="mt-0.5 block text-xs text-lk-muted">Расширенный базовый запас</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setMode("alphabet");
                      setAlphaMode("lak");
                      setActiveLetter(null);
                    }}
                    className="lk-card lk-lift flex items-start gap-3 p-4 text-left"
                  >
                    <span className="rounded-xl bg-lk-navy3 p-2 text-lk-muted"><Type size={18} /></span>
                    <span>
                      <span className="block font-semibold text-lk-text">По алфавиту</span>
                      <span className="mt-0.5 block text-xs text-lk-muted">Лакский индекс букв и диграфов</span>
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMode("search")}
                    className="lk-card lk-lift flex items-start gap-3 p-4 text-left"
                  >
                    <span className="rounded-xl bg-lk-navy3 p-2 text-lk-muted"><Search size={18} /></span>
                    <span>
                      <span className="block font-semibold text-lk-text">Поиск</span>
                      <span className="mt-0.5 block text-xs text-lk-muted">Лакский или русский запрос</span>
                    </span>
                  </button>
                </div>
              </section>

              <section>
                <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-lk-faint">Тематические наборы</p>
                {topicCollections.length === 0 ? (
                  <div className="rounded-2xl border border-dashed border-lk-line bg-lk-navy2/50 p-6 text-center">
                    <p className="text-sm font-medium text-lk-text">Наборов пока нет</p>
                    <p className="mt-1 text-xs text-lk-muted">
                      Когда в админке появятся тематические коллекции, они отобразятся здесь.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {topicCollections.map((col) => {
                      const inStudy = selectedCollectionIds.has(col.id);
                      const pending = pendingCollectionIds.has(col.id);
                      return (
                        <div
                          key={col.id}
                          className="lk-card flex items-center gap-3 p-3"
                        >
                          <button
                            type="button"
                            className="min-w-0 flex-1 text-left"
                            onClick={() =>
                              void openPack(col.title, () =>
                                fetchWords({ collectionId: String(col.id), limit: "2000" })
                              )
                            }
                          >
                            <span className="block truncate font-semibold text-lk-text">{col.title}</span>
                            <span className="text-xs text-lk-muted">
                              {col.wordCount} слов
                              {col.description ? ` · ${col.description}` : ""}
                            </span>
                          </button>
                          <button
                            type="button"
                            disabled={pending}
                            onClick={() => void handleToggleCollection(col.id)}
                            className={`shrink-0 rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                              inStudy
                                ? "border-lk-green bg-lk-green-dim text-lk-green"
                                : "border-lk-line text-lk-muted hover:border-lk-gold-border hover:text-lk-gold"
                            }`}
                          >
                            {pending ? "…" : inStudy ? "В изучении" : "Учить набор"}
                          </button>
                          <ChevronRight size={16} className="shrink-0 text-lk-faint" />
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>
          )}

          {/* Search bar */}
          {mode === "search" && (
            <div className="shrink-0 border-b border-lk-line px-4 py-3">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-lk-faint" />
                <input
                  ref={searchRef}
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Поиск по-лакски или по-русски…"
                  className="w-full rounded-xl border border-lk-line bg-lk-navy2 py-2.5 pl-9 pr-9 text-sm text-lk-text outline-none placeholder:text-lk-faint focus:border-lk-gold-border"
                  style={{ fontFamily: T.sans }}
                />
                {searchQuery ? (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery("");
                      searchRef.current?.focus();
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-lk-faint hover:text-lk-text"
                  >
                    <X size={16} />
                  </button>
                ) : null}
              </div>
            </div>
          )}

          {/* Alphabet controls */}
          {mode === "alphabet" && (
            <div className="shrink-0 space-y-2 border-b border-lk-line px-4 py-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex rounded-xl border border-lk-line bg-lk-navy2 p-0.5">
                  {([
                    { id: "lak" as const, label: "Лакский" },
                    { id: "ru" as const, label: "Как в словаре" },
                  ]).map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => {
                        setAlphaMode(opt.id);
                        setActiveLetter(null);
                        setWords([]);
                        setState("idle");
                      }}
                      className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                        alphaMode === opt.id ? "bg-lk-gold text-lk-bg" : "text-lk-muted"
                      }`}
                    >
                      {opt.label}
                    </button>
                  ))}
                </div>
                {activeLetter ? (
                  <div className="flex items-center gap-2">
                    {activeLetterCollection ? (
                      <button
                        type="button"
                        disabled={pendingCollectionIds.has(activeLetterCollection.id)}
                        onClick={() => void handleToggleCollection(activeLetterCollection.id)}
                        className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition disabled:opacity-50 ${
                          letterInStudy
                            ? "border-lk-green bg-lk-green-dim text-lk-green"
                            : "border-lk-line text-lk-muted hover:border-lk-gold-border hover:text-lk-gold"
                        }`}
                      >
                        {letterInStudy ? "Буква в изучении" : "Учить букву"}
                      </button>
                    ) : (
                      <button
                        type="button"
                        disabled={bulkPending || displayedWords.length === 0}
                        onClick={() => void handleAddVisible()}
                        className="rounded-xl border border-lk-line px-3 py-1.5 text-xs font-semibold text-lk-muted transition hover:border-lk-gold-border hover:text-lk-gold disabled:opacity-50"
                      >
                        {bulkPending ? "Добавляю…" : "Добавить показанные"}
                      </button>
                    )}
                  </div>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-1">
                {alphabetLetters.map((letter) => {
                  const hasCol = letterCollections.has(letter);
                  const active = activeLetter === letter;
                  const inStudy = hasCol && selectedCollectionIds.has(letterCollections.get(letter)!.id);
                  return (
                    <button
                      key={letter}
                      type="button"
                      onClick={() => setActiveLetter(letter)}
                      className={`relative shrink-0 rounded-lg px-2.5 py-1.5 text-sm font-semibold transition ${
                        active
                          ? "bg-lk-gold text-lk-bg"
                          : "bg-lk-navy2 text-lk-muted hover:text-lk-text"
                      }`}
                    >
                      {letter}
                      {inStudy ? (
                        <span className="absolute right-0.5 top-0.5 h-1.5 w-1.5 rounded-full bg-lk-green" />
                      ) : null}
                    </button>
                  );
                })}
              </div>
              {!activeLetter ? (
                <p className="text-xs text-lk-faint">
                  Выберите букву. «Лакский» — диграфы как на странице Буквы; «Как в словаре» — русская разбивка (если есть наборы slovar-1958).
                </p>
              ) : null}
            </div>
          )}

          {/* Pack header when browsing from Start */}
          {mode === "start" && packTitle ? (
            <div className="flex shrink-0 items-center justify-between gap-3 border-b border-lk-line px-4 py-3">
              <div>
                <button
                  type="button"
                  onClick={() => {
                    setPackTitle(null);
                    setWords([]);
                    setState("idle");
                  }}
                  className="text-xs font-medium text-lk-muted hover:text-lk-gold"
                >
                  ← Наборы
                </button>
                <p className="font-semibold text-lk-text">{packTitle}</p>
              </div>
              <button
                type="button"
                disabled={bulkPending || displayedWords.length === 0}
                onClick={() => void handleAddVisible()}
                className="rounded-xl border border-lk-gold-border bg-lk-gold-dim px-3 py-1.5 text-xs font-semibold text-lk-gold disabled:opacity-50"
              >
                {bulkPending ? "Добавляю…" : "Добавить показанные"}
              </button>
            </div>
          ) : null}

          {/* POS filter */}
          {showWordList && partsOfSpeech.length > 0 ? (
            <div className="flex shrink-0 gap-1.5 overflow-x-auto border-b border-lk-line px-4 py-2">
              <button
                type="button"
                onClick={() => setFilterPos("all")}
                className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                  filterPos === "all"
                    ? "border-lk-gold-border bg-lk-gold-dim text-lk-gold"
                    : "border-lk-line text-lk-muted"
                }`}
              >
                Все
              </button>
              {partsOfSpeech.map((pos) => (
                <button
                  key={pos}
                  type="button"
                  onClick={() => setFilterPos(pos)}
                  className={`shrink-0 rounded-full border px-3 py-1 text-xs font-medium ${
                    filterPos === pos
                      ? "border-lk-gold-border bg-lk-gold-dim text-lk-gold"
                      : "border-lk-line text-lk-muted"
                  }`}
                >
                  {pos}
                </button>
              ))}
            </div>
          ) : null}

          {/* Status line */}
          {showWordList ? (
            <div className="shrink-0 px-4 py-2 text-xs text-lk-faint">
              {state === "loading"
                ? "Загрузка…"
                : state === "error"
                  ? "Не удалось загрузить"
                  : mode === "search" && !searchQuery.trim()
                    ? "Введите запрос"
                    : `${displayedWords.length.toLocaleString()} слов`}
            </div>
          ) : null}

          {/* Word list */}
          {showWordList ? (
            <div className="flex-1 overflow-y-auto pb-24 lg:pb-8">
              {state === "loading" &&
                Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-3 border-b border-lk-line px-4 py-3">
                    <div className="h-2 w-2 rounded-full bg-lk-navy3" />
                    <div className="h-4 w-28 animate-pulse rounded bg-lk-navy3" />
                    <div className="h-3 w-24 animate-pulse rounded bg-lk-navy2" />
                  </div>
                ))}

              {state === "error" && (
                <p className="m-4 rounded-2xl border border-lk-red bg-lk-red-dim p-4 text-sm text-lk-red">
                  Не удалось загрузить слова. Обновите страницу.
                </p>
              )}

              {state === "idle" && mode === "search" && (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <Search className="text-lk-faint" size={28} />
                  <p className="text-sm font-medium text-lk-text">Начните вводить слово</p>
                  <p className="text-xs text-lk-muted">Поиск идёт по всему словарю — лакский и русский</p>
                </div>
              )}

              {state === "success" && displayedWords.length === 0 && (
                <div className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center">
                  <p className="text-sm font-medium text-lk-text">
                    {mode === "mine" ? "Пока ничего в изучении" : "Ничего не найдено"}
                  </p>
                  <p className="text-xs text-lk-muted">
                    {mode === "mine"
                      ? "Добавьте слова из поиска, алфавита или готовых наборов"
                      : "Словарь пуст или нет совпадений — загрузите слова в админке"}
                  </p>
                  {mode === "mine" ? (
                    <button
                      type="button"
                      onClick={() => setMode("start")}
                      className="mt-2 rounded-xl bg-lk-gold px-4 py-2 text-xs font-bold text-lk-bg"
                    >
                      К наборам
                    </button>
                  ) : null}
                </div>
              )}

              {state === "success" &&
                displayedWords.map((word) => (
                  <WordRow
                    key={word.id}
                    word={word}
                    isActive={selectedWord?.id === word.id}
                    isStudying={selectedWordIds.has(word.id)}
                    isPending={pendingWordIds.has(word.id)}
                    onSelect={() => setSelectedWord((prev) => (prev?.id === word.id ? null : word))}
                    onToggle={() => void handleToggleWord(word.id)}
                  />
                ))}
            </div>
          ) : null}
        </div>

        {/* Desktop detail */}
        <div className="hidden w-80 shrink-0 flex-col overflow-y-auto border-l border-lk-line bg-lk-navy lg:flex">
          {selectedWord ? (
            <WordDetail
              word={selectedWord}
              isStudying={selectedWordIds.has(selectedWord.id)}
              isPending={pendingWordIds.has(selectedWord.id)}
              onToggle={() => void handleToggleWord(selectedWord.id)}
            />
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-lk-faint">
              <BookMarked size={28} />
              <p className="text-sm">Выберите слово,<br />чтобы увидеть карточку</p>
            </div>
          )}
        </div>
      </div>

      {/* Mobile sheet */}
      {selectedWord ? (
        <>
          <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setSelectedWord(null)} />
          <div className="fixed inset-x-0 bottom-0 z-40 max-h-[70vh] overflow-y-auto rounded-t-2xl border-t border-lk-line bg-lk-navy pb-[calc(62px+env(safe-area-inset-bottom))] shadow-lk lg:hidden">
            <div className="flex justify-center pt-3">
              <div className="h-1 w-10 rounded-full bg-lk-navy3" />
            </div>
            <WordDetail
              word={selectedWord}
              isStudying={selectedWordIds.has(selectedWord.id)}
              isPending={pendingWordIds.has(selectedWord.id)}
              onToggle={() => void handleToggleWord(selectedWord.id)}
              onClose={() => setSelectedWord(null)}
            />
          </div>
        </>
      ) : null}
    </div>
  );
}
