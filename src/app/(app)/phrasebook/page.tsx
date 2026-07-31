"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { getStudySelection, setStudySelection } from "@/lib/api/client";
import {
  Search, Check, Plus, ChevronRight, X, BookOpen, LayoutGrid, List,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

// ─── Группы тем по главам Дигиева ─────────────────────────────────────────────
const TOPIC_GROUPS: Array<{ id: string; label: string; from: number; to: number }> = [
  { id: "talk",     label: "Общение",            from: 1,  to: 20 },
  { id: "life",     label: "Жизнь и учёба",      from: 21, to: 42 },
  { id: "city",     label: "Быт и город",        from: 43, to: 67 },
  { id: "nature",   label: "Здоровье и природа", from: 68, to: 90 },
  { id: "grammar",  label: "Словарь и грамматика", from: 91, to: 200 },
];

const GROUP_COLORS = ["#D4A537", "#3FA06B", "#3E86C9", "#E07BAE", "#9B59B6"];

function groupForSortOrder(sortOrder: number) {
  return TOPIC_GROUPS.find((g) => sortOrder >= g.from && sortOrder <= g.to) ?? TOPIC_GROUPS[0];
}

function groupColor(sortOrder: number) {
  const idx = TOPIC_GROUPS.findIndex((g) => sortOrder >= g.from && sortOrder <= g.to);
  return GROUP_COLORS[idx >= 0 ? idx : 0] ?? GROUP_COLORS[0];
}

type FlipDirection = "lak-ru" | "ru-lak";
const DIRECTION_KEY = "phrasebook-flip-direction";

// ─── Типы ─────────────────────────────────────────────────────────────────────
type PhraseWord = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  partOfSpeech: string | null;
  level: string | null;
  popularityScore: number | null;
};

type Topic = {
  id: number;
  slug: string;
  title: string;
  description: string | null;
  level: string | null;
  wordCount: number;
  sortOrder: number;
  kind: string;
};

type LoadState = "loading" | "success" | "error";

