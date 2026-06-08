"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { LogOut, Settings, User, Trophy, Flame, Target, ArrowRight } from "lucide-react";
import { getDashboardData, logout } from "@/lib/api/client";
import type { DashboardData } from "@/types/dashboard";
import { useTheme } from "@/components/ThemeProvider";

/* ── Дизайн-токены ────────────────────────────────────────────── */
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
  blue:      "#3E86C9",
  red:       "#C2503F",
  snow:      "#E8EDF4",
  serif:     "'Spectral', Georgia, serif",
  sans:      "'Golos Text', system-ui, sans-serif",
};

const COLLECTION_COLORS = [T.gold, T.blue, T.red, T.green, T.gold, T.blue, T.red, T.green, T.gold, T.blue, T.red, T.green];

/* ── Навигация ─────────────────────────────────────────────────── */
const NAV_LINKS = [
  { href: "/dashboard",  label: "Главная",    icon: "🏠" },
  { href: "/dictionary", label: "Словарь",    icon: "📖" },
  { href: "/letters",    label: "Буквы",      icon: "🔤" },
  { href: "/review",     label: "Повторение", icon: "🔄" },
] as const;

/* ── SVG / вспомогательные компоненты ────────────────────────────── */
function PabakoMini({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" style={{ display: "block", flexShrink: 0 }}>
      <polygon points="2,22 8,13 14,22" fill={T.navy3} />
      <polygon points="14,22 20,15 26,22" fill={T.navy3} />
      <polygon points="2,22 14,4 26,22" fill={T.gold} />
      <polygon points="2,22 14,4 14,22" fill="#A07820" />
      <polygon points="14,4 11,11 14,9 17,11" fill="#ECE4CC" />
    </svg>
  );
}

function Mountains({ height = 140 }: { height?: number }) {
  return (
    <svg width="100%" height={height} viewBox="0 0 600 180" preserveAspectRatio="none" style={{ display: "block" }}>
      <polygon points="0,180 120,70 240,180"   fill={T.navy3} opacity="0.7" />
      <polygon points="160,180 320,40 480,180" fill={T.navy3} opacity="0.85" />
      <polygon points="360,180 480,90 600,180" fill={T.navy3} opacity="0.7" />
      <polygon points="-40,180 150,80 360,180" fill={T.navy2} />
      <polygon points="240,180 430,55 620,180" fill={T.navy2} />
      <polygon points="430,55 405,93 418,86 430,98 442,86 455,93" fill={T.snow} opacity="0.9" />
      <polygon points="150,80 132,108 142,102 150,112 158,102 168,108" fill={T.snow} opacity="0.8" />
    </svg>
  );
}

function Bar({ value, color = T.gold, height = 6 }: { value: number; color?: string; height?: number }) {
  return (
    <div style={{ height, borderRadius: height, background: "rgba(157,176,199,0.16)", overflow: "hidden" }}>
      <div style={{ height: "100%", width: `${value}%`, background: color, borderRadius: height }} />
    </div>
  );
}

function Pill({ children, color = T.gold, bg }: { children: React.ReactNode; color?: string; bg?: string }) {
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5, padding: "5px 11px",
      borderRadius: 99, whiteSpace: "nowrap" as const,
      background: bg ?? "rgba(212,165,55,0.12)",
      color, fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, lineHeight: 1,
    }}>
      {children}
    </span>
  );
}

function SectionLabel({ children, color = T.textMut }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase" as const, color, whiteSpace: "nowrap" as const }}>
      {children}
    </div>
  );
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

