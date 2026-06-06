"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, BookOpen, Flame, ChevronDown, Target, ArrowRight, Menu, X } from "lucide-react";
import { getDashboardData, logout } from "@/lib/api/client";
import type { DashboardData } from "@/types/dashboard";

// Design tokens
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
  redDim:    "rgba(194,80,63,0.14)",
  snow:      "#E8EDF4",
  serif:     "'Spectral', Georgia, serif",
  sans:      "'Golos Text', system-ui, sans-serif",
  mono:      "'IBM Plex Mono', ui-monospace, monospace",
  cream:     "#ECE6D6",
  flagGreen: "#34772F",
  flagRed:   "#9C2B27",
};

// Static data
const COLLECTION_COLORS = [T.gold, T.blue, T.red, T.green, T.gold, T.blue, T.red, T.green, T.gold, T.blue, T.red, T.green];

// Logo & SVG components

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

function LogoEagle() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 42, height: 42, borderRadius: 10,
        background: T.navy2, border: `1px solid ${T.line}`, flexShrink: 0,
      }}>
        <PabakoMini size={30} />
      </span>
      <span style={{ display: "flex", flexDirection: "column", gap: 1 }}>
        <span style={{ fontFamily: T.serif, fontSize: 20, fontWeight: 800, letterSpacing: -0.3, color: T.text, lineHeight: 1 }}>
          Lak<span style={{ color: T.gold }}>learn</span>
        </span>
        <span style={{ fontFamily: T.sans, fontSize: 9, fontWeight: 600, letterSpacing: 2, color: T.textFaint, textTransform: "uppercase" as const, lineHeight: 1 }}>
          Лакский язык
        </span>
      </span>
    </span>
  );
}

function Mountains({ height = 140 }: { height?: number }) {
  return (
    <svg width="100%" height={height} viewBox="0 0 600 180" preserveAspectRatio="none" style={{ display: "block" }}>
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
      borderRadius: 99, whiteSpace: "nowrap", background: bg ?? "rgba(212,165,55,0.12)",
      color, fontFamily: T.sans, fontSize: 12.5, fontWeight: 600, lineHeight: 1,
    }}>{children}</span>
  );
}

function SectionLabel({ children, color = T.textMut }: { children: React.ReactNode; color?: string }) {
  return (
    <div style={{ fontFamily: T.sans, fontSize: 11, fontWeight: 700, letterSpacing: 1.4, textTransform: "uppercase", color, whiteSpace: "nowrap" }}>
      {children}
    </div>
  );
}


function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