// ─── Компонент: карточка фразы ────────────────────────────────────────────────
function PhraseCard({
  phrase, isSelected, isPending, onToggle, direction,
}: {
  phrase: PhraseWord; isSelected: boolean; isPending: boolean; onToggle: () => void;
  direction: FlipDirection;
}) {
  const { tokens: T } = useTheme();
  const [flipped, setFlipped] = useState(false);
  useEffect(() => { setFlipped(false); }, [phrase.id, direction]);

  const frontText = direction === "lak-ru" ? phrase.lemma : phrase.translation;
  const backText  = direction === "lak-ru" ? phrase.translation : phrase.lemma;
  const showTranscriptionFront = direction === "lak-ru" && phrase.transcription;

  const toggleFlip = () => setFlipped((f) => !f);

  const faceBase: CSSProperties = {
    gridArea: "1 / 1",
    backfaceVisibility: "hidden",
    WebkitBackfaceVisibility: "hidden",
    borderRadius: 16,
    padding: "16px 18px",
    minHeight: 140,
    boxSizing: "border-box",
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={flipped}
      aria-label={flipped ? `Перевод: ${backText}` : frontText}
      onClick={toggleFlip}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleFlip();
        }
      }}
      style={{ perspective: "1000px", cursor: "pointer" }}
    >
      {/* grid-area stack: высота = max(лицо, оборот), карточки не наезжают */}
      <div style={{
        display: "grid",
        width: "100%",
        transformStyle: "preserve-3d",
        transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
      }}>
        {/* Лицо */}
        <div style={{
          ...faceBase,
          background: T.navy2,
          border: `1px solid ${isSelected ? "rgba(63,160,107,0.5)" : T.lineCool}`,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          gap: 12,
          boxShadow: isSelected ? "0 0 0 1px rgba(63,160,107,0.3)" : "none",
        }}>
          <div>
            <p style={{
              fontFamily: direction === "lak-ru" ? T.serif : T.sans,
              fontSize: frontText.length > 40 ? 14 : 17,
              fontWeight: 700, color: T.text, lineHeight: 1.35,
              wordBreak: "break-word",
            }}>
              {frontText}
            </p>
            {showTranscriptionFront && (
              <p style={{ fontFamily: T.mono, fontSize: 11, color: T.textFaint, marginTop: 3 }}>
                [{phrase.transcription}]
              </p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <span style={{ fontSize: 10, color: T.textFaint }}>нажми — перевод</span>
            <button
              type="button"
              aria-label={isSelected ? "Убрать из изучения" : "Добавить в изучение"}
              onClick={(e) => { e.stopPropagation(); onToggle(); }}
              style={{
                width: 28, height: 28, borderRadius: 8,
                border: `1px solid ${isSelected ? "rgba(63,160,107,0.6)" : T.lineCool}`,
                background: isSelected ? T.greenDim : "transparent",
                color: isSelected ? T.green : T.textFaint,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0,
              }}
            >
              {isPending
                ? <span style={{ fontSize: 9, color: T.textFaint }}>…</span>
                : isSelected ? <Check size={13} /> : <Plus size={13} />}
            </button>
          </div>
        </div>

        {/* Оборот */}
        <div style={{
          ...faceBase,
          transform: "rotateY(180deg)",
          background: `linear-gradient(135deg, rgba(63,160,107,0.18), ${T.navy2})`,
          border: "1px solid rgba(63,160,107,0.35)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          alignItems: "flex-start",
          gap: 6,
        }}>
          <p style={{
            fontFamily: direction === "lak-ru" ? T.sans : T.serif,
            fontSize: 17, fontWeight: 600, color: T.text, lineHeight: 1.3,
            wordBreak: "break-word",
          }}>
            {backText}
          </p>
          <p style={{
            fontFamily: direction === "lak-ru" ? T.serif : T.sans,
            fontSize: 13, color: T.textMut, lineHeight: 1.3,
            wordBreak: "break-word",
          }}>
            {frontText}
          </p>
          {phrase.transcription && (
            <p style={{ fontFamily: T.mono, fontSize: 11, color: T.textFaint }}>
              [{phrase.transcription}]
            </p>
          )}
          <span style={{ fontSize: 11, color: T.green }}>← назад</span>
        </div>
      </div>
    </div>
  );
}

