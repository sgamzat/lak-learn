"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Flame, Target, ArrowRight } from "lucide-react";
import { getDashboardData } from "@/lib/api/client";
import type { CollectionProgress, DashboardData, TopicStatus } from "@/types/dashboard";
import { useTheme } from "@/components/ThemeProvider";

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

function PabakoMini({ size = 28, gold }: { size?: number; gold: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" style={{ display: "block", flexShrink: 0 }}>
      <polygon points="2,22 8,13 14,22" fill="rgba(0,0,0,0.25)" />
      <polygon points="14,22 20,15 26,22" fill="rgba(0,0,0,0.25)" />
      <polygon points="2,22 14,4 26,22" fill={gold} />
      <polygon points="2,22 14,4 14,22" fill="#A07820" />
      <polygon points="14,4 11,11 14,9 17,11" fill="#ECE4CC" />
    </svg>
  );
}

function Mountains({ T }: { T: ReturnType<typeof useTheme>["tokens"] }) {
  return (
    <svg width="100%" height="120" viewBox="0 0 600 180" preserveAspectRatio="none" style={{ display: "block" }}>
      <polygon points="0,180 120,70 240,180" fill={T.navy3} opacity="0.7" />
      <polygon points="160,180 320,40 480,180" fill={T.navy3} opacity="0.85" />
      <polygon points="360,180 480,90 600,180" fill={T.navy3} opacity="0.7" />
      <polygon points="-40,180 150,80 360,180" fill={T.navy2} />
      <polygon points="240,180 430,55 620,180" fill={T.navy2} />
      <polygon points="430,55 405,93 418,86 430,98 442,86 455,93" fill={T.snow} opacity="0.9" />
      <polygon points="150,80 132,108 142,102 150,112 158,102 168,108" fill={T.snow} opacity="0.8" />
    </svg>
  );
}

function heroCta(data: DashboardData, totalSRS: number): {
  href: string;
  label: string;
  secondary?: { href: string; label: string };
} {
  if (data.progress.lessonsCompleted === 0) {
    return { href: "/letters", label: "К алфавиту →" };
  }
  if (totalSRS > 0) {
    return { href: "/review", label: "Начать повторение →" };
  }
  if (data.srsSummary.newAvailable > 0) {
    return { href: "/review", label: "Учить новые →" };
  }
  if (!data.srsSummary.hasStudySelection) {
    return {
      href: "/phrasebook",
      label: "Открыть разговорник →",
      secondary: { href: "/dictionary", label: "Словарь" },
    };
  }
  return {
    href: "/dictionary",
    label: "Открыть словарь →",
    secondary: { href: "/phrasebook", label: "Разговорник" },
  };
}

