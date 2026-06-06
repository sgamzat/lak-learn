"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStudySelection, setStudySelection } from "@/lib/api/client";
import {
  Search, Check, Plus, ChevronRight, Volume2, X, ArrowLeft,
} from "lucide-react";

// ─── Design tokens (matches DashboardShell) ───────────────────────────────────
const T = {
  ink:       "#0E1B2E",
  navy:      "#13243B",
  navy2:     "#1A2E49",
  navy3:     "#22395A",
  line:      "rgba(212,165,55,0.16)",
  lineCool:  "rgba(157,176,199,0.14)",
  gold:      "#D4A537",
  goldHi:    "#E7C66B",
  goldDim:   "rgba(212,165,55,0.12)",
  text:      "#F4EFE6",
  textMut:   "#9DB0C7",
  textFaint: "#5E728C",
  green:     "#3FA06B",
  greenDim:  "rgba(63,160,107,0.14)",
  blue:      "#3E86C9",
  red:       "#C2503F",
  sans:      "'Golos Text', system-ui, sans-serif",
  serif:     "'Spectral', Georgia, serif",
  mono:      "'IBM Plex Mono', ui-monospace, monospace",
};

// ─── Иконки тем (эмодзи + цвет) ──────────────────────────────────────────────
const TOPIC_META: Record<string, { emoji: string; color: string }> = {
  obrashchenie:    { emoji: "🤝", color: T.gold    },
  privetstvie:     { emoji: "👋", color: T.green   },
  proshchanie:     { emoji: "🌅", color: T.blue    },
  prosba:          { emoji: "🙏", color: T.gold    },
  blagodarnost:    { emoji: "💛", color: T.gold    },
  priglashenie:    { emoji: "🏠", color: T.green   },
  izvinenie:       { emoji: "🌸", color: "#E07BAE" },
  pozdravlenie:    { emoji: "🎉", color: T.gold    },
  sozhalenie:      { emoji: "💙", color: T.blue    },
  soglasie:        { emoji: "✅", color: T.green   },
  otkaz:           { emoji: "🚫", color: T.red     },
  voprosy:         { emoji: "❓", color: "#9B59B6" },
  otvety:          { emoji: "💬", color: T.blue    },
  znakomstvo:      { emoji: "🤗", color: T.gold    },
  semya:           { emoji: "👨‍👩‍👧", color: "#E07BAE" },
  vozrast:         { emoji: "🎂", color: T.gold    },
  professiya:      { emoji: "💼", color: T.blue    },
  vremya:          { emoji: "⏰", color: T.textMut },
  pogoda:          { emoji: "☁️", color: T.blue    },
  zdorove:         { emoji: "💊", color: T.green   },
  eda:             { emoji: "🍽️", color: "#E07BAE" },
  magazin:         { emoji: "🛒", color: T.gold    },
  transport:       { emoji: "🚌", color: T.blue    },
  "v-gorode":      { emoji: "🏙️", color: T.textMut },
  priroda:         { emoji: "🏔️", color: T.green   },
  "izuchenie-yazyka": { emoji: "📖", color: T.blue },
};

function getTopicMeta(slug: string) {
  return TOPIC_META[slug] ?? { emoji: "💬", color: T.blue };
}

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
};

type LoadState = "loading" | "success" | "error";