// ─── Компонент: карточка темы (desktop sidebar) ───────────────────────────────
function TopicCard({
  topic, isActive, isSelected, onClick,
}: {
  topic: Topic; isActive: boolean; isSelected: boolean; onClick: () => void;
}) {
  const { tokens: T } = useTheme();
  const color = groupColor(topic.sortOrder);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left",
        background: isActive ? `linear-gradient(135deg, ${color}22, ${T.navy2})` : T.navy,
        border: `1px solid ${isActive ? `${color}55` : T.lineCool}`,
        borderRadius: 16, padding: "12px 14px",
        cursor: "pointer", transition: "all 0.18s",
        position: "relative", overflow: "hidden",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{
          width: 8, height: 8, borderRadius: "50%", background: color, flexShrink: 0,
        }} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: T.sans, fontSize: 13.5, fontWeight: 600,
            color: isActive ? T.text : T.textMut,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
          }}>
            {topic.title}
          </p>
          <p style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
            {topic.wordCount} фраз
            {isSelected ? " · в изучении" : ""}
          </p>
        </div>
        <ChevronRight size={14} style={{ color: isActive ? color : T.textFaint, flexShrink: 0 }} />
      </div>
    </button>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function PhrasebookPage() {
  const { tokens: T } = useTheme();
  const router = useRouter();

  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [phrases, setPhrases] = useState<PhraseWord[]>([]);
  const [topicState, setTopicState] = useState<LoadState>("loading");
  const [phraseState, setPhraseState] = useState<LoadState>("loading");
  const [hasLoaded, setHasLoaded] = useState(false);

  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");
  const [direction, setDirection] = useState<FlipDirection>("lak-ru");
  const [revealedListIds, setRevealedListIds] = useState<Set<number>>(new Set());
  const [activeGroup, setActiveGroup] = useState<string>("all");
  const [startingPractice, setStartingPractice] = useState(false);

  const [selectedWordIds, setSelectedWordIds] = useState<Set<number>>(new Set());
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<number>>(new Set());
  const [pendingWordIds, setPendingWordIds] = useState<Set<number>>(new Set());
  const [pendingCollectionIds, setPendingCollectionIds] = useState<Set<number>>(new Set());

  const searchRef = useRef<HTMLInputElement>(null);
  const chipsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const saved = localStorage.getItem(DIRECTION_KEY);
      if (saved === "lak-ru" || saved === "ru-lak") setDirection(saved);
    } catch { /* ignore */ }
  }, []);

  const setDirectionPersist = (next: FlipDirection) => {
    setDirection(next);
    try { localStorage.setItem(DIRECTION_KEY, next); } catch { /* ignore */ }
  };

  // ── Загрузка коллекций ────────────────────────────────────────────────────
  useEffect(() => {
    const load = async () => {
      setTopicState("loading");
      try {
        const [colRes, selRes] = await Promise.all([
          fetch("/api/collections", { headers: { Accept: "application/json" }, cache: "no-store" }),
          getStudySelection(),
        ]);
        if (!colRes.ok) throw new Error(`${colRes.status}`);
        const colData = await colRes.json() as {
          collections: Array<{
            id: number; slug: string; title: string; description: string | null;
            level: string | null; wordCount: number; sortOrder: number; kind: string;
          }>;
        };

        const phrasebookCollections = (colData.collections ?? [])
          .filter((c) => c.kind === "topic" && c.wordCount > 0)
          .map((c) => ({
            id: c.id, slug: c.slug, title: c.title, description: c.description,
            level: c.level, wordCount: c.wordCount, sortOrder: c.sortOrder, kind: c.kind,
          }));

        setAllTopics(phrasebookCollections);
        setSelectedWordIds(new Set(selRes.wordIds));
        setSelectedCollectionIds(new Set(selRes.collectionIds));
        setTopicState("success");
        setHasLoaded(true);
        if (phrasebookCollections.length > 0) {
          setActiveTopic(phrasebookCollections[0] ?? null);
        }
      } catch { setTopicState("error"); }
    };
    void load();
  }, []);

  // ── Загрузка фраз по теме ─────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTopic) { setPhrases([]); return; }
    const load = async () => {
      setPhraseState("loading");
      setRevealedListIds(new Set());
      try {
        const p = new URLSearchParams({ limit: "1000", collectionId: String(activeTopic.id) });
        const res = await fetch(`/api/words?${p}`, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json() as { words: PhraseWord[] };
        setPhrases(Array.isArray(data.words) ? data.words : []);
        setPhraseState("success");
      } catch { setPhraseState("error"); }
    };
    void load();
  }, [activeTopic]);

  const selectTopic = (topic: Topic) => {
    setSearchQuery("");
    setActiveTopic(topic);
    const g = groupForSortOrder(topic.sortOrder);
    setActiveGroup(g.id);
  };

  const filteredTopics = useMemo(() => {
    if (activeGroup === "all") return allTopics;
    const g = TOPIC_GROUPS.find((x) => x.id === activeGroup);
    if (!g) return allTopics;
    return allTopics.filter((t) => t.sortOrder >= g.from && t.sortOrder <= g.to);
  }, [allTopics, activeGroup]);

  const q = searchQuery.trim().toLowerCase();
  const displayedPhrases = useMemo(() => {
    if (!q) return phrases;
    return phrases.filter(
      (p) => p.lemma.toLowerCase().includes(q) || p.translation.toLowerCase().includes(q)
    );
  }, [phrases, q]);

  const studiedInTopic = useMemo(() => {
    if (!phrases.length) return 0;
    return phrases.filter((p) => selectedWordIds.has(p.id)).length;
  }, [phrases, selectedWordIds]);

  const handleTogglePhrase = async (phraseId: number) => {
    const isSelected = selectedWordIds.has(phraseId);
    setPendingWordIds((p) => new Set(p).add(phraseId));
    const next = new Set(selectedWordIds);
    isSelected ? next.delete(phraseId) : next.add(phraseId);
    setSelectedWordIds(next);
    try {
      const res = await setStudySelection("word", phraseId, !isSelected);
      setSelectedWordIds(new Set(res.wordIds));
      setSelectedCollectionIds(new Set(res.collectionIds));
    } catch { setSelectedWordIds(new Set(selectedWordIds)); }
    finally {
      setPendingWordIds((p) => { const n = new Set(p); n.delete(phraseId); return n; });
    }
  };

  const handleToggleTopic = async (topicId: number) => {
    const isSelected = selectedCollectionIds.has(topicId);
    setPendingCollectionIds((p) => new Set(p).add(topicId));
    const next = new Set(selectedCollectionIds);
    isSelected ? next.delete(topicId) : next.add(topicId);
    setSelectedCollectionIds(next);
    try {
      const res = await setStudySelection("collection", topicId, !isSelected);
      setSelectedWordIds(new Set(res.wordIds));
      setSelectedCollectionIds(new Set(res.collectionIds));
    } catch { setSelectedCollectionIds(new Set(selectedCollectionIds)); }
    finally {
      setPendingCollectionIds((p) => { const n = new Set(p); n.delete(topicId); return n; });
    }
  };

  const handlePracticeTopic = async () => {
    if (!activeTopic || startingPractice) return;
    setStartingPractice(true);
    try {
      if (!selectedCollectionIds.has(activeTopic.id)) {
        const res = await setStudySelection("collection", activeTopic.id, true);
        setSelectedWordIds(new Set(res.wordIds));
        setSelectedCollectionIds(new Set(res.collectionIds));
      }
      router.push(`/review?collectionId=${activeTopic.id}`);
    } catch {
      setStartingPractice(false);
    }
  };

  // ── Рендер ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-lk-bg font-sans text-lk-text transition-colors duration-[400ms] pb-24 lg:pb-8">

      {/* ── Хедер страницы ── */}
      <div className="flex flex-wrap items-center gap-3 border-b border-lk-line px-4 py-3 sm:gap-4 sm:px-6 sm:py-4">
        <div className="min-w-0 flex-1">
          <h1 className="font-serif text-[20px] font-bold leading-none text-lk-text sm:text-[22px]">
            Разговорник
          </h1>
          {hasLoaded && (
            <p className="mt-1 text-xs text-lk-faint">
              {allTopics.length} тем · {selectedWordIds.size} фраз в изучении
            </p>
          )}
        </div>

        <div
          className="order-3 flex w-full items-center gap-2 sm:order-none sm:ml-auto sm:w-auto"
          style={{
            background: T.navy2, border: `1px solid ${T.lineCool}`, borderRadius: 12,
            padding: "7px 12px", minWidth: 0, flex: "1 1 200px", maxWidth: 280,
          }}
        >
          <Search size={14} style={{ color: T.textFaint, flexShrink: 0 }} />
          <input
            ref={searchRef}
            type="search"
            placeholder="Поиск в этой теме…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              flex: 1, background: "transparent", border: "none", outline: "none",
              fontSize: 13.5, color: T.text, fontFamily: T.sans, minWidth: 0,
            }}
          />
          {q && (
            <button
              type="button"
              aria-label="Очистить поиск"
              onClick={() => setSearchQuery("")}
              style={{ background: "none", border: "none", cursor: "pointer", color: T.textFaint, padding: 0, display: "flex" }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        <div style={{
          display: "flex", background: T.navy, borderRadius: 10, padding: 3,
          border: `1px solid ${T.lineCool}`,
        }}>
          {([
            { mode: "cards" as const, label: "Карточки", Icon: LayoutGrid },
            { mode: "list" as const, label: "Список", Icon: List },
          ]).map(({ mode, label, Icon }) => (
            <button
              key={mode}
              type="button"
              aria-label={label}
              onClick={() => setViewMode(mode)}
              style={{
                padding: "5px 10px", borderRadius: 7, fontSize: 12.5, fontWeight: 600,
                fontFamily: T.sans, border: "none", cursor: "pointer",
                background: viewMode === mode ? T.gold : "transparent",
                color: viewMode === mode ? T.bg : T.textMut,
                display: "flex", alignItems: "center", gap: 5,
              }}
            >
              <Icon size={13} />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Группы (фильтр) ── */}
      {topicState === "success" && (
        <div
          className="flex gap-2 overflow-x-auto border-b border-lk-line px-4 py-2.5 sm:px-6"
          style={{ scrollbarWidth: "none" }}
        >
          <button
            type="button"
            onClick={() => setActiveGroup("all")}
            style={{
              flexShrink: 0, padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600,
              border: `1px solid ${activeGroup === "all" ? T.gold : T.lineCool}`,
              background: activeGroup === "all" ? T.gold : T.navy2,
              color: activeGroup === "all" ? T.bg : T.textMut,
              cursor: "pointer", fontFamily: T.sans,
            }}
          >
            Все
          </button>
          {TOPIC_GROUPS.map((g, idx) => (
            <button
              key={g.id}
              type="button"
              onClick={() => {
                setActiveGroup(g.id);
                const first = allTopics.find((t) => t.sortOrder >= g.from && t.sortOrder <= g.to);
                if (first) selectTopic(first);
              }}
              style={{
                flexShrink: 0, padding: "6px 12px", borderRadius: 999, fontSize: 12.5, fontWeight: 600,
                border: `1px solid ${activeGroup === g.id ? GROUP_COLORS[idx] : T.lineCool}`,
                background: activeGroup === g.id ? `${GROUP_COLORS[idx]}22` : T.navy2,
                color: activeGroup === g.id ? T.text : T.textMut,
                cursor: "pointer", fontFamily: T.sans,
              }}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Мобильные чипы тем ── */}
      {topicState === "success" && (
        <div
          ref={chipsRef}
          className="flex gap-2 overflow-x-auto px-4 py-3 lg:hidden"
          style={{ scrollbarWidth: "none" }}
        >
          {filteredTopics.map((topic) => {
            const isActive = activeTopic?.id === topic.id;
            const color = groupColor(topic.sortOrder);
            return (
              <button
                key={topic.id}
                type="button"
                onClick={() => selectTopic(topic)}
                style={{
                  flexShrink: 0, padding: "8px 14px", borderRadius: 999, fontSize: 13, fontWeight: 600,
                  border: `1px solid ${isActive ? color : T.lineCool}`,
                  background: isActive ? `${color}22` : T.navy2,
                  color: isActive ? T.text : T.textMut,
                  cursor: "pointer", fontFamily: T.sans,
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <span style={{ width: 6, height: 6, borderRadius: "50%", background: color }} />
                {topic.title}
                {selectedCollectionIds.has(topic.id) && (
                  <Check size={12} style={{ color: T.green }} />
                )}
              </button>
            );
          })}
        </div>
      )}

      {/* ── Основная сетка ── */}
      <div className="mx-auto flex w-full max-w-[1280px] flex-1 items-start gap-6 px-4 py-4 sm:px-6 sm:py-5">

        {/* Desktop сайдбар — явный column flex, иначе темы наезжают в ряд */}
        <aside
          className="sticky top-[72px] hidden max-h-[calc(100vh-92px)] w-[260px] shrink-0 overflow-y-auto lg:block"
          style={{ paddingRight: 4 }}
        >
          <p style={{
            fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase",
            color: T.textFaint, marginBottom: 8, paddingLeft: 4,
          }}>
            Темы
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {topicState === "loading" && Array.from({ length: 8 }, (_, i) => (
              <div key={i} style={{ height: 62, borderRadius: 16, background: T.navy2, opacity: 0.5 + i * 0.05 }} />
            ))}

            {topicState === "error" && (
              <p style={{ fontSize: 13, color: T.red, padding: "8px 4px" }}>Не удалось загрузить темы.</p>
            )}

            {topicState === "success" && filteredTopics.map((topic) => (
              <TopicCard
                key={topic.id}
                topic={topic}
                isActive={activeTopic?.id === topic.id}
                isSelected={selectedCollectionIds.has(topic.id)}
                onClick={() => selectTopic(topic)}
              />
            ))}
          </div>
        </aside>

        {/* Правая колонка: фразы */}
        <div className="min-w-0 flex-1">

          {activeTopic && topicState === "success" && (
            <div
              className="mb-4 flex flex-col gap-3 rounded-2xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
              style={{ background: T.navy, borderColor: T.lineCool }}
            >
              <div className="min-w-0">
                <h2 style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 700, color: T.text }}>
                  {activeTopic.title}
                </h2>
                <p style={{ fontSize: 12.5, color: T.textMut, marginTop: 3 }}>
                  {activeTopic.description || `${activeTopic.wordCount} фраз`}
                  {phrases.length > 0 && (
                    <> · в изучении {studiedInTopic}/{phrases.length}</>
                  )}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <div style={{
                  display: "flex", background: T.navy2, borderRadius: 10, padding: 3,
                  border: `1px solid ${T.lineCool}`,
                }}>
                  {([
                    { id: "lak-ru" as const, label: "Лак → RU" },
                    { id: "ru-lak" as const, label: "RU → Лак" },
                  ]).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      onClick={() => setDirectionPersist(d.id)}
                      style={{
                        padding: "5px 10px", borderRadius: 7, fontSize: 11.5, fontWeight: 600,
                        border: "none", cursor: "pointer", fontFamily: T.sans,
                        background: direction === d.id ? T.gold : "transparent",
                        color: direction === d.id ? T.bg : T.textMut,
                      }}
                    >
                      {d.label}
                    </button>
                  ))}
                </div>

                <button
                  type="button"
                  disabled={pendingCollectionIds.has(activeTopic.id)}
                  onClick={() => void handleToggleTopic(activeTopic.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    border: `1px solid ${selectedCollectionIds.has(activeTopic.id) ? "rgba(63,160,107,0.5)" : T.line}`,
                    background: selectedCollectionIds.has(activeTopic.id) ? T.greenDim : "transparent",
                    color: selectedCollectionIds.has(activeTopic.id) ? T.green : T.textMut,
                    cursor: "pointer", fontFamily: T.sans,
                  }}
                >
                  {pendingCollectionIds.has(activeTopic.id)
                    ? "…"
                    : selectedCollectionIds.has(activeTopic.id)
                      ? <><Check size={13} /> В изучении</>
                      : <><Plus size={13} /> В изучение</>}
                </button>

                <button
                  type="button"
                  disabled={startingPractice || activeTopic.wordCount === 0}
                  onClick={() => void handlePracticeTopic()}
                  style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "8px 14px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                    border: "none",
                    background: T.gold,
                    color: T.bg,
                    cursor: startingPractice ? "wait" : "pointer",
                    fontFamily: T.sans,
                    opacity: startingPractice ? 0.7 : 1,
                  }}
                >
                  <BookOpen size={13} />
                  {startingPractice ? "…" : "Учить тему"}
                </button>
              </div>
            </div>
          )}

          {phraseState === "loading" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} style={{ height: 140, borderRadius: 16, background: T.navy2, opacity: 0.4 + (i % 3) * 0.1 }} />
              ))}
            </div>
          )}

          {phraseState === "error" && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: T.textMut }}>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Не удалось загрузить фразы</p>
              <p style={{ fontSize: 13, color: T.textFaint, marginTop: 6 }}>Обновите страницу.</p>
            </div>
          )}

          {phraseState === "success" && displayedPhrases.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 20px", color: T.textMut }}>
              <p style={{ fontSize: 16, fontWeight: 600 }}>
                {q ? "Ничего не найдено в этой теме" : "В этой теме пока нет фраз"}
              </p>
            </div>
          )}

          {phraseState === "success" && displayedPhrases.length > 0 && viewMode === "cards" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))", gap: 12 }}>
              {displayedPhrases.map((phrase) => (
                <PhraseCard
                  key={phrase.id}
                  phrase={phrase}
                  direction={direction}
                  isSelected={selectedWordIds.has(phrase.id)}
                  isPending={pendingWordIds.has(phrase.id)}
                  onToggle={() => void handleTogglePhrase(phrase.id)}
                />
              ))}
            </div>
          )}

          {phraseState === "success" && displayedPhrases.length > 0 && viewMode === "list" && (
            <div style={{
              display: "flex", flexDirection: "column", gap: 2, borderRadius: 16,
              overflow: "hidden", border: `1px solid ${T.lineCool}`,
            }}>
              {displayedPhrases.map((phrase, idx) => {
                const isSelected = selectedWordIds.has(phrase.id);
                const isPending = pendingWordIds.has(phrase.id);
                const revealed = revealedListIds.has(phrase.id);
                const primary = direction === "lak-ru" ? phrase.lemma : phrase.translation;
                const secondary = direction === "lak-ru" ? phrase.translation : phrase.lemma;

                return (
                  <div
                    key={phrase.id}
                    role="button"
                    tabIndex={0}
                    aria-pressed={revealed}
                    onClick={() => setRevealedListIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(phrase.id)) next.delete(phrase.id);
                      else next.add(phrase.id);
                      return next;
                    })}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        setRevealedListIds((prev) => {
                          const next = new Set(prev);
                          if (next.has(phrase.id)) next.delete(phrase.id);
                          else next.add(phrase.id);
                          return next;
                        });
                      }
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 16, padding: "13px 18px",
                      background: idx % 2 === 0 ? T.navy : T.navy2,
                      borderBottom: idx < displayedPhrases.length - 1 ? `1px solid ${T.lineCool}` : "none",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: direction === "lak-ru" ? T.serif : T.sans,
                        fontSize: 15.5, fontWeight: 700, color: T.text,
                        whiteSpace: "normal", wordBreak: "break-word",
                      }}>
                        {primary}
                      </p>
                      {direction === "lak-ru" && phrase.transcription && (
                        <p style={{ fontFamily: T.mono, fontSize: 10, color: T.textFaint, marginTop: 2 }}>
                          [{phrase.transcription}]
                        </p>
                      )}
                      <p style={{
                        marginTop: 4, fontSize: 14,
                        color: revealed ? T.textMut : T.textFaint,
                        fontStyle: revealed ? "normal" : "italic",
                        whiteSpace: "normal", wordBreak: "break-word",
                      }}>
                        {revealed ? secondary : "нажми — перевод"}
                      </p>
                    </div>
                    <button
                      type="button"
                      aria-label={isSelected ? "Убрать из изучения" : "Добавить в изучение"}
                      onClick={(e) => { e.stopPropagation(); void handleTogglePhrase(phrase.id); }}
                      style={{
                        width: 28, height: 28, borderRadius: 8,
                        border: `1px solid ${isSelected ? "rgba(63,160,107,0.6)" : T.lineCool}`,
                        background: isSelected ? T.greenDim : "transparent",
                        color: isSelected ? T.green : T.textFaint,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", flexShrink: 0,
                      }}
                    >
                      {isPending ? <span style={{ fontSize: 9 }}>…</span> : isSelected ? <Check size={13} /> : <Plus size={13} />}
                    </button>
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