function formatRelativeReviewedAt(iso: string | null, now = Date.now()): string | null {
  if (!iso) return null;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return null;
  const diffMs = Math.max(0, now - ts);
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "только что";
  if (mins < 60) return `${mins} мин. назад`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ч. назад`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "вчера";
  if (days < 7) return `${days} дн. назад`;
  if (days < 30) return `${Math.floor(days / 7)} нед. назад`;
  return new Date(ts).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

function topicStatusLabel(status: TopicStatus): string {
  switch (status) {
    case "needs_review":
      return "Нужно повторить";
    case "in_progress":
      return "В процессе";
    case "mastered":
      return "Освоено";
    default:
      return "Не начато";
  }
}

function topicHref(col: CollectionProgress): string {
  return `/review?collectionId=${col.id}&from=dashboard`;
}

function topicCtaLabel(col: CollectionProgress): string {
  if (col.dueWords > 0) return `Повторить ${col.dueWords}`;
  if (col.newWords > 0 && col.knownWords + col.learningWords + col.weakWords === 0) {
    return "Начать";
  }
  if (col.newWords > 0) return "Учить новые";
  if (col.status === "mastered") return "Повторить";
  return "Продолжить";
}

function topicsSummary(collections: CollectionProgress[]): string | null {
  if (collections.length === 0) return null;
  const inWork = collections.filter(
    (c) => c.status === "in_progress" || c.status === "needs_review"
  ).length;
  const dueTotal = collections.reduce((sum, c) => sum + c.dueWords, 0);
  const weakest = [...collections]
    .filter((c) => c.weakWords > 0 || c.status === "needs_review")
    .sort((a, b) => b.weakWords - a.weakWords || b.dueWords - a.dueWords)[0];

  const parts: string[] = [];
  if (inWork > 0) {
    parts.push(`${inWork} ${inWork === 1 ? "тема" : inWork < 5 ? "темы" : "тем"} в работе`);
  } else {
    const started = collections.filter((c) => c.status !== "not_started").length;
    if (started === 0) parts.push("Выберите тему в разговорнике, чтобы начать");
    else parts.push("Все активные темы в порядке");
  }
  if (dueTotal > 0) {
    parts.push(`${dueTotal} ${dueTotal === 1 ? "карточка ждёт" : "карточек ждут"}`);
  }
  if (weakest && (weakest.weakWords > 0 || weakest.dueWords > 0)) {
    parts.push(`слабее всего «${weakest.title}»`);
  }
  return parts.join(" · ");
}

function dueSplitLabel(dueWords: number, duePhrases: number): string | null {
  if (dueWords <= 0 && duePhrases <= 0) return null;
  const parts: string[] = [];
  if (duePhrases > 0) {
    parts.push(`${duePhrases} ${duePhrases === 1 ? "фраза" : duePhrases < 5 ? "фразы" : "фраз"}`);
  }
  if (dueWords > 0) {
    parts.push(`${dueWords} ${dueWords === 1 ? "слово" : dueWords < 5 ? "слова" : "слов"}`);
  }
  return parts.join(" · ");
}

export function DashboardShell() {
  const { tokens: T, isDark } = useTheme();

  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [onboardingStep, setOnboardingStep] = useState<0 | 1 | 2 | 3>(0);
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingGoal, setOnboardingGoal] = useState<5 | 10 | 15>(10);
  const [onboardingSaving, setOnboardingSaving] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await getDashboardData();
        if (mounted) {
          setData(res);
          setIsLoading(false);
        }
      } catch {
        if (mounted) {
          setData(null);
          setIsLoading(false);
        }
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    const onVis = () => {
      if (document.visibilityState === "visible") void load();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => {
      mounted = false;
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  useEffect(() => {
    if (!data) return;
    const isNew = data.progress.lessonsCompleted === 0 && data.profile.xp === 0;
    const seen = typeof window !== "undefined" && localStorage.getItem("laklearn_onboarding_done") === "1";
    if (isNew && !seen) {
      const n = data.profile.name;
      if (!n.includes("@") && !/^[a-z0-9._-]+$/i.test(n)) setOnboardingName(n);
      setOnboardingStep(1);
    }
  }, [data]);

  const totalSRS = useMemo(
    () => (data ? data.srsSummary.overdue + data.srsSummary.dueSoon : 0),
    [data]
  );

  const greetingSubtitle = useMemo(() => {
    if (!data) return "";
    if (data.progress.lessonsCompleted === 0) return "Марха бур! Начните с алфавита — это займёт 5 минут.";
    if (totalSRS === 0 && data.srsSummary.newAvailable > 0) {
      return `${data.srsSummary.newAvailable} новых карточек готовы к изучению.`;
    }
    if (totalSRS === 0) return "Сегодня всё повторено. Отличная работа!";
    const split = dueSplitLabel(data.srsSummary.dueWords, data.srsSummary.duePhrases);
    if (data.srsSummary.overdue > 0) {
      return split
        ? `${data.srsSummary.overdue} просрочено (${split}) — освежи, пока помнишь.`
        : `${data.srsSummary.overdue} карточек просрочено — освежи, пока помнишь.`;
    }
    return split
      ? `${totalSRS} карточек ждут: ${split}.`
      : `${totalSRS} карточек ждут повторения — один присест, пять минут.`;
  }, [data, totalSRS]);

  const card: React.CSSProperties = { background: T.navy2, border: `1px solid ${T.line}`, borderRadius: 18 };
  const topics = data?.collections.slice(0, 6) ?? [];
  const topicsLine = data ? topicsSummary(data.collections) : null;

  const finishOnboarding = async () => {
    setOnboardingSaving(true);
    try {
      const n = onboardingName.trim();
      if (n) {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: n }),
        });
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("laklearn_onboarding_done", "1");
        localStorage.setItem("laklearn_daily_goal", String(onboardingGoal));
      }
    } catch {
      /* ignore */
    } finally {
      setOnboardingSaving(false);
      setOnboardingStep(0);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <div className="flex flex-col items-center gap-[18px]">
          <PabakoMini size={56} gold={T.gold} />
          <span className="font-sans text-sm text-lk-faint">Загрузка…</span>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center font-sans">
        <div className="text-center text-lk-muted">
          <p className="text-base">Не удалось загрузить данные</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-4 cursor-pointer rounded-[10px] border-none bg-lk-gold px-5 py-2.5 font-sans font-bold text-lk-bg"
          >
            Обновить
          </button>
        </div>
      </div>
    );
  }

  const cta = heroCta(data, totalSRS);
  const dueSplit = dueSplitLabel(data.srsSummary.dueWords, data.srsSummary.duePhrases);

  return (
    <div className="w-full font-sans text-lk-text">
      {onboardingStep > 0 && (
        <div
          style={{
            position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.7)",
            backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
          }}
        >
          <div
            style={{
              background: T.navy2, border: `1px solid ${T.line}`, borderRadius: 24,
              padding: "36px 32px", maxWidth: 440, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <PabakoMini size={36} gold={T.gold} />
              <div style={{ display: "flex", gap: 6 }}>
                {[1, 2, 3].map((s) => (
                  <div
                    key={s}
                    style={{
                      height: 4, borderRadius: 4, width: s === onboardingStep ? 28 : 16,
                      background: s <= onboardingStep ? T.gold : T.line, transition: "all 0.3s",
                    }}
                  />
                ))}
              </div>
            </div>

            {onboardingStep === 1 && (
              <div>
                <div style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 700, marginBottom: 8, color: T.text }}>Марха бур!</div>
                <div style={{ color: T.textMut, fontSize: 15, marginBottom: 28, lineHeight: 1.5 }}>
                  Добро пожаловать в Laklearn. Как вас зовут? Это необязательно.
                </div>
                <input
                  type="text"
                  maxLength={64}
                  placeholder="Ваше имя"
                  value={onboardingName}
                  onChange={(e) => setOnboardingName(e.target.value)}
                  style={{
                    width: "100%", padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.line}`,
                    background: T.navy, color: T.text, fontFamily: T.sans, fontSize: 15, outline: "none", boxSizing: "border-box",
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setOnboardingStep(2)}
                  style={{
                    marginTop: 16, width: "100%", padding: 14, borderRadius: 12, border: "none",
                    background: T.gold, color: T.bg, fontFamily: T.sans, fontSize: 15, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Продолжить →
                </button>
                <button
                  type="button"
                  onClick={() => setOnboardingStep(2)}
                  style={{
                    marginTop: 8, width: "100%", padding: 10, borderRadius: 12, border: "none",
                    background: "transparent", color: T.textFaint, fontFamily: T.sans, fontSize: 13, cursor: "pointer",
                  }}
                >
                  Пропустить
                </button>
              </div>
            )}

            {onboardingStep === 2 && (
              <div>
                <div style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 700, marginBottom: 8, color: T.text }}>Выберите цель</div>
                <div style={{ color: T.textMut, fontSize: 15, marginBottom: 24, lineHeight: 1.5 }}>
                  Сколько минут в день вы готовы уделять лакскому языку?
                </div>
                <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                  {([5, 10, 15] as const).map((g) => (
                    <button
                      key={g}
                      type="button"
                      onClick={() => setOnboardingGoal(g)}
                      style={{
                        flex: 1, padding: "14px 0", borderRadius: 12,
                        border: `1.5px solid ${onboardingGoal === g ? T.gold : T.line}`,
                        background: onboardingGoal === g ? T.goldDim : "transparent",
                        color: onboardingGoal === g ? T.gold : T.textMut,
                        fontFamily: T.sans, fontSize: 14, fontWeight: 700, cursor: "pointer",
                      }}
                    >
                      {g} мин
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setOnboardingStep(3)}
                  style={{
                    width: "100%", padding: 14, borderRadius: 12, border: "none",
                    background: T.gold, color: T.bg, fontFamily: T.sans, fontSize: 15, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Продолжить →
                </button>
              </div>
            )}

            {onboardingStep === 3 && (
              <div>
                <div style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 700, marginBottom: 8, color: T.text }}>
                  {onboardingName.trim()
                    ? `Рады познакомиться, ${onboardingName.trim().split(" ")[0]}!`
                    : "Всё готово!"}
                </div>
                <div style={{ color: T.textMut, fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
                  Начнём с лакского алфавита — это основа всего. Займёт не больше {onboardingGoal} минут.
                </div>
                <Link
                  href="/letters"
                  onClick={() => void finishOnboarding()}
                  style={{
                    display: "block", padding: 14, borderRadius: 12, background: T.gold, color: T.bg,
                    fontFamily: T.sans, fontSize: 15, fontWeight: 700, textDecoration: "none", textAlign: "center",
                  }}
                >
                  {onboardingSaving ? "Сохранение…" : "Начать с алфавита →"}
                </Link>
                <button
                  type="button"
                  onClick={() => void finishOnboarding()}
                  disabled={onboardingSaving}
                  style={{
                    marginTop: 10, width: "100%", padding: 10, borderRadius: 12, border: "none",
                    background: "transparent", color: T.textFaint, fontFamily: T.sans, fontSize: 13, cursor: "pointer",
                  }}
                >
                  Начать с главной
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "28px 20px 40px" }}>
        <div style={{ marginBottom: 18 }}>
          <div
            style={{
              ...card, position: "relative", overflow: "hidden",
              background: `linear-gradient(135deg, ${T.heroFrom} 0%, ${T.heroTo} 100%)`,
            }}
          >
            <div style={{ position: "absolute", inset: 0, top: "auto", bottom: 0, opacity: 0.4 }}>
              <Mountains T={T} />
            </div>
            <div style={{ position: "absolute", right: 32, top: "50%", transform: "translateY(-50%)", opacity: 0.12 }}>
              <PabakoMini size={140} gold={T.gold} />
            </div>
            <div
              style={{
                position: "relative", padding: "32px 28px", display: "flex",
                alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap",
              }}
            >
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ fontFamily: T.serif, fontSize: 28, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.15, color: "#ECE0C4" }}>
                  {data.progress.lessonsCompleted === 0
                    ? `Марха бур, ${data.profile.name.split(" ")[0]}!`
                    : totalSRS === 0
                      ? "Всё повторено на сегодня"
                      : `Продолжим, ${data.profile.name.split(" ")[0]}?`}
                </div>
                <div style={{ color: "rgba(236,224,196,0.65)", fontSize: 15, marginTop: 8 }}>{greetingSubtitle}</div>
                <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 99, background: "rgba(212,165,55,0.18)", color: "#D4A537", fontFamily: T.sans, fontSize: 12.5, fontWeight: 600 }}>
                    <Flame size={12} color="#D4A537" style={{ display: "block" }} />
                    {data.profile.streak} {data.profile.streak === 1 ? "день" : data.profile.streak < 5 ? "дня" : "дней"}
                  </span>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 99, background: "rgba(231,198,107,0.15)", color: "#E7C66B", fontFamily: T.sans, fontSize: 12.5, fontWeight: 600 }}>
                    <Target size={12} color="#E7C66B" style={{ display: "block" }} />
                    {data.profile.xp} XP
                  </span>
                  {data.progress.accuracy > 0 && (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 99, background: "rgba(63,160,107,0.18)", color: "#3FA06B", fontFamily: T.sans, fontSize: 12.5, fontWeight: 600 }}>
                      {data.progress.accuracy}% точность
                    </span>
                  )}
                  {totalSRS > 0 && (
                    <span
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px", borderRadius: 99,
                        background: data.srsSummary.overdue > 0 ? "rgba(194,80,63,0.18)" : "rgba(212,165,55,0.18)",
                        color: data.srsSummary.overdue > 0 ? "#C2503F" : "#D4A537",
                        fontFamily: T.sans, fontSize: 12.5, fontWeight: 600,
                      }}
                    >
                      {totalSRS} ждут{dueSplit ? ` · ${dueSplit}` : ""}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "stretch", gap: 8, flexShrink: 0 }}>
                <Link
                  href={cta.href}
                  className="lk-btn-gold lk-lift"
                  style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "16px 28px", borderRadius: 14,
                    background: "#D4A537", color: "#0E1B2E", fontFamily: T.sans, fontSize: 15, fontWeight: 700,
                    textDecoration: "none", whiteSpace: "nowrap",
                  }}
                >
                  {cta.label}
                </Link>
                {cta.secondary && (
                  <Link
                    href={cta.secondary.href}
                    style={{
                      display: "inline-flex", alignItems: "center", justifyContent: "center", gap: 6, padding: "8px 12px",
                      color: "rgba(236,224,196,0.7)", fontFamily: T.sans, fontSize: 13, fontWeight: 600, textDecoration: "none",
                    }}
                  >
                    {cta.secondary.label} →
                  </Link>
                )}
              </div>
            </div>
            {data.srsSummary.nextReviewTime && totalSRS === 0 && (
              <div style={{ position: "relative", borderTop: "1px solid rgba(212,165,55,0.2)", padding: "10px 28px", fontSize: 12.5, color: "rgba(236,224,196,0.5)" }}>
                Следующее повторение в{" "}
                <span style={{ color: "#ECE0C4", fontWeight: 600 }}>
                  {new Date(data.srsSummary.nextReviewTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}
          </div>
        </div>

        <div style={{ ...card, padding: 24, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: topicsLine ? 10 : 16 }}>
            <div style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: T.gold }}>
              Темы разговорника
            </div>
            {topics.length > 0 && (
              <Link href="/phrasebook" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.gold, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                Все темы <ArrowRight size={14} style={{ color: T.gold, display: "block" }} />
              </Link>
            )}
          </div>
          {topicsLine && topics.length > 0 && (
            <div style={{ fontSize: 13, color: T.textMut, lineHeight: 1.45, marginBottom: 16 }}>
              {topicsLine}
            </div>
          )}
          {topics.length > 0 ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {topics.map((col) => {
                const href = topicHref(col);
                const relative = formatRelativeReviewedAt(col.lastReviewedAt);
                const badgeBg =
                  col.status === "needs_review" ? T.redDim
                    : col.status === "mastered" ? T.greenDim
                      : col.status === "in_progress" ? T.goldDim
                        : (isDark ? "rgba(157,176,199,0.12)" : "rgba(0,0,0,0.06)");
                const badgeFg =
                  col.status === "needs_review" ? T.red
                    : col.status === "mastered" ? T.green
                      : col.status === "in_progress" ? T.gold
                        : T.textMut;
                const knownPct = col.totalWords > 0 ? (col.knownWords / col.totalWords) * 100 : 0;
                const learningPct = col.totalWords > 0 ? (col.learningWords / col.totalWords) * 100 : 0;
                const weakPct = col.totalWords > 0 ? (col.weakWords / col.totalWords) * 100 : 0;
                const newPct = Math.max(0, 100 - knownPct - learningPct - weakPct);

                return (
                  <Link
                    key={col.id}
                    href={href}
                    style={{ display: "flex", flexDirection: "column", gap: 8, textDecoration: "none", padding: "4px 0" }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {col.title}
                        </span>
                        <span
                          style={{
                            flexShrink: 0,
                            fontSize: 10.5,
                            fontWeight: 700,
                            letterSpacing: 0.2,
                            padding: "2px 7px",
                            borderRadius: 999,
                            background: badgeBg,
                            color: badgeFg,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {col.dueWords > 0 ? `${col.dueWords} к повторению` : topicStatusLabel(col.status)}
                        </span>
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.textMut, whiteSpace: "nowrap" }}>
                        {col.masteryPercent}%
                      </span>
                    </div>

                    <div style={{ height: 7, borderRadius: 7, background: isDark ? "rgba(157,176,199,0.14)" : "rgba(0,0,0,0.07)", overflow: "hidden", display: "flex" }}>
                      {knownPct > 0 && <div style={{ width: `${knownPct}%`, background: T.green, height: "100%" }} />}
                      {learningPct > 0 && <div style={{ width: `${learningPct}%`, background: T.blue, height: "100%" }} />}
                      {weakPct > 0 && <div style={{ width: `${weakPct}%`, background: T.red, height: "100%" }} />}
                      {newPct > 0 && col.status !== "not_started" && (
                        <div style={{ width: `${newPct}%`, background: "transparent", height: "100%" }} />
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
                      <span style={{ fontSize: 11.5, color: T.textMut, lineHeight: 1.4 }}>
                        {col.knownWords} знаю · {col.learningWords} учу
                        {col.weakWords > 0 ? ` · ${col.weakWords} слабо` : ""}
                        {col.newWords > 0 ? ` · ${col.newWords} новых` : ""}
                        {col.accuracy != null ? ` · ${col.accuracy}% точн.` : ""}
                        {relative ? ` · ${relative}` : ""}
                      </span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: T.gold, whiteSpace: "nowrap", flexShrink: 0 }}>
                        {topicCtaLabel(col)} →
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "24px 0 8px", textAlign: "center" }}>
              <PabakoMini size={48} gold={T.gold} />
              <div>
                <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6 }}>
                  Здесь появится ваш прогресс
                </div>
                <div style={{ color: T.textMut, fontSize: 14, lineHeight: 1.6, maxWidth: 360 }}>
                  Выберите тему в разговорнике — прогресс по фразам и повторениям появится здесь
                </div>
              </div>
              <Link
                href="/phrasebook"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10,
                  border: `1px solid ${T.line}`, background: T.goldDim, color: T.gold, fontSize: 14, fontWeight: 600, textDecoration: "none",
                }}
              >
                Открыть разговорник <ArrowRight size={14} style={{ display: "block" }} />
              </Link>
            </div>
          )}
        </div>

        {(data.leaderboardTop.length > 0 || data.myLeaderboardRow) && (
          <div style={{ ...card, padding: 24, marginBottom: 18 }}>
            <div style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color: T.gold, marginBottom: 16 }}>
              Лидерборд
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {data.leaderboardTop.slice(0, 5).map((row) => {
                const isMe = data.myLeaderboardRow?.id === row.id;
                return (
                  <div
                    key={row.id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 10,
                      background: isMe ? T.goldDim : "transparent", transition: "background 0.3s",
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: row.rank <= 3 ? T.gold : T.textFaint, width: 20, textAlign: "center" }}>
                      {row.rank}
                    </span>
                    <div
                      style={{
                        width: 28, height: 28, borderRadius: "50%", background: T.navy3, border: `1px solid ${T.line}`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
                        color: isMe ? T.gold : T.textMut, flexShrink: 0,
                      }}
                    >
                      {getInitials(row.name)}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, color: isMe ? T.gold : T.text }}>
                      {row.name}{isMe ? " (вы)" : ""}
                    </span>
                    {row.streak > 0 && (
                      <span style={{ fontSize: 11, color: T.textMut, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <Flame size={11} color={T.gold} style={{ display: "block" }} />
                        {row.streak}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: T.textMut }}>{row.xp} XP</span>
                  </div>
                );
              })}
              {data.myLeaderboardRow && data.myLeaderboardRow.rank > 5 && (
                <>
                  <div style={{ height: 1, background: T.line, margin: "6px 10px" }} />
                  <div
                    style={{
                      display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 10,
                      background: T.goldDim,
                    }}
                  >
                    <span style={{ fontSize: 12, fontWeight: 700, color: T.gold, width: 20, textAlign: "center" }}>
                      {data.myLeaderboardRow.rank}
                    </span>
                    <div
                      style={{
                        width: 28, height: 28, borderRadius: "50%", background: T.navy3, border: `1px solid ${T.line}`,
                        display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700,
                        color: T.gold, flexShrink: 0,
                      }}
                    >
                      {getInitials(data.myLeaderboardRow.name)}
                    </div>
                    <span style={{ flex: 1, fontSize: 13, color: T.gold }}>
                      {data.myLeaderboardRow.name} (вы)
                    </span>
                    {data.myLeaderboardRow.streak > 0 && (
                      <span style={{ fontSize: 11, color: T.textMut, display: "inline-flex", alignItems: "center", gap: 3 }}>
                        <Flame size={11} color={T.gold} style={{ display: "block" }} />
                        {data.myLeaderboardRow.streak}
                      </span>
                    )}
                    <span style={{ fontSize: 12, color: T.textMut }}>{data.myLeaderboardRow.xp} XP</span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