// ─── Компонент: карточка фразы ────────────────────────────────────────────────
function PhraseCard({
  phrase,
  isSelected,
  isPending,
  onToggle,
}: {
  phrase: PhraseWord;
  isSelected: boolean;
  isPending: boolean;
  onToggle: () => void;
}) {
  const [flipped, setFlipped] = useState(false);

  // Сброс флипа при смене фразы
  useEffect(() => { setFlipped(false); }, [phrase.id]);

  const isLong = phrase.lemma.length > 30;

  return (
    <div
      style={{
        perspective: "1000px",
        height: isLong ? 160 : 140,
        cursor: "pointer",
      }}
      onClick={() => setFlipped(f => !f)}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          height: "100%",
          transformStyle: "preserve-3d",
          transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
        }}
      >
        {/* ── Лицо (лакский) ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            background: T.navy2,
            border: `1px solid ${isSelected ? "rgba(63,160,107,0.5)" : T.lineCool}`,
            borderRadius: 16,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            boxShadow: isSelected ? `0 0 0 1px rgba(63,160,107,0.3)` : "none",
          }}
        >
          <div>
            <p
              style={{
                fontFamily: T.serif,
                fontSize: isLong ? 15 : 19,
                fontWeight: 700,
                color: T.text,
                lineHeight: 1.3,
                marginBottom: 6,
              }}
            >
              {phrase.lemma}
            </p>
            {phrase.transcription && (
              <p style={{ fontFamily: T.mono, fontSize: 11, color: T.textFaint }}>
                [ {phrase.transcription} ]
              </p>
            )}
          </div>

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 11, color: T.textFaint }}>
              нажми — перевод
            </span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onToggle(); }}
              style={{
                width: 28,
                height: 28,
                borderRadius: 8,
                border: `1px solid ${isSelected ? "rgba(63,160,107,0.6)" : T.lineCool}`,
                background: isSelected ? T.greenDim : "transparent",
                color: isSelected ? T.green : T.textFaint,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                transition: "all 0.15s",
                flexShrink: 0,
              }}
            >
              {isPending ? (
                <span style={{ fontSize: 9, color: T.textFaint }}>…</span>
              ) : isSelected ? (
                <Check size={13} />
              ) : (
                <Plus size={13} />
              )}
            </button>
          </div>
        </div>

        {/* ── Оборот (перевод) ── */}
        <div
          style={{
            position: "absolute",
            inset: 0,
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
            background: `linear-gradient(135deg, rgba(63,160,107,0.18), ${T.navy2})`,
            border: `1px solid rgba(63,160,107,0.35)`,
            borderRadius: 16,
            padding: "16px 18px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "center",
            alignItems: "flex-start",
            gap: 6,
          }}
        >
          <p
            style={{
              fontFamily: T.sans,
              fontSize: 17,
              fontWeight: 600,
              color: T.text,
              lineHeight: 1.3,
            }}
          >
            {phrase.translation}
          </p>
          <span style={{ fontSize: 11, color: T.green }}>← назад</span>
        </div>
      </div>
    </div>
  );
}

