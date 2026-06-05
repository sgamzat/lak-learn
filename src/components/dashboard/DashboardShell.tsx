"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut, Settings, BookOpen, Flame, Star, Trophy, ChevronDown, Target, Layers, Grid, Sparkles, BookMarked, CheckCircle, Lock, ArrowRight, Bookmark } from "lucide-react";
import { getDashboardData, logout } from "@/lib/api/client";
import type { DashboardData } from "@/types/dashboard";

// ── Design tokens (from Laklearn design system) ──────────────────────────────
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
  eagleInk:  "#15151A",
  flagGreen: "#34772F",
  flagRed:   "#9C2B27",
};

// ── Static data ───────────────────────────────────────────────────────────────
const WORD_OF_DAY = { lak: "Барчаллагь", ru: "Спасибо", transcription: "bar-cha-llagh" };

const PRACTICE_MODES = [
  { icon: "layers",   name: "Карточки",  sub: "SRS · флипкарты",    color: T.gold,  href: "/review" },
  { icon: "grid",     name: "Перевод",   sub: "выбор · 2 мин",       color: T.blue,  href: "/review" },
  { icon: "sparkles", name: "Сборка",    sub: "слово из букв",        color: T.green, href: "/review" },
  { icon: "book",     name: "Письмо",    sub: "напиши перевод",       color: T.red,   href: "/review" },
];

const THEMES = [
  { name: "Приветствия",    word: "Ассаламу аьлайкум", done: 12, total: 12, color: T.gold  },
  { name: "Семья",          word: "Кулпат",            done: 8,  total: 14, color: T.blue  },
  { name: "Гостеприимство", word: "Хъамал",            done: 3,  total: 11, color: T.red   },
  { name: "Праздники",      word: "Байран",            done: 0,  total: 9,  color: T.green },
  { name: "Природа гор",    word: "Аьрщи",             done: 0,  total: 16, color: T.blue  },
  { name: "Числа",          word: "Ца, кIива, шанна",  done: 5,  total: 10, color: T.gold  },
];

const LEVEL_PATH = [
  { label: "Алфавит",       done: true  },
  { label: "Семья",         done: true  },
  { label: "Приветствия",   done: true  },
  { label: "Гостеприимство",cur: true   },
  { label: "Числа",                     },
  { label: "Праздники",                 },
  { label: "Природа",       lock: true  },
];

const COLLECTION = [
  { id: "kumuh",  name: "Гъумучи",     sub: "Историческая столица", got: true,  color: T.blue  },
  { id: "balhar", name: "Балхар",      sub: "Гончарное ремесло",    got: true,  color: T.red   },
  { id: "pabaku", name: "Пабаку",      sub: "Священная гора",       got: false, color: T.green },
  { id: "zlato",  name: "Златокузнецы",sub: "Кази-Кумух",           got: false, color: T.gold  },
  { id: "dance",  name: "Къавтӏаву",   sub: "Лакский танец",        got: false, color: T.blue  },
  { id: "flag",   name: "Байрахъ",     sub: "Символика Лакии",      got: false, color: T.red   },
];

// ── Pabaku mountain logo components ──────────────────────────────────────────

// Маленькая Пабаку для использования внутри контента (путь, футер и т.д.)
function PabakoMini({ size = 28 }: { size?: number }) {
  const s = size / 28;
  return (
    <svg width={size} height={size} viewBox="0 0 28 28" style={{ display: "block", flexShrink: 0 }}>
      {/* дальние горы */}
      <polygon points="2,22 8,13 14,22" fill={T.navy3} />
      <polygon points="14,22 20,15 26,22" fill={T.navy3} />
      {/* главная пирамида Пабаку — острая как шило */}
      <polygon points="2,22 14,4 26,22" fill={T.gold} />
      {/* левая грань темнее — объём */}
      <polygon points="2,22 14,4 14,22" fill="#A07820" />
      {/* снежная шапка */}
      <polygon points="14,4 11,11 14,9 17,11" fill="#ECE4CC" />
    </svg>
  );
}

