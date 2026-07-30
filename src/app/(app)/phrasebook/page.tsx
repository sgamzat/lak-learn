"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { getStudySelection, setStudySelection } from "@/lib/api/client";
import {
  Search, Check, Plus, ChevronRight, Volume2, X, ArrowLeft,
} from "lucide-react";
import { useTheme } from "@/components/ThemeProvider";

// ─── Иконки тем (эмодзи + цвет) ──────────────────────────────────────────────
// Цвета здесь статичные — они привязаны к смыслу темы, а не к UI-теме
const TOPIC_META: Record<string, { emoji: string; color: string }> = {
  obrashchenie:       { emoji: "🤝", color: "#D4A537" },
  privetstvie:        { emoji: "👋", color: "#3FA06B" },
  proshchanie:        { emoji: "🌅", color: "#3E86C9" },
  prosba:             { emoji: "🙏", color: "#D4A537" },
  blagodarnost:       { emoji: "💛", color: "#D4A537" },
  priglashenie:       { emoji: "🏠", color: "#3FA06B" },
  izvinenie:          { emoji: "🌸", color: "#E07BAE" },
  pozdravlenie:       { emoji: "🎉", color: "#D4A537" },
  sozhalenie:         { emoji: "💙", color: "#3E86C9" },
  soglasie:           { emoji: "✅", color: "#3FA06B" },
  otkaz:              { emoji: "🚫", color: "#C2503F" },
  voprosy:            { emoji: "❓", color: "#9B59B6" },
  otvety:             { emoji: "💬", color: "#3E86C9" },
  znakomstvo:         { emoji: "🤗", color: "#D4A537" },
  semya:              { emoji: "👨‍👩‍👧", color: "#E07BAE" },
  vozrast:            { emoji: "🎂", color: "#D4A537" },
  professiya:         { emoji: "💼", color: "#3E86C9" },
  vremya:             { emoji: "⏰", color: "#9DB0C7" },
  pogoda:             { emoji: "☁️", color: "#3E86C9" },
  zdorove:            { emoji: "💊", color: "#3FA06B" },
  eda:                { emoji: "🍽️", color: "#E07BAE" },
  magazin:            { emoji: "🛒", color: "#D4A537" },
  transport:          { emoji: "🚌", color: "#3E86C9" },
  "v-gorode":         { emoji: "🏙️", color: "#9DB0C7" },
  priroda:            { emoji: "🏔️", color: "#3FA06B" },
  "izuchenie-yazyka": { emoji: "📖", color: "#3E86C9" },
};