// Main component
export function DashboardShell() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState<0|1|2|3>(0);
  const [onboardingName, setOnboardingName] = useState("");
  const [onboardingGoal, setOnboardingGoal] = useState<5|10|15>(10);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const response = await getDashboardData();
        if (mounted) { setData(response); setIsLoading(false); }
      } catch {
        if (mounted) { setData(null); setIsLoading(false); }
      }
    };
    void load();
    const intervalId = window.setInterval(() => void load(), 60_000);
    const onVisible = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { mounted = false; window.clearInterval(intervalId); document.removeEventListener("visibilitychange", onVisible); };
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setIsProfileMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await logout(); router.push("/login"); } catch { setIsLoggingOut(false); }
  };

  const totalSRS = useMemo(() => (data ? data.srsSummary.overdue + data.srsSummary.dueSoon : 0), [data]);
  const card: React.CSSProperties = {
    background: T.navy2,
    border: `1px solid ${T.line}`,
    borderRadius: 18,
  };

  // Greeting subtitle — динамический, без хардкода
  // Открыть онбординг для новых пользователей (только один раз)
  useEffect(() => {
    if (!data) return;
    const isNew = data.progress.lessonsCompleted === 0 && data.profile.xp === 0;
    const alreadySeen = typeof window !== "undefined" && localStorage.getItem("laklearn_onboarding_done") === "1";
    if (isNew && !alreadySeen) {
      // Предзаполнить имя если уже есть display_name
      const name = data.profile.name;
      const emailLike = name.includes("@") || /^[a-z0-9._-]+$/i.test(name);
      if (!emailLike) setOnboardingName(name);
      setOnboardingStep(1);
    }
  }, [data]);

  const greetingSubtitle = useMemo(() => {
    if (!data) return "";
    if (data.progress.lessonsCompleted === 0) return "Добро пожаловать! Начните с алфавита — это займёт 5 минут.";
    if (totalSRS === 0) return "Сегодня всё повторено. Отличная работа!";
    if (data.srsSummary.overdue > 0) return `${data.srsSummary.overdue} карточек просрочено — освежи, пока помнишь.`;
    return `${totalSRS} карточек ждут повторения — один полёт, пять минут.`;
  }, [data, totalSRS]);

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

  if (!data) {
    return (
      <div style={{ minHeight: "100vh", background: T.ink, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center", color: T.textMut, fontFamily: T.sans }}>
          <p style={{ fontSize: 16 }}>Не удалось загрузить данные</p>
          <button onClick={() => window.location.reload()} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 10, background: T.gold, color: T.ink, border: "none", fontWeight: 700, cursor: "pointer", fontFamily: T.sans }}>
            Обновить
          </button>
        </div>
      </div>
    );
  }

  // Навигация — только рабочие разделы
  const NAV_LINKS = [
    { href: "/dictionary", label: "Словарь"    },
    { href: "/letters",    label: "Буквы"      },
    { href: "/review",     label: "Повторение" },
  ];

  async function finishOnboarding() {
    setOnboardingSaving(true);
    try {
      const name = onboardingName.trim();
      if (name) {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: name }),
        });
      }
      if (typeof window !== "undefined") {
        localStorage.setItem("laklearn_onboarding_done", "1");
      }
    } catch {
      // не критично — просто закроем
    } finally {
      setOnboardingSaving(false);
      setOnboardingStep(0);
    }
  }

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: T.ink, fontFamily: T.sans, color: T.text }}>

      {/* ONBOARDING MODAL */}
      {onboardingStep > 0 && (
        <div style={{
          position: "fixed", inset: 0, zIndex: 100,
          background: "rgba(8,14,24,0.85)", backdropFilter: "blur(8px)",
          display: "flex", alignItems: "center", justifyContent: "center", padding: 20,
        }}>
          <div style={{
            background: T.navy2, border: `1px solid ${T.line}`,
            borderRadius: 24, padding: "36px 32px", maxWidth: 440, width: "100%",
            boxShadow: "0 24px 64px rgba(0,0,0,0.5)",
          }}>

            {/* Логотип и прогресс */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 28 }}>
              <PabakoMini size={36} />
              <div style={{ display: "flex", gap: 6 }}>
                {[1,2,3].map((s) => (
                  <div key={s} style={{
                    height: 4, borderRadius: 4,
                    width: s === onboardingStep ? 28 : 16,
                    background: s <= onboardingStep ? T.gold : T.lineCool,
                    transition: "all 0.3s",
                  }} />
                ))}
              </div>
            </div>

            {/* ШАГ 1 — Имя */}
            {onboardingStep === 1 && (
              <div>
                <div style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
                  Ассаламу аьлайкум!
                </div>
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
                    width: "100%", padding: "14px 16px", borderRadius: 12,
                    border: `1px solid ${T.line}`, background: T.navy,
                    color: T.text, fontFamily: T.sans, fontSize: 15,
                    outline: "none", boxSizing: "border-box",
                  }}
                  autoFocus
                />
                <button
                  type="button"
                  onClick={() => setOnboardingStep(2)}
                  style={{
                    marginTop: 16, width: "100%", padding: "14px",
                    borderRadius: 12, border: "none",
                    background: T.gold, color: T.ink,
                    fontFamily: T.sans, fontSize: 15, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Продолжить →
                </button>
                <button
                  type="button"
                  onClick={() => setOnboardingStep(2)}
                  style={{
                    marginTop: 8, width: "100%", padding: "10px",
                    borderRadius: 12, border: "none", background: "transparent",
                    color: T.textFaint, fontFamily: T.sans, fontSize: 13, cursor: "pointer",
                  }}
                >
                  Пропустить
                </button>
              </div>
            )}

            {/* ШАГ 2 — Цель */}
            {onboardingStep === 2 && (
              <div>
                <div style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
                  Выберите цель
                </div>
                <div style={{ color: T.textMut, fontSize: 15, marginBottom: 24, lineHeight: 1.5 }}>
                  Сколько минут в день вы готовы уделять лакскому языку?
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {([5, 10, 15] as const).map((mins) => (
                    <button
                      key={mins}
                      type="button"
                      onClick={() => setOnboardingGoal(mins)}
                      style={{
                        padding: "14px 18px", borderRadius: 12, cursor: "pointer",
                        border: `2px solid ${onboardingGoal === mins ? T.gold : T.lineCool}`,
                        background: onboardingGoal === mins ? T.goldDim : "transparent",
                        color: onboardingGoal === mins ? T.gold : T.textMut,
                        fontFamily: T.sans, fontSize: 15, fontWeight: onboardingGoal === mins ? 700 : 500,
                        textAlign: "left", display: "flex", alignItems: "center", justifyContent: "space-between",
                        transition: "all 0.15s",
                      }}
                    >
                      <span>{mins} минут в день</span>
                      <span style={{ fontSize: 13, opacity: 0.7 }}>
                        {mins === 5 ? "Лёгкий старт" : mins === 10 ? "Оптимально" : "Активное изучение"}
                      </span>
                    </button>
                  ))}
                </div>
                <button
                  type="button"
                  onClick={() => setOnboardingStep(3)}
                  style={{
                    marginTop: 20, width: "100%", padding: "14px",
                    borderRadius: 12, border: "none",
                    background: T.gold, color: T.ink,
                    fontFamily: T.sans, fontSize: 15, fontWeight: 700, cursor: "pointer",
                  }}
                >
                  Продолжить →
                </button>
              </div>
            )}

            {/* ШАГ 3 — Старт */}
            {onboardingStep === 3 && (
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>🏔️</div>
                <div style={{ fontFamily: T.serif, fontSize: 26, fontWeight: 700, marginBottom: 8 }}>
                  {onboardingName.trim() ? `Рады познакомиться, ${onboardingName.trim().split(" ")[0]}!` : "Всё готово!"}
                </div>
                <div style={{ color: T.textMut, fontSize: 15, marginBottom: 28, lineHeight: 1.6 }}>
                  Начнём с лакского алфавита — это основа всего. Займёт не больше {onboardingGoal} минут.
                </div>
                <Link
                  href="/letters"
                  onClick={() => void finishOnboarding()}
                  style={{
                    display: "block", padding: "14px",
                    borderRadius: 12, background: T.gold,
                    color: T.ink, fontFamily: T.sans, fontSize: 15,
                    fontWeight: 700, textDecoration: "none", textAlign: "center",
                  }}
                >
                  {onboardingSaving ? "Сохранение…" : "Начать с алфавита →"}
                </Link>
                <button
                  type="button"
                  onClick={() => void finishOnboarding()}
                  disabled={onboardingSaving}
                  style={{
                    marginTop: 10, width: "100%", padding: "10px",
                    borderRadius: 12, border: "none", background: "transparent",
                    color: T.textFaint, fontFamily: T.sans, fontSize: 13, cursor: "pointer",
                  }}
                >
                  Начать с главной
                </button>
              </div>
            )}

          </div>
        </div>
      )}

      {/* STICKY HEADER */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "rgba(14,27,46,0.88)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.line}`,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 20px" }}>
          <LogoEagle />

          {/* Десктоп навигация — скрыта на мобиле */}
          <nav style={{ display: "flex", gap: 4, alignItems: "center" }} className="lk-desktop-nav">
            <span style={{ padding: "8px 16px", borderRadius: 99, fontSize: 14.5, fontWeight: 600, color: T.ink, background: T.gold, cursor: "default" }}>
              Главная
            </span>
            {NAV_LINKS.map((link) => (
              <Link key={link.label} href={link.href} className="lk-navlink" style={{ padding: "8px 16px", borderRadius: 99, fontSize: 14.5, fontWeight: 500, color: T.textMut, textDecoration: "none" }}>
                {link.label}
              </Link>
            ))}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {/* Профиль-меню — только на десктопе */}
            <div ref={menuRef} style={{ position: "relative" }} className="lk-desktop-nav">
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((p) => !p)}
                style={{
                  display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 12px 6px 6px",
                  borderRadius: 99, border: `1px solid ${T.line}`, background: T.navy2,
                  color: T.text, fontFamily: T.sans, fontSize: 14, fontWeight: 500, cursor: "pointer",
                }}
              >
                <span style={{
                  width: 28, height: 28, borderRadius: "50%", background: T.goldDim,
                  border: `1px solid ${T.line}`, color: T.gold, display: "inline-flex",
                  alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 11,
                }}>
                  {getInitials(data.profile.name)}
                </span>
                {data.profile.name}
                <ChevronDown size={13} style={{ color: T.textFaint }} />
              </button>

              {isProfileMenuOpen && (
                <div style={{
                  position: "absolute", right: 0, top: "calc(100% + 8px)", width: 220,
                  background: T.navy2, border: `1px solid ${T.line}`, borderRadius: 16,
                  padding: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.4)", zIndex: 50,
                }}>
                  <div style={{ padding: "8px 12px", fontSize: 12, color: T.textFaint, marginBottom: 4 }}>
                    {data.profile.name}
                  </div>
                  <button type="button" disabled style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: "none", background: "transparent", color: T.textFaint, fontSize: 14, fontFamily: T.sans, cursor: "default" }}>
                    <Settings size={15} /> Настройки
                    <span style={{ marginLeft: "auto", fontSize: 10, color: T.gold }}>скоро</span>
                  </button>
                  {data.profile.role === "admin" && (
                    <Link href="/admin" style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, color: T.text, fontSize: 14, textDecoration: "none" }}>
                      <BookOpen size={15} /> Админ-панель
                    </Link>
                  )}
                  <div style={{ height: 1, background: T.line, margin: "6px 0" }} />
                  <button type="button" onClick={() => void handleLogout()} disabled={isLoggingOut} style={{ display: "flex", width: "100%", alignItems: "center", gap: 8, padding: "10px 12px", borderRadius: 10, border: "none", background: "transparent", color: T.red, fontSize: 14, fontFamily: T.sans, cursor: "pointer" }}>
                    <LogOut size={15} /> {isLoggingOut ? "Выход…" : "Выйти"}
                  </button>
                </div>
              )}
            </div>

            {/* Бургер — только на мобиле */}
            <button
              type="button"
              className="lk-mobile-burger"
              onClick={() => setIsMobileMenuOpen((p) => !p)}
              style={{
                display: "none", alignItems: "center", justifyContent: "center",
                width: 38, height: 38, borderRadius: 10,
                border: `1px solid ${T.line}`, background: T.navy2,
                color: T.text, cursor: "pointer",
              }}
            >
              {isMobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
            </button>
          </div>
        </div>

        {/* Мобильное меню-дравер */}
        {isMobileMenuOpen && (
          <div style={{
            borderTop: `1px solid ${T.line}`,
            background: T.navy2,
            padding: "12px 20px 20px",
          }}>
            {/* Имя пользователя */}
            <div style={{ padding: "10px 0 12px", fontSize: 13, color: T.textMut, borderBottom: `1px solid ${T.line}`, marginBottom: 8 }}>
              {data.profile.name}
            </div>

            {/* Ссылки */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ display: "block", padding: "12px 14px", borderRadius: 10, fontSize: 15, fontWeight: 600, color: T.ink, background: T.gold }}>
                Главная
              </span>
              {NAV_LINKS.map((link) => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  style={{ display: "block", padding: "12px 14px", borderRadius: 10, fontSize: 15, fontWeight: 500, color: T.textMut, textDecoration: "none" }}
                >
                  {link.label}
                </Link>
              ))}
            </div>

            {/* Разделитель */}
            <div style={{ height: 1, background: T.line, margin: "12px 0" }} />

            {/* Профиль и выход */}
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {data.profile.role === "admin" && (
                <Link href="/admin" onClick={() => setIsMobileMenuOpen(false)} style={{ display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", borderRadius: 10, color: T.text, fontSize: 15, textDecoration: "none" }}>
                  <BookOpen size={16} /> Админ-панель
                </Link>
              )}
              <button
                type="button"
                onClick={() => { setIsMobileMenuOpen(false); void handleLogout(); }}
                disabled={isLoggingOut}
                style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", padding: "12px 14px", borderRadius: 10, border: "none", background: "transparent", color: T.red, fontSize: 15, fontFamily: T.sans, cursor: "pointer", textAlign: "left" }}
              >
                <LogOut size={16} /> {isLoggingOut ? "Выход…" : "Выйти"}
              </button>
            </div>
          </div>
        )}
      </header>

      {/* ── PAGE CONTENT ───────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "30px 36px 64px" }}>

        {/* HERO */}
        <div style={{ marginBottom: 18 }}>

          {/* Hero CTA — полная ширина, XP и streak внутри */}
          <div style={{
            ...card, position: "relative", overflow: "hidden",
            background: `linear-gradient(135deg, ${T.navy2} 0%, ${T.navy} 100%)`,
          }}>
            {/* Горы на фоне */}
            <div style={{ position: "absolute", inset: 0, top: "auto", bottom: 0, opacity: 0.4 }}>
              <Mountains height={120} />
            </div>

            {/* Орёл справа */}
            <div style={{ position: "absolute", right: 32, top: "50%", transform: "translateY(-50%)", opacity: 0.15 }}>
              <PabakoMini size={140} />
            </div>

            <div style={{ position: "relative", padding: "32px 36px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 24, flexWrap: "wrap" as const }}>

              {/* Левая часть — текст */}
              <div style={{ flex: 1, minWidth: 280 }}>
                <div style={{ fontFamily: T.serif, fontSize: 32, fontWeight: 700, letterSpacing: -0.4, lineHeight: 1.15 }}>
                  {data.progress.lessonsCompleted === 0
                    ? `Ассаламу аьлайкум, ${data.profile.name.split(" ")[0]}!`
                    : totalSRS === 0
                    ? "Всё повторено на сегодня 🎉"
                    : `Продолжим, ${data.profile.name.split(" ")[0]}?`}
                </div>
                <div style={{ color: T.textMut, fontSize: 15, marginTop: 8 }}>
                  {greetingSubtitle}
                </div>

                {/* Статистика-пилюли */}
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
                    <Pill color={T.green} bg="rgba(63,160,107,0.12)">
                      {data.progress.accuracy}% точность
                    </Pill>
                  )}
                  {totalSRS > 0 && (
                    <Pill color={data.srsSummary.overdue > 0 ? T.red : T.gold} bg={data.srsSummary.overdue > 0 ? "rgba(194,80,63,0.12)" : "rgba(212,165,55,0.12)"}>
                      {totalSRS} карточек ждут
                    </Pill>
                  )}
                </div>
              </div>

              {/* Правая часть — кнопка */}
              <Link
                href={data.progress.lessonsCompleted === 0 ? "/letters" : "/review"}
                className="lk-btn-gold lk-lift"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 10,
                  padding: "16px 32px", borderRadius: 14, background: T.gold,
                  color: T.ink, fontFamily: T.sans, fontSize: 16, fontWeight: 700,
                  textDecoration: "none", flexShrink: 0, whiteSpace: "nowrap" as const,
                }}
              >
                {data.progress.lessonsCompleted === 0
                  ? "К алфавиту →"
                  : totalSRS === 0
                  ? "Открыть словарь →"
                  : "Начать повторение →"}
              </Link>
            </div>

            {/* Нижняя полоска SRS если есть просроченные */}
            {data.srsSummary.nextReviewTime && totalSRS === 0 && (
              <div style={{ position: "relative", borderTop: `1px solid ${T.line}`, padding: "10px 36px", fontSize: 12.5, color: T.textFaint }}>
                Следующее повторение в{" "}
                <span style={{ color: T.text, fontWeight: 600 }}>
                  {new Date(data.srsSummary.nextReviewTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>
            )}
          </div>
        </div>



        {/* Коллекции — реальный прогресс из БД + пустое состояние */}
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
                const pct = col.totalWords > 0 ? Math.round((col.learnedWords / col.totalWords) * 100) : 0;
                const color = pct === 100 ? T.green : pct > 0 ? T.gold : COLLECTION_COLORS[i % COLLECTION_COLORS.length];
                return (
                  <div key={col.id} style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: T.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 130 }}>{col.title}</span>
                      <span style={{ fontSize: 11.5, color: T.textMut, whiteSpace: "nowrap", marginLeft: 6 }}>{col.learnedWords}/{col.totalWords}</span>
                    </div>
                    <Bar value={pct} color={color} />
                  </div>
                );
              })}
            </div>
          ) : (
            /* Пустое состояние — коллекций нет */
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14, padding: "24px 0 8px", textAlign: "center" }}>
              <PabakoMini size={48} />
              <div>
                <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 700, color: T.text, marginBottom: 6 }}>
                  Здесь появится ваш прогресс
                </div>
                <div style={{ color: T.textMut, fontSize: 14, lineHeight: 1.6, maxWidth: 360 }}>
                  Добавьте слова из словаря чтобы начать отслеживать прогресс по темам
                </div>
              </div>
              <Link
                href="/dictionary"
                style={{
                  display: "inline-flex", alignItems: "center", gap: 6,
                  padding: "10px 20px", borderRadius: 10,
                  border: `1px solid ${T.line}`, background: T.goldDim,
                  color: T.gold, fontSize: 14, fontWeight: 600,
                  textDecoration: "none",
                }}
              >
                Открыть словарь <ArrowRight size={14} style={{ display: "block" }} />
              </Link>
            </div>
          )}
        </div>


      </div>

      {/* ── FOOTER ─────────────────────────────────────────────────────── */}
      <div style={{ background: T.navy, borderTop: `1px solid ${T.line}`, padding: "22px 36px", textAlign: "center", color: T.textFaint, fontSize: 12.5 }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
          <PabakoMini size={18} />
          Laklearn · язык лакцев, бережно — для всех поколений
        </span>
      </div>
    </div>
  );
}