// Горизонтальный логотип вариант C: иконка горы + wordmark + подпись
function LogoEagle() {
  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
      {/* иконка горы в тёмном прямоугольнике */}
      <span style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        width: 42, height: 42, borderRadius: 10,
        background: T.navy2, border: `1px solid ${T.line}`, flexShrink: 0,
      }}>
        <PabakoMini size={30} />
      </span>
      {/* wordmark + подпись */}
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

function ProgressRing({ value, size = 84, color = T.green }: { value: number; size?: number; color?: string }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div style={{ position: "relative", width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: "rotate(-90deg)" }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(157,176,199,0.18)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c - (value / 100) * c} />
      </svg>
    </div>
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

function PracticeIcon({ name, size = 20, color }: { name: string; size?: number; color: string }) {
  const p = { fill: "none", stroke: color, strokeWidth: 1.8, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  const icons: Record<string, React.ReactNode> = {
    layers:   <path d="M9 2.5l6 3.2-6 3.2-6-3.2 6-3.2zM3 9.5l6 3.2 6-3.2M3 12.7l6 3.2 6-3.2" {...p} />,
    grid:     <><rect x="3" y="3" width="5" height="5" rx="1" {...p} /><rect x="10" y="3" width="5" height="5" rx="1" {...p} /><rect x="3" y="10" width="5" height="5" rx="1" {...p} /><rect x="10" y="10" width="5" height="5" rx="1" {...p} /></>,
    sparkles: <path d="M9 2l1.4 4.6L15 8l-4.6 1.4L9 14l-1.4-4.6L3 8l4.6-1.4z" fill={color} stroke="none" />,
    book:     <path d="M3 4.5C3 4 3.4 3.5 4 3.5h4s1 .3 1 1.3V15c0-1-1-1.3-1-1.3H4c-.6 0-1-.4-1-1V4.5zM15 4.5c0-.5-.4-1-1-1h-4s-1 .3-1 1.3V15c0-1 1-1.3 1-1.3h4c.6 0 1-.4 1-1V4.5z" {...p} />,
  };
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" style={{ display: "block", flexShrink: 0 }}>
      {icons[name] ?? null}
    </svg>
  );
}

function getInitials(name: string): string {
  return name.split(" ").map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

// ── Main component ────────────────────────────────────────────────────────────
export function DashboardShell() {
  const router = useRouter();
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
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
  const dailyGoal = 10;
  const dailyDone = useMemo(() => Math.min(data?.progress.lessonsCompleted ?? 0, dailyGoal), [data]);
  const dailyPercent = Math.round((dailyDone / dailyGoal) * 100);
  const dayProgress = Math.round((dailyDone / dailyGoal) * 70); // ring value

  const card: React.CSSProperties = {
    background: T.navy2,
    border: `1px solid ${T.line}`,
    borderRadius: 18,
  };

  // ── Fonts injection (Google Fonts)
  useEffect(() => {
    if (document.getElementById("laklearn-fonts")) return;
    const link = document.createElement("link");
    link.id = "laklearn-fonts";
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Spectral:wght@600;700;800&family=Golos+Text:wght@400;500;600;700&family=IBM+Plex+Mono&display=swap";
    document.head.appendChild(link);

    const style = document.createElement("style");
    style.textContent = `
      .lk-lift { transition: transform 0.18s ease, box-shadow 0.18s ease; }
      .lk-lift:hover { transform: translateY(-2px); box-shadow: 0 8px 32px rgba(0,0,0,0.28); }
      .lk-navlink { transition: color 0.15s; }
      .lk-navlink:hover { color: ${T.text} !important; }
      .lk-btn-gold { transition: filter 0.15s; }
      .lk-btn-gold:hover { filter: brightness(1.12); }
    `;
    document.head.appendChild(style);
  }, []);

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

  const NAV_LINKS = [
    { href: "/dictionary", label: "Словарь",    ready: true  },
    { href: "/letters",    label: "Буквы",       ready: true  },
    { href: "/review",     label: "Повторение",  ready: true  },
    { href: "/dashboard",  label: "Грамматика",  ready: false },
    { href: "/dashboard",  label: "Статистика",  ready: false },
  ];

  return (
    <div style={{ width: "100%", minHeight: "100vh", background: T.ink, fontFamily: T.sans, color: T.text }}>

      {/* ── STICKY HEADER ──────────────────────────────────────────────── */}
      <header style={{
        position: "sticky", top: 0, zIndex: 20,
        background: "rgba(14,27,46,0.88)", backdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.line}`,
      }}>
        <div style={{ maxWidth: 1200, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 36px" }}>
          <LogoEagle />

          <nav style={{ display: "flex", gap: 4, alignItems: "center" }}>
            {/* Active: Главная */}
            <span style={{ padding: "8px 16px", borderRadius: 99, fontSize: 14.5, fontWeight: 600, color: T.ink, background: T.gold, cursor: "default" }}>
              Главная
            </span>
            {NAV_LINKS.map((link) =>
              link.ready ? (
                <Link key={link.label} href={link.href} className="lk-navlink" style={{ padding: "8px 16px", borderRadius: 99, fontSize: 14.5, fontWeight: 500, color: T.textMut, textDecoration: "none" }}>
                  {link.label}
                </Link>
              ) : (
                <span key={link.label} style={{ padding: "8px 14px", fontSize: 14.5, color: T.textFaint, display: "inline-flex", alignItems: "center", gap: 6 }}>
                  {link.label}
                  <Pill color={T.textMut} bg="rgba(157,176,199,0.1)">
                    <span style={{ fontSize: 10 }}>скоро</span>
                  </Pill>
                </span>
              )
            )}
          </nav>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Pill color={T.gold}>
              <Flame size={13} color={T.gold} style={{ display: "block" }} />
              {data.profile.streak} дней
            </Pill>
            <Pill color={T.goldHi} bg="rgba(231,198,107,0.1)">
              <Star size={13} color={T.goldHi} style={{ display: "block" }} />
              {data.profile.xp} XP
            </Pill>

            {/* Profile menu */}
            <div ref={menuRef} style={{ position: "relative" }}>
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
          </div>
        </div>
      </header>

      {/* ── PAGE CONTENT ───────────────────────────────────────────────── */}
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "30px 36px 64px" }}>

        {/* ── GREETING ──────────────────────────────────────────────────── */}
        <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", marginBottom: 22, gap: 24 }}>
          <div>
            <div style={{ fontFamily: T.serif, fontSize: 34, fontWeight: 700, letterSpacing: -0.4 }}>
              Ассаламу аьлайкум, {data.profile.name.split(" ")[0]}
            </div>
            <div style={{ color: T.textMut, fontSize: 15, marginTop: 5 }}>
              Барзу уже разложил карточки на сегодня. Один полёт — пять минут.
            </div>
          </div>
          <Pill color={T.gold}>
            <Target size={13} color={T.gold} style={{ display: "block" }} />
            Уровень A1 · {dailyPercent}%
          </Pill>
        </div>

        {/* ── ROW 1: HERO + SRS QUEUE ───────────────────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1.9fr 1fr", gap: 18, marginBottom: 18 }}>
          {/* Hero CTA */}
          <Link href="/review" className="lk-lift" style={{
            ...card, position: "relative", overflow: "hidden", padding: "30px 34px",
            minHeight: 234, display: "flex", flexDirection: "column", justifyContent: "space-between",
            background: `linear-gradient(135deg, ${T.navy2} 0%, ${T.navy} 100%)`, textDecoration: "none",
          }}>
            {/* Mountains bg */}
            <div style={{ position: "absolute", inset: 0, top: "auto", bottom: 0, opacity: 0.5 }}>
              <Mountains height={140} />
            </div>
            <div style={{ position: "absolute", right: 26, top: 22 }}>
              <PabakoMini size={88} />
            </div>
            {totalSRS > 0 && (
              <span style={{ position: "absolute", right: 16, top: 120, borderRadius: 99, background: "rgba(212,165,55,0.2)", padding: "4px 12px", fontSize: 12, fontWeight: 600, color: T.gold }}>
                {totalSRS} карточек ждут
              </span>
            )}
            <div style={{ position: "relative" }}>
              <SectionLabel color={T.gold}>Сегодняшняя сессия</SectionLabel>
              <div style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 700, marginTop: 12, letterSpacing: -0.3 }}>
                Продолжить повторение
              </div>
              <div style={{ color: T.textMut, fontSize: 14.5, marginTop: 6, maxWidth: 420 }}>
                {data.srsSummary.overdue > 0 ? `${data.srsSummary.overdue} карточек просрочено — освежи, пока помнишь.` : "Не дай словам забыться — 5 минут в день."}
              </div>
            </div>
            <div style={{ position: "relative", display: "flex", alignItems: "center", gap: 14, marginTop: 22 }}>
              <span className="lk-btn-gold" style={{
                display: "inline-flex", alignItems: "center", gap: 9, background: T.gold, color: T.ink,
                padding: "13px 24px", borderRadius: 12, fontFamily: T.sans, fontWeight: 700, fontSize: 15,
              }}>
                ▶ Начать <span style={{ fontFamily: T.mono, fontSize: 11, opacity: 0.55 }}>Space</span>
              </span>
              {data.srsSummary.overdue > 0 && (
                <span style={{ display: "inline-flex", alignItems: "center", gap: 6, color: T.red, fontSize: 13, fontWeight: 600 }}>
                  <span style={{ width: 8, height: 8, borderRadius: 4, background: T.red, display: "inline-block" }} />
                  {data.srsSummary.overdue} просрочено
                </span>
              )}
            </div>
          </Link>

          {/* SRS Queue card */}
          <div style={{ ...card, padding: 24 }}>
            <SectionLabel>Очередь повторения</SectionLabel>
            <div style={{ display: "flex", gap: 12, marginTop: 16 }}>
              <div style={{ flex: 1, background: T.redDim, borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
                <div style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 700, color: T.red, lineHeight: 1 }}>
                  {data.srsSummary.overdue}
                </div>
                <div style={{ fontSize: 12, color: T.red, marginTop: 6, fontWeight: 600 }}>Просрочено</div>
              </div>
              <div style={{ flex: 1, background: "rgba(62,134,201,0.12)", borderRadius: 12, padding: "16px 12px", textAlign: "center" }}>
                <div style={{ fontFamily: T.serif, fontSize: 30, fontWeight: 700, color: T.blue, lineHeight: 1 }}>
                  {data.srsSummary.dueSoon}
                </div>
                <div style={{ fontSize: 12, color: T.blue, marginTop: 6, fontWeight: 600 }}>Скоро</div>
              </div>
            </div>
            <div style={{ borderTop: `1px solid ${T.line}`, marginTop: 18, paddingTop: 14, display: "flex", alignItems: "center", gap: 8, color: T.textMut, fontSize: 13, whiteSpace: "nowrap" }}>
              <Target size={15} style={{ color: T.textMut, display: "block" }} />
              {data.srsSummary.nextReviewTime
                ? <>Следующее в <span style={{ color: T.text, fontWeight: 600, marginLeft: 4 }}>{new Date(data.srsSummary.nextReviewTime).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span></>
                : "Нет запланированных повторений"
              }
            </div>
          </div>
        </div>

        {/* ── PRACTICE MODES ────────────────────────────────────────────── */}
        <div style={{ marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 12 }}>
            <SectionLabel color={T.gold}>Быстрая тренировка</SectionLabel>
            <span style={{ fontSize: 12.5, color: T.textFaint }}>выбери, как заниматься сегодня</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14 }}>
            {PRACTICE_MODES.map((m) => (
              <Link key={m.name} href={m.href} className="lk-lift" style={{ ...card, padding: 20, cursor: "pointer", display: "flex", alignItems: "center", gap: 14, textDecoration: "none" }}>
                <span style={{ width: 46, height: 46, borderRadius: 13, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: `${m.color}22`, border: `1px solid ${m.color}55` }}>
                  <PracticeIcon name={m.icon} size={22} color={m.color} />
                </span>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontFamily: T.serif, fontSize: 16.5, fontWeight: 700, lineHeight: 1.1, color: T.text }}>{m.name}</div>
                  <div style={{ fontSize: 12.5, color: T.textMut, marginTop: 3 }}>{m.sub}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* ── ROW 2: GOAL + WORD OF DAY + STREAK ───────────────────────── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1.25fr 1fr", gap: 18, marginBottom: 18 }}>
          {/* Goal ring */}
          <div style={{ ...card, padding: 24, display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ position: "relative", flexShrink: 0 }}>
              <ProgressRing value={dayProgress} size={84} color={T.green} />
              <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                <div style={{ fontFamily: T.serif, fontSize: 21, fontWeight: 700 }}>{dailyDone}</div>
                <div style={{ fontSize: 10, color: T.textMut }}>из {dailyGoal}</div>
              </div>
            </div>
            <div style={{ minWidth: 0 }}>
              <SectionLabel>Цель дня</SectionLabel>
              <div style={{ fontFamily: T.serif, fontSize: 19, fontWeight: 700, marginTop: 8, lineHeight: 1.15, whiteSpace: "nowrap" }}>
                {dailyDone >= dailyGoal ? "Выполнено!" : "Почти готово"}
              </div>
              <div style={{ color: T.textMut, fontSize: 13, marginTop: 5, whiteSpace: "nowrap" }}>
                {dailyDone >= dailyGoal ? "Отличная работа · +50 XP" : `Ещё ${dailyGoal - dailyDone} слова · +30 XP`}
              </div>
            </div>
          </div>

          {/* Word of day */}
          <Link href="/dictionary" className="lk-lift" style={{
            ...card, padding: 24, position: "relative", overflow: "hidden", cursor: "pointer",
            borderColor: "rgba(63,160,107,0.3)", background: `linear-gradient(135deg, rgba(63,160,107,0.14), ${T.navy2})`,
            textDecoration: "none",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <SectionLabel color={T.green}>Слово дня</SectionLabel>
              <Bookmark size={16} style={{ color: T.green, display: "block" }} />
            </div>
            <div style={{ fontFamily: T.serif, fontSize: 34, fontWeight: 700, marginTop: 12, color: T.text }}>
              {WORD_OF_DAY.lak}
            </div>
            <div style={{ fontSize: 16, color: T.textMut, marginTop: 2 }}>{WORD_OF_DAY.ru}</div>
            <div style={{ fontFamily: T.mono, fontSize: 12, color: T.textFaint, marginTop: 4 }}>[ {WORD_OF_DAY.transcription} ]</div>
          </Link>

          {/* Streak */}
          <div style={{ ...card, padding: 24 }}>
            <SectionLabel>Серия · {data.profile.streak} дней</SectionLabel>
            <div style={{ display: "flex", gap: 7, marginTop: 18, justifyContent: "space-between" }}>
              {["П", "В", "С", "Ч", "П", "С", "В"].map((d, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 7 }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
                    background: i < Math.min(data.profile.streak, 7) ? T.gold : "transparent",
                    border: i < Math.min(data.profile.streak, 7) ? "none" : `1.5px dashed ${T.line}`,
                  }}>
                    {i < Math.min(data.profile.streak, 7) && <Flame size={14} style={{ color: T.ink, display: "block" }} />}
                  </div>
                  <span style={{ fontSize: 11, color: T.textFaint }}>{d}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── PHRASEBOOK BY THEME ───────────────────────────────────────── */}
        <div style={{ ...card, padding: 26, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SectionLabel color={T.gold}>Разговорник по темам</SectionLabel>
              <Pill color={T.textMut} bg="rgba(157,176,199,0.1)"><span style={{ fontSize: 11 }}>6 тем</span></Pill>
            </div>
            <Link href="/dictionary" className="lk-navlink" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.gold, fontSize: 13, fontWeight: 600, textDecoration: "none" }}>
              Все темы <ArrowRight size={14} style={{ color: T.gold, display: "block" }} />
            </Link>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12 }}>
            {THEMES.map((t) => {
              const pct = Math.round((t.done / t.total) * 100);
              const done = pct === 100;
              return (
                <div key={t.name} className="lk-lift" style={{ borderRadius: 14, border: `1px solid ${T.line}`, background: T.navy, padding: 16, cursor: "pointer" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <span style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: `${t.color}22`, border: `1px solid ${t.color}55`, display: "flex", alignItems: "center", justifyContent: "center", fontFamily: T.serif, fontWeight: 800, fontSize: 17, color: t.color }}>
                      {t.name[0]}
                    </span>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ fontFamily: T.serif, fontSize: 15.5, fontWeight: 700 }}>{t.name}</div>
                      <div style={{ fontSize: 11.5, color: T.textFaint, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{t.word}</div>
                    </div>
                    {done && <CheckCircle size={16} style={{ color: T.green, flexShrink: 0 }} />}
                  </div>
                  <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 10 }}>
                    <div style={{ flex: 1 }}><Bar value={pct} color={done ? T.green : t.color} /></div>
                    <span style={{ fontSize: 11.5, color: T.textMut, whiteSpace: "nowrap" }}>{t.done}/{t.total}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── LEVEL PATH ────────────────────────────────────────────────── */}
        <div style={{ ...card, padding: 26, marginBottom: 18, position: "relative", overflow: "hidden" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22 }}>
            <SectionLabel color={T.gold}>Твой путь · Уровень A1</SectionLabel>
            <span style={{ fontSize: 12.5, color: T.textFaint }}>полная карта Лакии — в «Грамматике»</span>
          </div>
          <div style={{ display: "flex", alignItems: "center" }}>
            {LEVEL_PATH.map((s, i, arr) => (
              <div key={i} style={{ display: "flex", alignItems: "center", flex: i < arr.length - 1 ? "1" : "0 0 auto" }}>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 9, width: i < arr.length - 1 ? "100%" : "auto", minWidth: 80 }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    background: s.done ? T.gold : (s.cur ? T.navy : "transparent"),
                    border: s.cur ? `2.5px solid ${T.gold}` : (s.done ? "none" : `1.5px dashed ${T.lineCool}`),
                  }}>
                    {s.done ? <CheckCircle size={20} style={{ color: T.ink }} />
                      : s.lock ? <Lock size={16} style={{ color: T.textFaint }} />
                      : s.cur ? <PabakoMini size={26} />
                      : <span style={{ color: T.textMut, fontFamily: T.serif, fontWeight: 700 }}>{i + 1}</span>
                    }
                  </div>
                  <span style={{ fontSize: 11.5, color: s.cur ? T.gold : (s.done ? T.text : T.textFaint), fontWeight: s.cur ? 700 : 500, textAlign: "center" }}>
                    {s.label}
                  </span>
                </div>
                {i < arr.length - 1 && (
                  <div style={{ flex: 1, height: 2, background: s.done ? T.gold : T.lineCool, marginBottom: 22, borderRadius: 2, marginInline: 4 }} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* ── CULTURAL COLLECTION ───────────────────────────────────────── */}
        <div style={{ ...card, padding: 24, marginBottom: 18 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <SectionLabel color={T.gold}>Культурная коллекция</SectionLabel>
              <Pill color={T.textMut} bg="rgba(157,176,199,0.1)"><span style={{ fontSize: 11 }}>2 / 6 открыто</span></Pill>
            </div>
            <span className="lk-navlink" style={{ display: "inline-flex", alignItems: "center", gap: 5, color: T.gold, fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
              Все карточки <ArrowRight size={14} style={{ color: T.gold, display: "block" }} />
            </span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 12 }}>
            {COLLECTION.map((c) => (
              <div key={c.id} className="lk-lift" style={{ borderRadius: 14, overflow: "hidden", border: `1px solid ${c.got ? T.line : T.lineCool}`, background: T.navy, opacity: c.got ? 1 : 0.62, cursor: "pointer" }}>
                {/* Photo placeholder */}
                <div style={{ height: 64, background: `repeating-linear-gradient(135deg, rgba(157,176,199,0.06) 0 10px, rgba(157,176,199,0.12) 10px 20px)`, backgroundColor: "rgba(255,255,255,0.02)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, color: T.textMut, textTransform: "uppercase" as const, textAlign: "center" as const }}>
                    {c.got ? c.name : "закрыто"}
                  </span>
                </div>
                <div style={{ padding: "10px 11px", position: "relative" }}>
                  {!c.got && <Lock size={13} style={{ color: T.textFaint, position: "absolute", right: 10, top: 10 }} />}
                  <div style={{ fontFamily: T.serif, fontSize: 14.5, fontWeight: 700, color: c.got ? T.text : T.textMut }}>{c.name}</div>
                  <div style={{ fontSize: 11, color: T.textFaint, marginTop: 1 }}>{c.sub}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── LEADERBOARD ───────────────────────────────────────────────── */}
        <div style={{ ...card, padding: 24 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 14 }}>
            <Trophy size={16} style={{ color: T.gold }} />
            <SectionLabel>Лига Гъумучи · эта неделя</SectionLabel>
          </div>

          {/* Top from API + my row */}
          {(() => {
            const rows = [...data.leaderboardTop];
            const myId = data.myLeaderboardRow?.id;
            const myInTop = rows.some((r) => r.id === myId);

            return (
              <div>
                {rows.slice(0, 5).map((r) => (
                  <div key={r.id} style={{
                    display: "flex", alignItems: "center", gap: 14, padding: "11px 14px", borderRadius: 10,
                    background: r.id === myId ? T.goldDim : "transparent",
                    marginInline: r.id === myId ? -6 : 0,
                  }}>
                    <span style={{ width: 22, textAlign: "center", fontFamily: T.serif, fontWeight: 700, fontSize: 15, color: r.rank <= 1 ? T.gold : T.textMut }}>{r.rank}</span>
                    <span style={{ flex: 1, fontSize: 14.5, fontWeight: r.id === myId ? 700 : 500, color: r.id === myId ? T.gold : T.text }}>{r.name}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: T.textMut, whiteSpace: "nowrap" }}>{r.xp} XP</span>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.gold, fontSize: 13 }}>
                      <Flame size={13} style={{ color: T.gold, display: "block" }} />{r.streak}
                    </span>
                  </div>
                ))}

                {!myInTop && data.myLeaderboardRow && (
                  <>
                    <div style={{ height: 1, background: T.line, margin: "8px 0" }} />
                    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "11px 14px", borderRadius: 10, background: T.goldDim, marginInline: -6 }}>
                      <span style={{ width: 22, textAlign: "center", fontFamily: T.serif, fontWeight: 700, fontSize: 15, color: T.textMut }}>{data.myLeaderboardRow.rank}</span>
                      <span style={{ flex: 1, fontSize: 14.5, fontWeight: 700, color: T.gold }}>{data.myLeaderboardRow.name} — вы</span>
                      <span style={{ fontSize: 14, fontWeight: 600, color: T.textMut, whiteSpace: "nowrap" }}>{data.myLeaderboardRow.xp} XP</span>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: T.gold, fontSize: 13 }}>
                        <Flame size={13} style={{ color: T.gold, display: "block" }} />{data.myLeaderboardRow.streak}
                      </span>
                    </div>
                  </>
                )}
              </div>
            );
          })()}
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