// ─── Компонент: карточка темы ─────────────────────────────────────────────────
function TopicCard({
  topic,
  isActive,
  isSelected,
  onClick,
}: {
  topic: Topic;
  isActive: boolean;
  isSelected: boolean;
  onClick: () => void;
}) {
  const meta = getTopicMeta(topic.slug);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%",
        textAlign: "left",
        background: isActive
          ? `linear-gradient(135deg, ${meta.color}22, ${T.navy2})`
          : T.navy,
        border: `1px solid ${isActive ? `${meta.color}55` : T.lineCool}`,
        borderRadius: 16,
        padding: "14px 16px",
        cursor: "pointer",
        transition: "all 0.18s",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Индикатор «добавлено в изучение» */}
      {isSelected && (
        <div
          style={{
            position: "absolute",
            top: 10,
            right: 10,
            width: 7,
            height: 7,
            borderRadius: "50%",
            background: T.green,
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>{meta.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p
            style={{
              fontFamily: T.sans,
              fontSize: 13.5,
              fontWeight: 600,
              color: isActive ? T.text : T.textMut,
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {topic.title}
          </p>
          <p style={{ fontSize: 11, color: T.textFaint, marginTop: 2 }}>
            {topic.wordCount} фраз
          </p>
        </div>
        <ChevronRight
          size={14}
          style={{
            color: isActive ? meta.color : T.textFaint,
            flexShrink: 0,
            transition: "color 0.15s",
          }}
        />
      </div>
    </button>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function PhrasebookPage() {
  const [allTopics, setAllTopics] = useState<Topic[]>([]);
  const [phrases, setPhrases] = useState<PhraseWord[]>([]);
  const [topicState, setTopicState] = useState<LoadState>("loading");
  const [phraseState, setPhraseState] = useState<LoadState>("loading");
  const [hasLoaded, setHasLoaded] = useState(false);

  const [activeTopic, setActiveTopic] = useState<Topic | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"cards" | "list">("cards");

  const [selectedWordIds, setSelectedWordIds] = useState<Set<number>>(new Set());
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<Set<number>>(new Set());
  const [pendingWordIds, setPendingWordIds] = useState<Set<number>>(new Set());
  const [pendingCollectionIds, setPendingCollectionIds] = useState<Set<number>>(new Set());

  const searchRef = useRef<HTMLInputElement>(null);

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
        const colData = await colRes.json() as { collections: Array<{ id: number; slug: string; title: string; description: string | null; level: string | null; wordCount: number; sortOrder: number }> };

        // Только разговорник: sortOrder <= 30
        const phrasebookCollections = (colData.collections ?? [])
          .filter(c => c.sortOrder <= 30)
          .map(c => ({
            id: c.id,
            slug: c.slug,
            title: c.title,
            description: c.description,
            level: c.level,
            wordCount: c.wordCount,
            sortOrder: c.sortOrder,
          }));

        setAllTopics(phrasebookCollections);
        setSelectedWordIds(new Set(selRes.wordIds));
        setSelectedCollectionIds(new Set(selRes.collectionIds));
        setTopicState("success");
        setHasLoaded(true);

        // Автовыбор первой темы
        if (phrasebookCollections.length > 0) {
          setActiveTopic(phrasebookCollections[0]);
        }
      } catch {
        setTopicState("error");
      }
    };
    void load();
  }, []);

  // ── Загрузка фраз по теме ─────────────────────────────────────────────────
  useEffect(() => {
    if (!activeTopic) { setPhrases([]); return; }

    const load = async () => {
      setPhraseState("loading");
      try {
        const p = new URLSearchParams({ limit: "200", collectionId: String(activeTopic.id) });
        const res = await fetch(`/api/words?${p}`, { headers: { Accept: "application/json" }, cache: "no-store" });
        if (!res.ok) throw new Error(`${res.status}`);
        const data = await res.json() as { words: PhraseWord[] };
        setPhrases(Array.isArray(data.words) ? data.words : []);
        setPhraseState("success");
      } catch {
        setPhraseState("error");
      }
    };
    void load();
  }, [activeTopic]);

  // ── Поиск ─────────────────────────────────────────────────────────────────
  const q = searchQuery.trim().toLowerCase();

  const displayedPhrases = useMemo(() => {
    if (!q) return phrases;
    return phrases.filter(p =>
      p.lemma.toLowerCase().includes(q) ||
      p.translation.toLowerCase().includes(q)
    );
  }, [phrases, q]);

  // ── Переключение изучения фразы ───────────────────────────────────────────
  const handleTogglePhrase = async (phraseId: number) => {
    const isSelected = selectedWordIds.has(phraseId);
    setPendingWordIds(p => new Set(p).add(phraseId));
    const next = new Set(selectedWordIds);
    isSelected ? next.delete(phraseId) : next.add(phraseId);
    setSelectedWordIds(next);
    try {
      const res = await setStudySelection("word", phraseId, !isSelected);
      setSelectedWordIds(new Set(res.wordIds));
      setSelectedCollectionIds(new Set(res.collectionIds));
    } catch {
      setSelectedWordIds(new Set(selectedWordIds));
    } finally {
      setPendingWordIds(p => { const n = new Set(p); n.delete(phraseId); return n; });
    }
  };

  // ── Переключение изучения темы целиком ────────────────────────────────────
  const handleToggleTopic = async (topicId: number) => {
    const isSelected = selectedCollectionIds.has(topicId);
    setPendingCollectionIds(p => new Set(p).add(topicId));
    const next = new Set(selectedCollectionIds);
    isSelected ? next.delete(topicId) : next.add(topicId);
    setSelectedCollectionIds(next);
    try {
      const res = await setStudySelection("collection", topicId, !isSelected);
      setSelectedWordIds(new Set(res.wordIds));
      setSelectedCollectionIds(new Set(res.collectionIds));
    } catch {
      setSelectedCollectionIds(new Set(selectedCollectionIds));
    } finally {
      setPendingCollectionIds(p => { const n = new Set(p); n.delete(topicId); return n; });
    }
  };

  const activeTopicMeta = activeTopic ? getTopicMeta(activeTopic.slug) : null;
  const isTopicSelected = activeTopic ? selectedCollectionIds.has(activeTopic.id) : false;
  const isTopicPending = activeTopic ? pendingCollectionIds.has(activeTopic.id) : false;

  // ─── Рендер ───────────────────────────────────────────────────────────────
  return (
    <>
      {/* Шрифты */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Spectral:wght@600;700;800&family=Golos+Text:wght@400;500;600;700&family=IBM+Plex+Mono&display=swap');
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: T.ink,
          fontFamily: T.sans,
          color: T.text,
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* ── HEADER ──────────────────────────────────────────────────────── */}
        <header
          style={{
            position: "sticky",
            top: 0,
            zIndex: 20,
            background: "rgba(14,27,46,0.92)",
            backdropFilter: "blur(14px)",
            borderBottom: `1px solid ${T.line}`,
            padding: "14px 24px",
            display: "flex",
            alignItems: "center",
            gap: 16,
          }}
        >
          <a
            href="/dashboard"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 13.5,
              color: T.textMut,
              textDecoration: "none",
              padding: "6px 12px",
              borderRadius: 10,
              border: `1px solid ${T.lineCool}`,
              transition: "color 0.15s",
            }}
          >
            <ArrowLeft size={14} />
            Главная
          </a>

          <div>
            <h1
              style={{
                fontFamily: T.serif,
                fontSize: 22,
                fontWeight: 700,
                color: T.text,
                lineHeight: 1,
              }}
            >
              Разговорник
            </h1>
            {hasLoaded && (
              <p style={{ fontSize: 12, color: T.textFaint, marginTop: 3 }}>
                {allTopics.length} тем · {selectedWordIds.size} фраз в изучении
              </p>
            )}
          </div>

          {/* Поиск */}
          <div
            style={{
              marginLeft: "auto",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: T.navy2,
              border: `1px solid ${T.lineCool}`,
              borderRadius: 12,
              padding: "7px 12px",
              width: 240,
            }}
          >
            <Search size={14} style={{ color: T.textFaint, flexShrink: 0 }} />
            <input
              ref={searchRef}
              type="search"
              placeholder="Поиск фраз..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{
                flex: 1,
                background: "transparent",
                border: "none",
                outline: "none",
                fontSize: 13.5,
                color: T.text,
                fontFamily: T.sans,
              }}
            />
            {q && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{ background: "none", border: "none", cursor: "pointer", color: T.textFaint, padding: 0, display: "flex" }}
              >
                <X size={13} />
              </button>
            )}
          </div>

          {/* Переключатель вида */}
          <div
            style={{
              display: "flex",
              background: T.navy,
              borderRadius: 10,
              padding: 3,
              border: `1px solid ${T.lineCool}`,
            }}
          >
            {(["cards", "list"] as const).map(mode => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                style={{
                  padding: "5px 12px",
                  borderRadius: 7,
                  fontSize: 12.5,
                  fontWeight: 600,
                  fontFamily: T.sans,
                  border: "none",
                  cursor: "pointer",
                  background: viewMode === mode ? T.gold : "transparent",
                  color: viewMode === mode ? T.ink : T.textMut,
                  transition: "all 0.15s",
                }}
              >
                {mode === "cards" ? "Карточки" : "Список"}
              </button>
            ))}
          </div>
        </header>

        {/* ── ОСНОВНАЯ СЕТКА ──────────────────────────────────────────────── */}
        <div
          style={{
            display: "flex",
            flex: 1,
            maxWidth: 1280,
            width: "100%",
            margin: "0 auto",
            padding: "20px 24px",
            gap: 24,
            alignItems: "flex-start",
          }}
        >
          {/* ── ЛЕВАЯ КОЛОНКА: Темы ─────────────────────────────────────── */}
          <aside
            style={{
              width: 240,
              flexShrink: 0,
              position: "sticky",
              top: 72,
              maxHeight: "calc(100vh - 92px)",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 6,
              paddingRight: 4,
            }}
          >
            <p
              style={{
                fontSize: 10.5,
                fontWeight: 700,
                letterSpacing: "0.1em",
                textTransform: "uppercase",
                color: T.textFaint,
                marginBottom: 6,
                paddingLeft: 4,
              }}
            >
              Темы
            </p>

            {topicState === "loading" && (
              Array.from({ length: 8 }, (_, i) => (
                <div
                  key={i}
                  style={{
                    height: 58,
                    borderRadius: 16,
                    background: T.navy2,
                    animation: "pulse 1.5s ease-in-out infinite",
                  }}
                />
              ))
            )}

            {topicState === "success" && allTopics.map(topic => (
              <TopicCard
                key={topic.id}
                topic={topic}
                isActive={activeTopic?.id === topic.id}
                isSelected={selectedCollectionIds.has(topic.id)}
                onClick={() => setActiveTopic(topic)}
              />
            ))}

            {topicState === "error" && (
              <p style={{ fontSize: 13, color: T.red, padding: "8px 4px" }}>
                Ошибка загрузки
              </p>
            )}
          </aside>

          {/* ── ПРАВАЯ КОЛОНКА: Фразы ───────────────────────────────────── */}
          <main style={{ flex: 1, minWidth: 0 }}>

            {/* Заголовок активной темы */}
            {activeTopic && activeTopicMeta && (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 20,
                  paddingBottom: 16,
                  borderBottom: `1px solid ${T.lineCool}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <span
                    style={{
                      fontSize: 36,
                      lineHeight: 1,
                      filter: "drop-shadow(0 2px 8px rgba(0,0,0,0.3))",
                    }}
                  >
                    {activeTopicMeta.emoji}
                  </span>
                  <div>
                    <h2
                      style={{
                        fontFamily: T.serif,
                        fontSize: 26,
                        fontWeight: 700,
                        color: T.text,
                        lineHeight: 1,
                      }}
                    >
                      {activeTopic.title}
                    </h2>
                    {activeTopic.description && (
                      <p style={{ fontSize: 13, color: T.textMut, marginTop: 4 }}>
                        {activeTopic.description}
                      </p>
                    )}
                  </div>
                </div>

                {/* Кнопка «Учить тему» */}
                <button
                  type="button"
                  onClick={() => void handleToggleTopic(activeTopic.id)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 7,
                    padding: "9px 18px",
                    borderRadius: 12,
                    border: `1px solid ${isTopicSelected ? "rgba(63,160,107,0.5)" : T.lineCool}`,
                    background: isTopicSelected ? T.greenDim : T.navy2,
                    color: isTopicSelected ? T.green : T.textMut,
                    fontSize: 13.5,
                    fontWeight: 600,
                    fontFamily: T.sans,
                    cursor: "pointer",
                    transition: "all 0.18s",
                    flexShrink: 0,
                  }}
                >
                  {isTopicPending ? (
                    <span style={{ fontSize: 12 }}>…</span>
                  ) : isTopicSelected ? (
                    <><Check size={14} /> Изучается</>
                  ) : (
                    <><Plus size={14} /> Учить тему</>
                  )}
                </button>
              </div>
            )}

            {/* Статус */}
            {phraseState === "success" && (
              <p style={{ fontSize: 12, color: T.textFaint, marginBottom: 14 }}>
                {q
                  ? `Найдено ${displayedPhrases.length} из ${phrases.length}`
                  : `${displayedPhrases.length} фраз`}
              </p>
            )}

            {/* Загрузка фраз */}
            {phraseState === "loading" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                {Array.from({ length: 8 }, (_, i) => (
                  <div
                    key={i}
                    style={{
                      height: 140,
                      borderRadius: 16,
                      background: T.navy2,
                      opacity: 1 - i * 0.08,
                    }}
                  />
                ))}
              </div>
            )}

            {/* Ошибка */}
            {phraseState === "error" && (
              <div
                style={{
                  padding: 24,
                  borderRadius: 16,
                  background: "rgba(194,80,63,0.1)",
                  border: `1px solid rgba(194,80,63,0.3)`,
                  color: T.red,
                  fontSize: 14,
                }}
              >
                Не удалось загрузить фразы. Обновите страницу.
              </div>
            )}

            {/* Пусто */}
            {phraseState === "success" && displayedPhrases.length === 0 && (
              <div
                style={{
                  textAlign: "center",
                  padding: "60px 20px",
                  color: T.textMut,
                }}
              >
                <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
                <p style={{ fontSize: 16, fontWeight: 600 }}>
                  {q ? "Ничего не найдено" : "В этой теме пока нет фраз"}
                </p>
              </div>
            )}

            {/* ── Режим: КАРТОЧКИ ─────────────────────────────────────── */}
            {phraseState === "success" && displayedPhrases.length > 0 && viewMode === "cards" && (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
                  gap: 12,
                }}
              >
                {displayedPhrases.map(phrase => (
                  <PhraseCard
                    key={phrase.id}
                    phrase={phrase}
                    isSelected={selectedWordIds.has(phrase.id)}
                    isPending={pendingWordIds.has(phrase.id)}
                    onToggle={() => void handleTogglePhrase(phrase.id)}
                  />
                ))}
              </div>
            )}

            {/* ── Режим: СПИСОК ───────────────────────────────────────── */}
            {phraseState === "success" && displayedPhrases.length > 0 && viewMode === "list" && (
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 2,
                  borderRadius: 16,
                  overflow: "hidden",
                  border: `1px solid ${T.lineCool}`,
                }}
              >
                {displayedPhrases.map((phrase, idx) => {
                  const isSelected = selectedWordIds.has(phrase.id);
                  const isPending = pendingWordIds.has(phrase.id);
                  return (
                    <div
                      key={phrase.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 16,
                        padding: "13px 18px",
                        background: idx % 2 === 0 ? T.navy : T.navy2,
                        borderBottom: idx < displayedPhrases.length - 1
                          ? `1px solid ${T.lineCool}` : "none",
                        transition: "background 0.15s",
                      }}
                    >
                      {/* Лакский */}
                      <div style={{ flex: "0 0 42%", minWidth: 0 }}>
                        <p
                          style={{
                            fontFamily: T.serif,
                            fontSize: 15.5,
                            fontWeight: 700,
                            color: T.text,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {phrase.lemma}
                        </p>
                        {phrase.transcription && (
                          <p style={{ fontFamily: T.mono, fontSize: 10, color: T.textFaint, marginTop: 2 }}>
                            [{phrase.transcription}]
                          </p>
                        )}
                      </div>

                      {/* Перевод */}
                      <p
                        style={{
                          flex: 1,
                          fontSize: 14,
                          color: T.textMut,
                          minWidth: 0,
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {phrase.translation}
                      </p>

                      {/* Кнопка изучения */}
                      <button
                        type="button"
                        onClick={() => void handleTogglePhrase(phrase.id)}
                        style={{
                          width: 28,
                          height: 28,
                          borderRadius: 8,
                          border: `1px solid ${isSelected ? "rgba(63,160,107,0.6)" : T.lineCool}`,
                          background: isSelected ? T.greenDim : "transparent",
                          color: isSelected ? T.green : T.textFaint,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                          flexShrink: 0,
                          transition: "all 0.15s",
                        }}
                      >
                        {isPending ? (
                          <span style={{ fontSize: 9 }}>…</span>
                        ) : isSelected ? (
                          <Check size={12} />
                        ) : (
                          <Plus size={12} />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </main>
        </div>
      </div>

      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 0.6; }
          50% { opacity: 0.3; }
        }
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(157,176,199,0.2); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(157,176,199,0.35); }
        input[type='search']::-webkit-search-cancel-button { display: none; }
      `}</style>
    </>
  );
}