/* ── Переключатель темы ─────────────────────────────────────────── */
function ThemeToggle() {
  const { isDark, toggleMode } = useTheme();
  return (
    <div
      onClick={toggleMode}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Переключить на светлую тему" : "Переключить на тёмную тему"}
      style={{
        width: 44, height: 24, borderRadius: 99,
        background: isDark ? "rgba(212,165,55,0.15)" : "rgba(157,176,199,0.16)",
        border: `1px solid ${isDark ? "rgba(212,165,55,0.28)" : T.lineCool}`,
        position: "relative", cursor: "pointer",
        transition: "all 0.3s", flexShrink: 0,
      }}
    >
      <span style={{
        position: "absolute", top: 2, left: 2,
        width: 18, height: 18, borderRadius: "50%",
        background: isDark ? T.gold : T.textMut,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 10, lineHeight: 1,
        transform: isDark ? "translateX(20px)" : "translateX(0)",
        transition: "transform 0.25s cubic-bezier(0.4,0,0.2,1), background 0.25s",
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
      }}>
        {isDark ? "🌙" : "☀️"}
      </span>
    </div>
  );
}

/* ── Дропдаун профиля ───────────────────────────────────────────── */
function ProfileDropdown({ name, onClose, onLogout, isLoggingOut }: {
  name: string;
  onClose: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}) {
  const router = useRouter();
  const { isDark } = useTheme();

  const menuItem = (icon: React.ReactNode, label: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex", alignItems: "center", gap: 10,
        padding: "9px 16px", width: "100%",
        fontSize: 13, fontWeight: 500, cursor: "pointer",
        background: "transparent", border: "none",
        color: danger ? T.red : T.textMut,
        fontFamily: T.sans, textAlign: "left" as const,
        transition: "background 0.15s, color 0.15s",
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = T.navy3;
        if (!danger) e.currentTarget.style.color = T.text;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = danger ? T.red : T.textMut;
      }}
    >
      <span style={{ width: 18, textAlign: "center" as const, flexShrink: 0 }}>{icon}</span>
      {label}
    </button>
  );

  return (
    <div style={{
      position: "absolute", top: "calc(100% + 10px)", right: 0,
      width: 230, background: T.navy2, border: `1px solid ${T.line}`,
      borderRadius: 16, boxShadow: "0 12px 40px rgba(0,0,0,0.55)",
      overflow: "hidden", zIndex: 200,
    }}>
      {/* Шапка */}
      <div style={{ padding: "14px 16px 12px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", gap: 11 }}>
        <div style={{
          width: 38, height: 38, borderRadius: "50%",
          background: T.goldDim, border: `1.5px solid ${T.line}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 700, color: T.gold, flexShrink: 0,
        }}>
          {getInitials(name)}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{name}</div>
      </div>

      {/* Переключатель темы */}
      <div style={{ padding: "11px 16px", borderBottom: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: 12, fontWeight: 500, color: T.textMut, display: "flex", alignItems: "center", gap: 7 }}>
          <span>{isDark ? "🌙" : "☀️"}</span>
          <span>{isDark ? "Тёмная тема" : "Светлая тема"}</span>
        </span>
        <ThemeToggle />
      </div>

      {menuItem(<User size={14} />,     "Профиль",    () => { router.push("/profile");      onClose(); })}
      {menuItem(<Trophy size={14} />,   "Достижения", () => { router.push("/achievements"); onClose(); })}
      {menuItem(<Settings size={14} />, "Настройки",  () => { router.push("/settings");     onClose(); })}
      <div style={{ height: 1, background: T.line, margin: "2px 0" }} />
      {menuItem(<LogOut size={14} />,   isLoggingOut ? "Выход…" : "Выйти", onLogout, true)}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════════
   ОСНОВНОЙ КОМПОНЕНТ
══════════════════════════════════════════════════════════════════ */
export function DashboardShell() {
  const router   = useRouter();
  const pathname = usePathname();

  const [data,             setData]             = useState<DashboardData | null>(null);
  const [isLoading,        setIsLoading]        = useState(true);
  const [ddOpen,           setDdOpen]           = useState(false);
  const [isLoggingOut,     setIsLoggingOut]     = useState(false);
  const [onboardingStep,   setOnboardingStep]   = useState<0|1|2|3>(0);
  const [onboardingName,   setOnboardingName]   = useState("");
  const [onboardingGoal,   setOnboardingGoal]   = useState<5|10|15>(10);
  const [onboardingSaving, setOnboardingSaving] = useState(false);

  const ddRef = useRef<HTMLDivElement>(null);

  /* Загрузка данных дашборда */
  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await getDashboardData();
        if (mounted) { setData(res); setIsLoading(false); }
      } catch {
        if (mounted) { setData(null); setIsLoading(false); }
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { mounted = false; window.clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  /* Закрытие дропдауна по клику вне */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setDdOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  /* Онбординг для новых пользователей */
  useEffect(() => {
    if (!data) return;
    const isNew = data.progress.lessonsCompleted === 0 && data.profile.xp === 0;
    const seen  = typeof window !== "undefined" && localStorage.getItem("laklearn_onboarding_done") === "1";
    if (isNew && !seen) {
      const n = data.profile.name;
      const emailLike = n.includes("@") || /^[a-z0-9._-]+$/i.test(n);
      if (!emailLike) setOnboardingName(n);
      setOnboardingStep(1);
    }
  }, [data]);

  /* Производные значения */
  const totalSRS = useMemo(() =>
    data ? (data.srsSummary.overdue + data.srsSummary.dueSoon) : 0,
    [data]
  );

  const greetingSubtitle = useMemo(() => {
    if (!data) return "";
    if (data.progress.lessonsCompleted === 0) return "Марха бур! Начните с алфавита — это займёт 5 минут.";
    if (totalSRS === 0) return "Сегодня всё повторено. Отличная работа!";
    if (data.srsSummary.overdue > 0) return `${data.srsSummary.overdue} карточек просрочено — освежи, пока помнишь.`;
    return `${totalSRS} карточек ждут повторения — один присест, пять минут.`;
  }, [data, totalSRS]);

  const card: React.CSSProperties = {
    background: T.navy2,
    border: `1px solid ${T.line}`,
    borderRadius: 18,
  };

  /* Выход */
  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await logout(); router.push("/login"); } catch { setIsLoggingOut(false); }
  };

  /* Завершение онбординга */
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
      if (typeof window !== "undefined") localStorage.setItem("laklearn_onboarding_done", "1");
    } catch { /* не критично */ }
    finally { setOnboardingSaving(false); setOnboardingStep(0); }
  };

  /* ── Экран загрузки ── */
  if (isLoading) {
    return (
      <div style={{ minHeight: "100vh", background: T.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 18 }}>
          <PabakoMini size={56} />
          <span style={{ fontFamily: T.sans, color: T.textFaint, fontSize: 14 }}>Загрузка…</span>
        </div>
      </div>
    );
  }

  /* ── Экран ошибки ── */
  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: T.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" as const, color: T.textMut, fontFamily: T.sans }}>
          <p style={{ fontSize: 16 }}>Не удалось загрузить данные</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            style={{ marginTop: 16, padding: "10px 20px", borderRadius: 10, background: T.gold, color: T.ink, border: "none", fontWeight: 700, cursor: "pointer", fontFamily: T.sans }}
          >
            Обновить
          </button>
        </div>
      </div>
    );
  }

  /* ══════════════════════════════════════════════════════════════
     ОСНОВНОЙ РЕНДЕР
  ══════════════════════════════════════════════════════════════ */
  return (
    <div style={{ width: "100%", minHeight: "100vh", background: T.ink, fontFamily: T.sans, color: T.text, display: "flex", flexDirection: "column" }}>

      {/* ── ОНБОРДИНГ-МОДАЛ ───────────────────────────────────────── */}
      {onboardingStep > 0 && (
        <div style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(8,14,24,0.85)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: T.navy2, border: `1px solid ${T.line}`, borderRadius: 24, padding: "36px 32px", maxWidth: 440, width: "100%", boxShadow: "0 24px 64px rgba(0,0,0,0.5)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <PabakoMini size={36} />
              <div style={{ display: "flex", gap: 6 }}>
                {[1,2,3].map((s) => (
                  <div key={s} style={{ height: 4, borderRadius: 4, width: s === onboardingStep ? 28 : 16, background: s <= onboardingStep ? T.gold : T.lineCool, transition: "all 0.3s" }} />
                ))}
              </div>
            </div>

            {onboardingStep === 1 && (
              <div>
                <div style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Марха бур!</div>
                <div style={{ color: T.textMut, fontSize: 15, marginBottom: 28, lineHeight: 1.5 }}>Добро пожаловать в Laklearn. Как вас зовут? Это необязательно.</div>
                <input type="text" maxLength={64} placeholder="Ваше имя" value={onboardingName} onChange={(e) => setOnboardingName(e.target.value)}
                  style={{ width: "100%", padding: "14px 16px", borderRadius: 12, border: `1px solid ${T.line}`, background: T.navy, color: T.text, fontFamily: T.sans, fontSize: 15, outline: "none", boxSizing: "border-box" as const }} autoFocus />
                <button type="button" onClick={() => setOnboardingStep(2)}
                  style={{ marginTop: 16, width: "100%", padding: "14px", borderRadius: 12, border: "none", background: T.gold, color: T.ink, fontFamily: T.sans, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  Продолжить →
                </button>
                <button type="button" onClick={() => setOnboardingStep(2)}
                  style={{ marginTop: 8, width: "100%", padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: T.textFaint, fontFamily: T.sans, fontSize: 13, cursor: "pointer" }}>
                  Пропустить
                </button>
              </div>
            )}

            {onboardingStep === 2 && (
              <div>
                <div style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 700, marginBottom: 8 }}>Выберите цель</div>
                <div style={{ color: T.textMut, fontSize: 15, marginBottom: 24, lineHeight: 1.5 }}>Сколько минут в день вы готовы уделять лакскому языку?</div>
                <div style={{ display: "flex", gap: 10, marginBottom: 24 }}>
                  {([5, 10, 15] as const).map((g) => (
                    <button key={g} type="button" onClick={() => setOnboardingGoal(g)}
                      style={{ flex: 1, padding: "14px 0", borderRadius: 12, border: `1.5px solid ${onboardingGoal === g ? T.gold : T.lineCool}`, background: onboardingGoal === g ? T.goldDim : "transparent", color: onboardingGoal === g ? T.gold : T.textMut, fontFamily: T.sans, fontSize: 14, fontWeight: 700, cursor: "pointer" }}>
                      {g} мин
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setOnboardingStep(3)}
                  style={{ width: "100%", padding: "14px", borderRadius: 12, border: "none", background: T.gold, color: T.ink, fontFamily: T.sans, fontSize: 15, fontWeight: 700, cursor: "pointer" }}>
                  Продолжить →
                </button>
              </div>
            )}

            {onboardingStep === 3 && (
              <div>
                <div style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
                  {onboardingName.trim() ? `Рады познакомиться, ${onboardingName.trim().split(" ")[0]}!` : "Всё готово!"}
                </div>
                <div style={{ color: T.textMut, fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
                  Начнём с лакского алфавита — это основа всего. Займёт не больше {onboardingGoal} минут.
                </div>
                <Link href="/letters" onClick={() => void finishOnboarding()}
                  style={{ display: "block", padding: "14px", borderRadius: 12, background: T.gold, color: T.ink, fontFamily: T.sans, fontSize: 15, fontWeight: 700, textDecoration: "none", textAlign: "center" as const }}>
                  {onboardingSaving ? "Сохранение…" : "Начать с алфавита →"}
                </Link>
                <button type="button" onClick={() => void finishOnboarding()} disabled={onboardingSaving}
                  style={{ marginTop: 10, width: "100%", padding: "10px", borderRadius: 12, border: "none", background: "transparent", color: T.textFaint, fontFamily: T.sans, fontSize: 13, cursor: "pointer" }}>
                  Начать с главной
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ХЕДЕР ─────────────────────────────────────────────────── */}
      <header style={{ position: "sticky", top: 0, zIndex: 20, flexShrink: 0, background: "rgba(14,27,46,0.92)", backdropFilter: "blur(12px)", borderBottom: `1px solid ${T.line}` }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 20px", height: 56 }}>

          {/* Логотип */}
          <Link href="/dashboard" style={{ display: "inline-flex", alignItems: "center", gap: 9, textDecoration: "none" }}>
            <span style={{ display: "inline-flex", alignItems: "center", justifyContent: "center", width: 30, height: 30, borderRadius: 7, background: T.navy2, border: `1px solid ${T.line}`, flexShrink: 0 }}>
              <PabakoMini size={22} />
            </span>
            <span>
              <span style={{ display: "block", fontFamily: T.serif, fontSize: 15, fontWeight: 800, letterSpacing: -0.3, color: T.gold, lineHeight: 1 }}>Laklearn</span>
              <span className="lk-desktop-only" style={{ display: "block", fontSize: 9, fontWeight: 600, letterSpacing: 2, textTransform: "uppercase" as const, color: T.textFaint, lineHeight: 1, marginTop: 2 }}>Лакский язык</span>
            </span>
          </Link>

          {/* Центральная навигация (только десктоп) */}
          <nav className="lk-desktop-only" style={{ display: "flex", gap: 2 }}>
            {NAV_LINKS.map((link) => {
              const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
              return (
                <Link key={link.href} href={link.href} style={{
                  padding: "6px 13px", borderRadius: 99, fontSize: 13,
                  fontWeight: isActive ? 600 : 500, textDecoration: "none",
                  background: isActive ? T.goldDim : "transparent",
                  color: isActive ? T.gold : T.textMut,
                  transition: "all 0.15s",
                }}>
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Правая часть хедера */}
          <div style={{ display: "flex", alignItems: "center", gap: 7 }}>
            {/* Streak (только десктоп) */}
            <span className="lk-desktop-only" style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 99, padding: "5px 10px", fontSize: 11, fontWeight: 600, background: T.goldDim, color: T.gold }}>
              🔥 {data.profile.streak}
            </span>
            {/* XP (только десктоп) */}
            <span className="lk-desktop-only" style={{ display: "inline-flex", alignItems: "center", gap: 4, borderRadius: 99, padding: "5px 10px", fontSize: 11, fontWeight: 600, background: "rgba(157,176,199,0.1)", color: T.textMut, border: `1px solid ${T.lineCool}` }}>
              ⭐ {data.profile.xp}
            </span>
            {/* Streak (только мобиль) */}
            <span className="lk-mobile-only" style={{ display: "none", alignItems: "center", gap: 4, borderRadius: 99, padding: "4px 8px", fontSize: 10, fontWeight: 600, background: T.goldDim, color: T.gold }}>
              🔥 {data.profile.streak}
            </span>

            {/* Аватар + дропдаун */}
            <div ref={ddRef} style={{ position: "relative" }}>
              <button
                type="button"
                onClick={() => setDdOpen((p) => !p)}
                aria-label="Открыть меню профиля"
                aria-expanded={ddOpen}
                style={{
                  width: 34, height: 34, borderRadius: "50%",
                  background: T.goldDim,
                  border: `2px solid ${ddOpen ? T.gold : T.line}`,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 11, fontWeight: 700, color: T.gold,
                  cursor: "pointer", flexShrink: 0,
                  transform: ddOpen ? "scale(1.06)" : "scale(1)",
                  transition: "all 0.2s",
                }}
              >
                {getInitials(data.profile.name)}
              </button>

              {ddOpen && (
                <ProfileDropdown
                  name={data.profile.name}
                  onClose={() => setDdOpen(false)}
                  onLogout={() => void handleLogout()}
                  isLoggingOut={isLoggingOut}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── КОНТЕНТ СТРАНИЦЫ ──────────────────────────────────────── */}
      <div style={{ flex: 1 }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", padding: "30px 20px 80px" }}>

          {/* HERO */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ ...card, position: "relative", overflow: "hidden", background: `linear-gradient(135deg, ${T.navy2} 0%, ${T.navy} 100%)` }}>
              <div style={{ position: "absolute", inset: 0, top: "auto", bottom: 0, opacity: 0.4 }}>
                <Mountains height={120} />
              </div>
              <div style={{ position: "absolute", right: 32, top: "50%", transform: "translateY(-50%)", opacity: 0.15 }}>
                <PabakoMini size={140} />
              </div>
              <div style={{ position: "relative", padding: "32px 28px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" as const }}>
                <div style={{ flex: 1, minWidth: 280 }}>
                  <div style={{ fontFamily: T.serif, fontSize: 28, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.15 }}>
                    {data.progress.lessonsCompleted === 0
                      ? `Марха бур, ${data.profile.name.split(" ")[0]}!`
                      : totalSRS === 0
                      ? "Всё повторено на сегодня 🎉"
                      : `Продолжим, ${data.profile.name.split(" ")[0]}?`}
                  </div>
                  <div style={{ color: T.textMut, fontSize: 15, marginTop: 8 }}>{greetingSubtitle}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 20, flexWrap: "wrap" as const }}>
                    <Pill color={T.gold}>
                      <Flame size={12} color={T.gold} style={{ display: "block" }} />
                      {data.profile.streak} {data.profile.streak === 1 ? "день" : data.profile.streak < 5 ? "дня" : "дней"}
                    </Pill>
                    <Pill color={T.goldHi} bg="rgba(231,198,107,0.1)">
                      <Target size={12} color={T.goldHi} style={{ display: "block" }} />
                      {data.profile.xp} XP
                    </Pill>
                    {data.progress.accuracy > 0 && (
                      <Pill color={T.green} bg="rgba(63,160,107,0.12)">{data.progress.accuracy}% точность</Pill>
                    )}
                    {totalSRS > 0 && (
                      <Pill
                        color={data.srsSummary.overdue > 0 ? T.red : T.gold}
                        bg={data.srsSummary.overdue > 0 ? "rgba(194,80,63,0.12)" : "rgba(212,165,55,0.12)"}
                      >
                        {totalSRS} карточек ждут
                      </Pill>
                    )}
                  </div>
                </div>
                <Link
                  href={data.progress.lessonsCompleted === 0 ? "/letters" : "/review"}
                  className="lk-btn-gold lk-lift"
                  style={{ display: "inline-flex", alignItems: "center", gap: 10, padding: "16px 28px", borderRadius: 14, background: T.gold, color: T.ink, fontFamily: T.sans, fontSize: 15, fontWeight: 700, textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" as const }}
                >
                  {data.progress.lessonsCompleted === 0 ? "К алфавиту →" : totalSRS === 0 ? "Открыть словарь →" : "Начать повторение →"}
                </Link>
              </div>
              {data.srsSummary.nextReviewTime && totalSRS === 0 && (
                <div style={{ position: "relative", borderTop: `1px solid ${T.line}`, padding: "10px 28px", fontSize: 12.5, color: T.textFaint }}>
                  Следующее повторение в{" "}
                  <span style={{ color: T.text, fontWeight: 600 }}>
                    {new Date(data.srsSummary.nextReviewTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* КОЛЛЕКЦИИ */}
          <div style={{ ...card, padding: 24, marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <SectionLabel color={T.gold}>Прогресс по темам</SectionLabel>
              {data.collections.length > 0 && (
                <Link href="/dictionary" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.gold, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
                  Все темы <ArrowRight size={14} style={{ color: T.gold, display: "block" }} />
                </Link>
              )}
            </div>
            {data.collections.length > 0 ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 14 }}>
                {data.collections.slice(0, 6).map((col, i) => {
                  const pct   = col.totalWords > 0 ? Math.round((col.learnedWords / col.totalWords) * 100) : 0;
                  const color = pct === 100 ? T.green : pct > 0 ? T.gold : COLLECTION_COLORS[i % COLLECTION_COLORS.length];
                  return (
                    <div key={col.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const, maxWidth: 130 }}>{col.title}</span>
                        <span style={{ fontSize: 11.5, color: T.textMut, whiteSpace: "nowrap" as const, marginLeft: 6 }}>{col.learnedWords}/{col.totalWords}</span>
                      </div>
                      <Bar value={pct} color={color} />
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "24px 0 8px", textAlign: "center" as const }}>
                <PabakoMini size={48} />
                <div>
                  <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6 }}>Здесь появится ваш прогресс</div>
                  <div style={{ color: T.textMut, fontSize: 14, lineHeight: 1.6, maxWidth: 360 }}>Добавьте слова из словаря чтобы начать отслеживать прогресс по темам</div>
                </div>
                <Link href="/dictionary" style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "10px 20px", borderRadius: 10, border: `1px solid ${T.line}`, background: T.goldDim, color: T.gold, fontSize: 14, fontWeight: 600, textDecoration: "none" }}>
                  Открыть словарь <ArrowRight size={14} style={{ display: "block" }} />
                </Link>
              </div>
            )}
          </div>

          {/* ЛИДЕРБОРД */}
          {(data.leaderboardTop.length > 0 || data.myLeaderboardRow) && (
            <div style={{ ...card, padding: 24, marginBottom: 18 }}>
              <SectionLabel color={T.gold}>Лидерборд</SectionLabel>
              <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 2 }}>
                {data.leaderboardTop.slice(0, 5).map((row) => {
                  const isMe = data.myLeaderboardRow?.id === row.id;
                  return (
                    <div key={row.id} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 10, background: isMe ? T.goldDim : "transparent" }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: row.rank <= 3 ? T.gold : T.textFaint, width: 20, textAlign: "center" as const }}>{row.rank}</span>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.navy3, border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: isMe ? T.gold : T.textMut, flexShrink: 0 }}>
                        {getInitials(row.name)}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, color: isMe ? T.gold : T.text }}>{row.name}{isMe ? " (вы)" : ""}</span>
                      <span style={{ fontSize: 12, color: T.textMut }}>{row.xp} XP</span>
                    </div>
                  );
                })}
                {/* Моя строка если не в топ-5 */}
                {data.myLeaderboardRow && !data.leaderboardTop.slice(0, 5).some(r => r.id === data.myLeaderboardRow?.id) && (
                  <>
                    <div style={{ height: 1, background: T.line, margin: "4px 0" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 10px", borderRadius: 10, background: T.goldDim }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: T.gold, width: 20, textAlign: "center" as const }}>{data.myLeaderboardRow.rank}</span>
                      <div style={{ width: 28, height: 28, borderRadius: "50%", background: T.goldDim, border: `1px solid ${T.line}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: T.gold, flexShrink: 0 }}>
                        {getInitials(data.myLeaderboardRow.name)}
                      </div>
                      <span style={{ flex: 1, fontSize: 13, color: T.gold }}>{data.myLeaderboardRow.name} (вы)</span>
                      <span style={{ fontSize: 12, color: T.gold }}>{data.myLeaderboardRow.xp} XP</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── BOTTOM BAR (только мобиль) ────────────────────────────── */}
      <nav
        className="lk-mobile-only lk-bottom-bar"
        aria-label="Мобильная навигация"
        style={{ display: "none", flexShrink: 0, height: 62 }}
      >
        <div style={{ display: "flex", width: "100%", height: "100%" }}>
          {NAV_LINKS.map((link, index) => {
            const isActive = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`lk-bb-item${isActive ? " active" : ""}`}
                aria-label={link.label}
                aria-current={isActive ? "page" : undefined}
                style={{ textDecoration: "none", flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, padding: "8px 4px 6px", position: "relative" }}
              >
                <span className="lk-bb-dot" />
                <span className="lk-bb-icon">{link.icon}</span>
                <span className="lk-bb-label">{link.label}</span>
                {/* Бейдж просроченных карточек */}
                {index === 3 && totalSRS > 0 && (
                  <span className="lk-bb-badge">{totalSRS}</span>
                )}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── FOOTER ────────────────────────────────────────────────── */}
      <div style={{ background: T.navy, borderTop: `1px solid ${T.line}`, padding: "18px 20px", textAlign: "center" as const, color: T.textFaint, fontSize: 12.5, flexShrink: 0 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <PabakoMini size={18} />
          Laklearn · язык лакцев, бережно — для всех поколений
        </span>
      </div>

    </div>
  );
}