function getTopicMeta(slug: string) {
  return TOPIC_META[slug] ?? { emoji: "💬", color: "#3E86C9" };
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
  phrase, isSelected, isPending, onToggle,
}: {
  phrase: PhraseWord; isSelected: boolean; isPending: boolean; onToggle: () => void;
}) {
  const { tokens: T } = useTheme();
  const [flipped, setFlipped] = useState(false);
  useEffect(() => { setFlipped(false); }, [phrase.id]);
  const isLong = phrase.lemma.length > 30;

  return (
    <div
      style={{ perspective: "1000px", height: isLong ? 160 : 140, cursor: "pointer" }}
      onClick={() => setFlipped(f => !f)}
    >
      <div style={{
        position: "relative", width: "100%", height: "100%",
        transformStyle: "preserve-3d",
        transition: "transform 0.45s cubic-bezier(0.4, 0, 0.2, 1)",
        transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
      }}>
        {/* Лицо (лакский) */}
        <div style={{
          position: "absolute", inset: 0,
          backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          background: T.navy2,
          border: `1px solid ${isSelected ? "rgba(63,160,107,0.5)" : T.lineCool}`,
          borderRadius: 16, padding: "16px 18px",
          display: "flex", flexDirection: "column", justifyContent: "space-between",
          boxShadow: isSelected ? "0 0 0 1px rgba(63,160,107,0.3)" : "none",
          transition: "background 0.4s, border-color 0.4s",
        }}>
          <div>
            <p style={{
              fontFamily: T.serif,
              fontSize: isLong ? 14 : 17,
              fontWeight: 700, color: T.text, lineHeight: 1.35,
              transition: "color 0.4s",
            }}>
              {phrase.lemma}
            </p>
            {phrase.transcription && (
              <p style={{ fontFamily: T.mono, fontSize: 11, color: T.textFaint, marginTop: 3, transition: "color 0.4s" }}>
                [{phrase.transcription}]
              </p>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <span style={{ fontSize: 10, color: T.textFaint, transition: "color 0.4s" }}>нажми — перевод</span>
            <button
              type="button"
              onClick={e => { e.stopPropagation(); onToggle(); }}
              style={{
                width: 28, height: 28, borderRadius: 8,
                border: `1px solid ${isSelected ? "rgba(63,160,107,0.6)" : T.lineCool}`,
                background: isSelected ? T.greenDim : "transparent",
                color: isSelected ? T.green : T.textFaint,
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", flexShrink: 0, transition: "all 0.15s",
              }}
            >
              {isPending
                ? <span style={{ fontSize: 9, color: T.textFaint }}>…</span>
                : isSelected ? <Check size={13} /> : <Plus size={13} />}
            </button>
          </div>
        </div>

        {/* Оборот (перевод) */}
        <div style={{
          position: "absolute", inset: 0,
          backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden",
          transform: "rotateY(180deg)",
          background: `linear-gradient(135deg, rgba(63,160,107,0.18), ${T.navy2})`,
          border: `1px solid rgba(63,160,107,0.35)`,
          borderRadius: 16, padding: "16px 18px",
          display: "flex", flexDirection: "column", justifyContent: "center",
          alignItems: "flex-start", gap: 6,
          transition: "background 0.4s",
        }}>
          <p style={{ fontFamily: T.sans, fontSize: 17, fontWeight: 600, color: T.text, lineHeight: 1.3, transition: "color 0.4s" }}>
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
  topic, isActive, isSelected, onClick,
}: {
  topic: Topic; isActive: boolean; isSelected: boolean; onClick: () => void;
}) {
  const { tokens: T } = useTheme();
  const meta = getTopicMeta(topic.slug);

  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%", textAlign: "left",
        background: isActive ? `linear-gradient(135deg, ${meta.color}22, ${T.navy2})` : T.navy,
        border: `1px solid ${isActive ? `${meta.color}55` : T.lineCool}`,
        borderRadius: 16, padding: "14px 16px",
        cursor: "pointer", transition: "all 0.18s",
        position: "relative", overflow: "hidden",
      }}
    >
      {isSelected && (
        <div style={{ position: "absolute", top: 10, right: 10, width: 7, height: 7, borderRadius: "50%", background: T.green }} />
      )}
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 24, lineHeight: 1 }}>{meta.emoji}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{
            fontFamily: T.sans, fontSize: 13.5, fontWeight: 600,
            color: isActive ? T.text : T.textMut,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            transition: "color 0.4s",
          }}>
            {topic.title}
          </p>
          <p style={{ fontSize: 11, color: T.textFaint, marginTop: 2, transition: "color 0.4s" }}>
            {topic.wordCount} фраз
          </p>
        </div>
        <ChevronRight size={14} style={{ color: isActive ? meta.color : T.textFaint, flexShrink: 0, transition: "color 0.15s" }} />
      </div>
    </button>
  );
}

// ─── Главный компонент ────────────────────────────────────────────────────────
export default function PhrasebookPage() {
  const { tokens: T } = useTheme();

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

        const phrasebookCollections = (colData.collections ?? [])
          .filter(c => c.sortOrder <= 30)
          .map(c => ({ id: c.id, slug: c.slug, title: c.title, description: c.description, level: c.level, wordCount: c.wordCount, sortOrder: c.sortOrder }));

        setAllTopics(phrasebookCollections);
        setSelectedWordIds(new Set(selRes.wordIds));
        setSelectedCollectionIds(new Set(selRes.collectionIds));
        setTopicState("success");
        setHasLoaded(true);
        if (phrasebookCollections.length > 0) setActiveTopic(phrasebookCollections[0] ?? null);
      } catch { setTopicState("error"); }
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
      } catch { setPhraseState("error"); }
    };
    void load();
  }, [activeTopic]);

  const q = searchQuery.trim().toLowerCase();
  const displayedPhrases = useMemo(() => {
    if (!q) return phrases;
    return phrases.filter(p => p.lemma.toLowerCase().includes(q) || p.translation.toLowerCase().includes(q));
  }, [phrases, q]);

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
    } catch { setSelectedWordIds(new Set(selectedWordIds)); }
    finally { setPendingWordIds(p => { const n = new Set(p); n.delete(phraseId); return n; }); }
  };

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
    } catch { setSelectedCollectionIds(new Set(selectedCollectionIds)); }
    finally { setPendingCollectionIds(p => { const n = new Set(p); n.delete(topicId); return n; }); }
  };

  // ── Рендер ────────────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-screen flex-col bg-lk-bg font-sans text-lk-text transition-colors duration-[400ms]">

      {/* ── Хедер ── */}
      <header className="sticky top-0 z-30 flex h-[60px] items-center gap-4 border-b border-lk-line bg-lk-bg/93 px-6 backdrop-blur-[12px] transition-colors duration-[400ms]">
        <a href="/dashboard" className="flex items-center gap-1.5 rounded-[10px] border border-lk-line-cool px-2.5 py-1 text-[13px] text-lk-muted no-underline transition-colors duration-150">
          <ArrowLeft size={14} /> Главная
        </a>
        <div>
          <h1 className="font-serif text-[22px] font-bold leading-none text-lk-text transition-colors duration-[400ms]">Разговорник</h1>
          {hasLoaded && <p className="mt-0.5 text-xs text-lk-faint transition-colors duration-[400ms]">{allTopics.length} тем · {selectedWordIds.size} фраз в изучении</p>}
        </div>

        {/* Поиск */}
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, background: T.navy2, border: `1px solid ${T.lineCool}`, borderRadius: 12, padding: "7px 12px", width: 240, transition: "background 0.4s" }}>
          <Search size={14} style={{ color: T.textFaint, flexShrink: 0 }} />
          <input
            ref={searchRef} type="search" placeholder="Поиск фраз..."
            value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            style={{ flex: 1, background: "transparent", border: "none", outline: "none", fontSize: 13.5, color: T.text, fontFamily: T.sans }}
          />
          {q && (
            <button type="button" onClick={() => setSearchQuery("")} style={{ background: "none", border: "none", cursor: "pointer", color: T.textFaint, padding: 0, display: "flex" }}>
              <X size={13} />
            </button>
          )}
        </div>

        {/* Переключатель вида */}
        <div style={{ display: "flex", background: T.navy, borderRadius: 10, padding: 3, border: `1px solid ${T.lineCool}`, transition: "background 0.4s" }}>
          {(["cards", "list"] as const).map(mode => (
            <button key={mode} type="button" onClick={() => setViewMode(mode)} style={{
              padding: "5px 12px", borderRadius: 7, fontSize: 12.5, fontWeight: 600,
              fontFamily: T.sans, border: "none", cursor: "pointer",
              background: viewMode === mode ? T.gold : "transparent",
              color: viewMode === mode ? T.bg : T.textMut,
              transition: "all 0.15s",
            }}>
              {mode === "cards" ? "Карточки" : "Список"}
            </button>
          ))}
        </div>
      </header>

      {/* ── Основная сетка ── */}
      <div style={{ display: "flex", flex: 1, maxWidth: 1280, width: "100%", margin: "0 auto", padding: "20px 24px", gap: 24, alignItems: "flex-start" }}>

        {/* Левая колонка: темы */}
        <aside style={{ width: 240, flexShrink: 0, position: "sticky", top: 72, maxHeight: "calc(100vh - 92px)", overflowY: "auto", display: "flex", flexDirection: "column", gap: 6, paddingRight: 4 }}>
          <p style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase" as const, color: T.textFaint, marginBottom: 6, paddingLeft: 4, transition: "color 0.4s" }}>Темы</p>

          {topicState === "loading" && Array.from({ length: 8 }, (_, i) => (
            <div key={i} style={{ height: 70, borderRadius: 16, background: T.navy2, opacity: 0.5 + i * 0.05 }} />
          ))}

          {topicState === "error" && (
            <p style={{ fontSize: 13, color: T.red, padding: "8px 4px" }}>Не удалось загрузить темы.</p>
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
        </aside>

        {/* Правая колонка: фразы */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Заголовок темы */}
          {activeTopic && topicState === "success" && (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div>
                <h2 style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 700, color: T.text, transition: "color 0.4s" }}>{activeTopic.title}</h2>
                {activeTopic.description && <p style={{ fontSize: 13, color: T.textMut, marginTop: 3, transition: "color 0.4s" }}>{activeTopic.description}</p>}
              </div>
              <button
                type="button"
                disabled={pendingCollectionIds.has(activeTopic.id)}
                onClick={() => void handleToggleTopic(activeTopic.id)}
                style={{
                  display: "flex", alignItems: "center", gap: 6,
                  padding: "8px 16px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                  border: `1px solid ${selectedCollectionIds.has(activeTopic.id) ? "rgba(63,160,107,0.5)" : T.line}`,
                  background: selectedCollectionIds.has(activeTopic.id) ? T.greenDim : "transparent",
                  color: selectedCollectionIds.has(activeTopic.id) ? T.green : T.textMut,
                  cursor: "pointer", fontFamily: T.sans, transition: "all 0.2s",
                }}
              >
                {pendingCollectionIds.has(activeTopic.id)
                  ? "…"
                  : selectedCollectionIds.has(activeTopic.id)
                  ? <><Check size={13} /> Добавлено</>
                  : <><Plus size={13} /> Добавить тему</>}
              </button>
            </div>
          )}

          {/* Загрузка */}
          {phraseState === "loading" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {Array.from({ length: 12 }, (_, i) => (
                <div key={i} style={{ height: 140, borderRadius: 16, background: T.navy2, opacity: 0.4 + (i % 3) * 0.1 }} />
              ))}
            </div>
          )}

          {/* Ошибка */}
          {phraseState === "error" && (
            <div style={{ textAlign: "center" as const, padding: "60px 20px", color: T.textMut }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>⚠️</p>
              <p style={{ fontSize: 16, fontWeight: 600 }}>Не удалось загрузить фразы</p>
              <p style={{ fontSize: 13, color: T.textFaint, marginTop: 6 }}>Обновите страницу.</p>
            </div>
          )}

          {/* Пусто */}
          {phraseState === "success" && displayedPhrases.length === 0 && (
            <div style={{ textAlign: "center" as const, padding: "60px 20px", color: T.textMut }}>
              <p style={{ fontSize: 40, marginBottom: 12 }}>🔍</p>
              <p style={{ fontSize: 16, fontWeight: 600 }}>{q ? "Ничего не найдено" : "В этой теме пока нет фраз"}</p>
            </div>
          )}

          {/* Карточки */}
          {phraseState === "success" && displayedPhrases.length > 0 && viewMode === "cards" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
              {displayedPhrases.map(phrase => (
                <PhraseCard
                  key={phrase.id} phrase={phrase}
                  isSelected={selectedWordIds.has(phrase.id)}
                  isPending={pendingWordIds.has(phrase.id)}
                  onToggle={() => void handleTogglePhrase(phrase.id)}
                />
              ))}
            </div>
          )}

          {/* Список */}
          {phraseState === "success" && displayedPhrases.length > 0 && viewMode === "list" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 2, borderRadius: 16, overflow: "hidden", border: `1px solid ${T.lineCool}`, transition: "border-color 0.4s" }}>
              {displayedPhrases.map((phrase, idx) => {
                const isSelected = selectedWordIds.has(phrase.id);
                const isPending  = pendingWordIds.has(phrase.id);
                return (
                  <div key={phrase.id} style={{
                    display: "flex", alignItems: "center", gap: 16, padding: "13px 18px",
                    background: idx % 2 === 0 ? T.navy : T.navy2,
                    borderBottom: idx < displayedPhrases.length - 1 ? `1px solid ${T.lineCool}` : "none",
                    transition: "background 0.4s",
                  }}>
                    {/* Лакский */}
                    <div style={{ flex: "0 0 42%", minWidth: 0 }}>
                      <p style={{ fontFamily: T.serif, fontSize: 15.5, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "color 0.4s" }}>
                        {phrase.lemma}
                      </p>
                      {phrase.transcription && (
                        <p style={{ fontFamily: T.mono, fontSize: 10, color: T.textFaint, marginTop: 2, transition: "color 0.4s" }}>
                          [{phrase.transcription}]
                        </p>
                      )}
                    </div>
                    {/* Перевод */}
                    <p style={{ flex: 1, fontSize: 14, color: T.textMut, minWidth: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", transition: "color 0.4s" }}>
                      {phrase.translation}
                    </p>
                    {/* Кнопка */}
                    <button
                      type="button"
                      onClick={() => void handleTogglePhrase(phrase.id)}
                      style={{
                        width: 28, height: 28, borderRadius: 8,
                        border: `1px solid ${isSelected ? "rgba(63,160,107,0.6)" : T.lineCool}`,
                        background: isSelected ? T.greenDim : "transparent",
                        color: isSelected ? T.green : T.textFaint,
                        display: "flex", alignItems: "center", justifyContent: "center",
                        cursor: "pointer", flexShrink: 0, transition: "all 0.15s",
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