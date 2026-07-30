"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import {
  LogOut, Settings, User, Trophy, Flame, Target, ArrowRight, BookOpen,
  Home, BookMarked, Type, RefreshCw, Star
} from "lucide-react";
import { getDashboardData, logout } from "@/lib/api/client";
import type { DashboardData } from "@/types/dashboard";
import { useTheme } from "@/components/ThemeProvider";

/* ── Навигация ─────────────────────────────────────────────────── */
const NAV_LINKS = [
  { href: "/dashboard",  label: "Главная",    Icon: Home },
  { href: "/dictionary", label: "Словарь",    Icon: BookMarked },
  { href: "/letters",    label: "Буквы",      Icon: Type },
  { href: "/review",     label: "Повторение", Icon: RefreshCw },
] as const;

const COLLECTION_COLORS_DARK  = ["#D4A537","#3E86C9","#C2503F","#3FA06B","#D4A537","#3E86C9","#C2503F","#3FA06B"];
const COLLECTION_COLORS_LIGHT = ["#9A6E00","#1A5288","#B03030","#1E6E3A","#9A6E00","#1A5288","#B03030","#1E6E3A"];

/* ── Вспомогательные ─────────────────────────────────────────── */
function getInitials(name: string) {
  return name.split(" ").map(w => w[0] ?? "").join("").toUpperCase().slice(0, 2);
}

/* ── SVG-компоненты ──────────────────────────────────────────── */
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

/* ── Переключатель темы ──────────────────────────────────────── */
function ThemeToggle() {
  const { isDark, toggleMode, tokens: T } = useTheme();
  return (
    <div
      onClick={(e) => { e.stopPropagation(); toggleMode(); }}
      role="switch" aria-checked={isDark}
      style={{
        width: 44, height: 24, borderRadius: 99,
        background: isDark ? T.goldDim : "rgba(0,0,0,0.08)",
        border: `1px solid ${isDark ? T.goldBorder : T.line}`,
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
        boxShadow: "0 1px 4px rgba(0,0,0,0.35)",
      }}>
        {isDark ? "🌙" : "☀️"}
      </span>
    </div>
  );
}

/* ── Дропдаун профиля ────────────────────────────────────────── */
function ProfileDropdown({ name, role, onClose, onLogout, isLoggingOut }: {
  name: string; role?: string;
  onClose: () => void; onLogout: () => void; isLoggingOut: boolean;
}) {
  const router = useRouter();
  const { isDark, tokens: T } = useTheme();

  const item = (icon: React.ReactNode, label: string, onClick: () => void, danger = false) => (
    <button type="button" onClick={onClick}
      style={{ display:"flex", alignItems:"center", gap:10, padding:"9px 16px", width:"100%", fontSize:13, fontWeight:500, cursor:"pointer", background:"transparent", border:"none", color: danger ? T.red : T.textMut, fontFamily: T.sans, textAlign:"left" as const, transition:"background 0.15s,color 0.15s" }}
      onMouseEnter={e=>{ e.currentTarget.style.background = T.navy3; if(!danger) e.currentTarget.style.color = T.text; }}
      onMouseLeave={e=>{ e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = danger ? T.red : T.textMut; }}
    >
      <span style={{ width:18, textAlign:"center" as const, flexShrink:0 }}>{icon}</span>{label}
    </button>
  );

  return (
    <div style={{ position:"absolute", top:"calc(100% + 10px)", right:0, width:232, background: T.navy2, border:`1px solid ${T.line}`, borderRadius:16, boxShadow: isDark ? "0 12px 40px rgba(0,0,0,0.55)" : "0 8px 24px rgba(0,0,0,0.14)", overflow:"hidden", zIndex:200 }}>
      <div style={{ padding:"14px 16px 12px", borderBottom:`1px solid ${T.line}`, display:"flex", alignItems:"center", gap:11 }}>
        <div style={{ width:38, height:38, borderRadius:"50%", background: T.goldDim, border:`1.5px solid ${T.line}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:700, color: T.gold, flexShrink:0 }}>
          {getInitials(name)}
        </div>
        <div style={{ fontSize:13, fontWeight:700, color: T.text }}>{name}</div>
      </div>
      <div style={{ padding:"11px 16px", borderBottom:`1px solid ${T.line}`, display:"flex", alignItems:"center", justifyContent:"space-between" }}>
        <span style={{ fontSize:12, fontWeight:500, color: T.textMut, display:"flex", alignItems:"center", gap:7 }}>
          <span>{isDark ? "🌙" : "☀️"}</span>
          <span>{isDark ? "Тёмная тема" : "Светлая тема"}</span>
        </span>
        <ThemeToggle />
      </div>
      {item(<User size={14}/>,     "Профиль",    ()=>{ router.push("/profile");      onClose(); })}
      {item(<Settings size={14}/>, "Настройки",  ()=>{ router.push("/settings");     onClose(); })}
      {item(<Trophy size={14}/>,   "Достижения", ()=>{ router.push("/achievements"); onClose(); })}
      {role === "admin" && item(<BookOpen size={14}/>, "Админ-панель", ()=>{ router.push("/admin"); onClose(); })}
      <div style={{ height:1, background: T.line, margin:"2px 0" }} />
      {item(<LogOut size={14}/>, isLoggingOut ? "Выход…" : "Выйти", onLogout, true)}
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ОСНОВНОЙ КОМПОНЕНТ
══════════════════════════════════════════════════════════════ */
export function DashboardShell() {
  const router   = useRouter();
  const pathname = usePathname();
  const { tokens: T, isDark } = useTheme();

  const [data,             setData]             = useState<DashboardData | null>(null);
  const [isLoading,        setIsLoading]        = useState(true);
  const [ddOpen,           setDdOpen]           = useState(false);
  const [isLoggingOut,     setIsLoggingOut]     = useState(false);
  const [onboardingStep,   setOnboardingStep]   = useState<0|1|2|3>(0);
  const [onboardingName,   setOnboardingName]   = useState("");
  const [onboardingGoal,   setOnboardingGoal]   = useState<5|10|15>(10);
  const [onboardingSaving, setOnboardingSaving] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);

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
    const onVis = () => { if (document.visibilityState === "visible") void load(); };
    document.addEventListener("visibilitychange", onVis);
    return () => { mounted = false; window.clearInterval(id); document.removeEventListener("visibilitychange", onVis); };
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => { if (ddRef.current && !ddRef.current.contains(e.target as Node)) setDdOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  useEffect(() => {
    if (!data) return;
    const isNew = data.progress.lessonsCompleted === 0 && data.profile.xp === 0;
    const seen  = typeof window !== "undefined" && localStorage.getItem("laklearn_onboarding_done") === "1";
    if (isNew && !seen) {
      const n = data.profile.name;
      if (!n.includes("@") && !/^[a-z0-9._-]+$/i.test(n)) setOnboardingName(n);
      setOnboardingStep(1);
    }
  }, [data]);

  const totalSRS = useMemo(() =>
    data ? (data.srsSummary.overdue + data.srsSummary.dueSoon) : 0,
  [data]);

  const greetingSubtitle = useMemo(() => {
    if (!data) return "";
    if (data.progress.lessonsCompleted === 0) return "Марха бур! Начните с алфавита — это займёт 5 минут.";
    if (totalSRS === 0) return "Сегодня всё повторено. Отличная работа!";
    if (data.srsSummary.overdue > 0) return `${data.srsSummary.overdue} карточек просрочено — освежи, пока помнишь.`;
    return `${totalSRS} карточек ждут повторения — один присест, пять минут.`;
  }, [data, totalSRS]);

  const COLL_COLORS = isDark ? COLLECTION_COLORS_DARK : COLLECTION_COLORS_LIGHT;

  const card: React.CSSProperties = { background: T.navy2, border: `1px solid ${T.line}`, borderRadius: 18 };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try { await logout(); router.push("/login"); } catch { setIsLoggingOut(false); }
  };

  const finishOnboarding = async () => {
    setOnboardingSaving(true);
    try {
      const n = onboardingName.trim();
      if (n) await fetch("/api/profile", { method:"PATCH", headers:{"Content-Type":"application/json"}, body: JSON.stringify({ displayName: n }) });
      if (typeof window !== "undefined") localStorage.setItem("laklearn_onboarding_done", "1");
    } catch { /* ignore */ }
    finally { setOnboardingSaving(false); setOnboardingStep(0); }
  };

  /* ── Загрузка ── */
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-lk-bg transition-colors duration-[400ms]">
        <div className="flex flex-col items-center gap-[18px]">
          <PabakoMini size={56} gold={T.gold} />
          <span className="font-sans text-sm text-lk-faint">Загрузка…</span>
        </div>
      </div>
    );
  }

  /* ── Ошибка ── */
  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-lk-bg font-sans transition-colors duration-[400ms]">
        <div className="text-center text-lk-muted">
          <p className="text-base">Не удалось загрузить данные</p>
          <button type="button" onClick={() => window.location.reload()}
            className="mt-4 cursor-pointer rounded-[10px] border-none bg-lk-gold px-5 py-2.5 font-sans font-bold text-lk-bg">
            Обновить
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-lk-bg font-sans text-lk-text transition-colors duration-[400ms]">

      {/* ── ОНБОРДИНГ ─────────────────────────────────────────────── */}
      {onboardingStep > 0 && (
        <div style={{ position:"fixed", inset:0, zIndex:100, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(8px)", display:"flex", alignItems:"center", justifyContent:"center", padding:20 }}>
          <div style={{ background: T.navy2, border:`1px solid ${T.line}`, borderRadius:24, padding:"36px 32px", maxWidth:440, width:"100%", boxShadow:"0 24px 64px rgba(0,0,0,0.5)" }}>
            <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:28 }}>
              <PabakoMini size={36} gold={T.gold} />
              <div style={{ display:"flex", gap:6 }}>
                {[1,2,3].map(s => (
                  <div key={s} style={{ height:4, borderRadius:4, width: s === onboardingStep ? 28 : 16, background: s <= onboardingStep ? T.gold : T.line, transition:"all 0.3s" }} />
                ))}
              </div>
            </div>

            {onboardingStep === 1 && (
              <div>
                <div style={{ fontFamily: T.serif, fontSize:26, fontWeight:700, marginBottom:8, color: T.text }}>Марха бур!</div>
                <div style={{ color: T.textMut, fontSize:15, marginBottom:28, lineHeight:1.5 }}>Добро пожаловать в Laklearn. Как вас зовут? Это необязательно.</div>
                <input type="text" maxLength={64} placeholder="Ваше имя" value={onboardingName} onChange={e => setOnboardingName(e.target.value)}
                  style={{ width:"100%", padding:"14px 16px", borderRadius:12, border:`1px solid ${T.line}`, background: T.navy, color: T.text, fontFamily: T.sans, fontSize:15, outline:"none", boxSizing:"border-box" as const }} autoFocus />
                <button type="button" onClick={() => setOnboardingStep(2)}
                  style={{ marginTop:16, width:"100%", padding:"14px", borderRadius:12, border:"none", background: T.gold, color: T.bg, fontFamily: T.sans, fontSize:15, fontWeight:700, cursor:"pointer" }}>
                  Продолжить →
                </button>
                <button type="button" onClick={() => setOnboardingStep(2)}
                  style={{ marginTop:8, width:"100%", padding:"10px", borderRadius:12, border:"none", background:"transparent", color: T.textFaint, fontFamily: T.sans, fontSize:13, cursor:"pointer" }}>
                  Пропустить
                </button>
              </div>
            )}

            {onboardingStep === 2 && (
              <div>
                <div style={{ fontFamily: T.serif, fontSize:26, fontWeight:700, marginBottom:8, color: T.text }}>Выберите цель</div>
                <div style={{ color: T.textMut, fontSize:15, marginBottom:24, lineHeight:1.5 }}>Сколько минут в день вы готовы уделять лакскому языку?</div>
                <div style={{ display:"flex", gap:10, marginBottom:24 }}>
                  {([5,10,15] as const).map(g => (
                    <button key={g} type="button" onClick={() => setOnboardingGoal(g)}
                      style={{ flex:1, padding:"14px 0", borderRadius:12, border:`1.5px solid ${onboardingGoal === g ? T.gold : T.line}`, background: onboardingGoal === g ? T.goldDim : "transparent", color: onboardingGoal === g ? T.gold : T.textMut, fontFamily: T.sans, fontSize:14, fontWeight:700, cursor:"pointer" }}>
                      {g} мин
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setOnboardingStep(3)}
                  style={{ width:"100%", padding:"14px", borderRadius:12, border:"none", background: T.gold, color: T.bg, fontFamily: T.sans, fontSize:15, fontWeight:700, cursor:"pointer" }}>
                  Продолжить →
                </button>
              </div>
            )}

            {onboardingStep === 3 && (
              <div>
                <div style={{ fontFamily: T.serif, fontSize:26, fontWeight:700, marginBottom:8, color: T.text }}>
                  {onboardingName.trim() ? `Рады познакомиться, ${onboardingName.trim().split(" ")[0]}!` : "Всё готово!"}
                </div>
                <div style={{ color: T.textMut, fontSize:15, marginBottom:28, lineHeight:1.6 }}>
                  Начнём с лакского алфавита — это основа всего. Займёт не больше {onboardingGoal} минут.
                </div>
                <Link href="/letters" onClick={() => void finishOnboarding()}
                  style={{ display:"block", padding:"14px", borderRadius:12, background: T.gold, color: T.bg, fontFamily: T.sans, fontSize:15, fontWeight:700, textDecoration:"none", textAlign:"center" as const }}>
                  {onboardingSaving ? "Сохранение…" : "Начать с алфавита →"}
                </Link>
                <button type="button" onClick={() => void finishOnboarding()} disabled={onboardingSaving}
                  style={{ marginTop:10, width:"100%", padding:"10px", borderRadius:12, border:"none", background:"transparent", color: T.textFaint, fontFamily: T.sans, fontSize:13, cursor:"pointer" }}>
                  Начать с главной
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ХЕДЕР ────────────────────────────────────────────────── */}
      <header style={{ position:"sticky", top:0, zIndex:20, flexShrink:0, backdropFilter:"blur(12px)", WebkitBackdropFilter:"blur(12px)", borderBottom:`1px solid ${T.line}`, background: isDark ? "rgba(14,27,46,0.92)" : `${T.bg}ee`, transition:"background 0.4s, border-color 0.4s" }}>
        <div style={{ maxWidth:1200, margin:"0 auto", display:"flex", alignItems:"center", justifyContent:"space-between", padding:"0 20px", height:56 }}>

          {/* Логотип */}
          <Link href="/dashboard" style={{ display:"inline-flex", alignItems:"center", gap:9, textDecoration:"none" }}>
            <span style={{ display:"inline-flex", alignItems:"center", justifyContent:"center", width:30, height:30, borderRadius:7, background: T.navy2, border:`1px solid ${T.line}`, flexShrink:0, transition:"all 0.4s" }}>
              <PabakoMini size={22} gold={T.gold} />
            </span>
            <span>
              <span style={{ display:"block", fontFamily: T.serif, fontSize:15, fontWeight:800, letterSpacing:-0.3, color: T.gold, lineHeight:1, transition:"color 0.4s" }}>Laklearn</span>
              <span className="lk-desktop-only" style={{ display:"block", fontSize:9, fontWeight:600, letterSpacing:2, textTransform:"uppercase" as const, color: T.textFaint, lineHeight:1, marginTop:2, transition:"color 0.4s" }}>Лакский язык</span>
            </span>
          </Link>

          {/* Центральная навигация (только десктоп) */}
          <nav className="lk-desktop-only flex gap-0.5">
            {NAV_LINKS.map(link => {
              const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
              const { Icon } = link;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] no-underline transition-all duration-150 ${
                    active ? "bg-lk-gold-dim font-semibold text-lk-gold" : "font-medium text-lk-muted hover:text-lk-text"
                  }`}
                >
                  <Icon size={14} />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          {/* Правая часть */}
          <div style={{ display:"flex", alignItems:"center", gap:7 }}>
            <span className="lk-desktop-only inline-flex items-center gap-1 rounded-full bg-lk-gold-dim px-2.5 py-1 text-[11px] font-semibold text-lk-gold transition-all duration-[400ms]">
              <Flame size={12} /> {data.profile.streak}
            </span>
            <span className="lk-desktop-only inline-flex items-center gap-1 rounded-full border border-lk-line px-2.5 py-1 text-[11px] font-semibold text-lk-muted transition-all duration-[400ms]"
              style={{ background: isDark ? "rgba(157,176,199,0.1)" : "rgba(0,0,0,0.05)" }}>
              <Star size={12} /> {data.profile.xp}
            </span>
            <span className="lk-mobile-only hidden items-center gap-1 rounded-full bg-lk-gold-dim px-2 py-1 text-[10px] font-semibold text-lk-gold">
              <Flame size={11} /> {data.profile.streak}
            </span>

            {/* Аватар */}
            <div ref={ddRef} style={{ position:"relative" }}>
              <button type="button" onClick={() => setDdOpen(p => !p)} aria-label="Меню профиля" aria-expanded={ddOpen}
                style={{ width:34, height:34, borderRadius:"50%", background: T.goldDim, border:`2px solid ${ddOpen ? T.gold : T.line}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color: T.gold, cursor:"pointer", flexShrink:0, transform: ddOpen ? "scale(1.06)" : "scale(1)", transition:"all 0.2s" }}>
                {getInitials(data.profile.name)}
              </button>
              {ddOpen && (
                <ProfileDropdown
                  name={data.profile.name}
                  role={data.profile.role}
                  onClose={() => setDdOpen(false)}
                  onLogout={() => void handleLogout()}
                  isLoggingOut={isLoggingOut}
                />
              )}
            </div>
          </div>
        </div>
      </header>

      {/* ── КОНТЕНТ ──────────────────────────────────────────────── */}
      <div style={{ flex:1 }}>
        <div style={{ maxWidth:1200, margin:"0 auto", padding:"28px 20px 80px" }}>

          {/* HERO */}
          <div style={{ marginBottom:18 }}>
            <div style={{ ...card, position:"relative", overflow:"hidden", background:`linear-gradient(135deg, ${T.heroFrom} 0%, ${T.heroTo} 100%)` }}>
              <div style={{ position:"absolute", inset:0, top:"auto", bottom:0, opacity:0.4 }}>
                <Mountains T={T} />
              </div>
              <div style={{ position:"absolute", right:32, top:"50%", transform:"translateY(-50%)", opacity:0.12 }}>
                <PabakoMini size={140} gold={T.gold} />
              </div>
              <div style={{ position:"relative", padding:"32px 28px", display:"flex", alignItems:"center", justifyContent:"space-between", gap:24, flexWrap:"wrap" as const }}>
                <div style={{ flex:1, minWidth:280 }}>
                  <div style={{ fontFamily: T.serif, fontSize:28, fontWeight:700, letterSpacing:-0.4, lineHeight:1.15, color:"#ECE0C4" }}>
                    {data.progress.lessonsCompleted === 0
                      ? `Марха бур, ${data.profile.name.split(" ")[0]}!`
                      : totalSRS === 0 ? "Всё повторено на сегодня 🎉"
                      : `Продолжим, ${data.profile.name.split(" ")[0]}?`}
                  </div>
                  <div style={{ color:"rgba(236,224,196,0.65)", fontSize:15, marginTop:8 }}>{greetingSubtitle}</div>
                  <div style={{ display:"flex", gap:8, marginTop:20, flexWrap:"wrap" as const }}>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:99, background:"rgba(212,165,55,0.18)", color:"#D4A537", fontFamily: T.sans, fontSize:12.5, fontWeight:600 }}>
                      <Flame size={12} color="#D4A537" style={{ display:"block" }} />
                      {data.profile.streak} {data.profile.streak === 1 ? "день" : data.profile.streak < 5 ? "дня" : "дней"}
                    </span>
                    <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:99, background:"rgba(231,198,107,0.15)", color:"#E7C66B", fontFamily: T.sans, fontSize:12.5, fontWeight:600 }}>
                      <Target size={12} color="#E7C66B" style={{ display:"block" }} />
                      {data.profile.xp} XP
                    </span>
                    {data.progress.accuracy > 0 && (
                      <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:99, background:"rgba(63,160,107,0.18)", color:"#3FA06B", fontFamily: T.sans, fontSize:12.5, fontWeight:600 }}>
                        {data.progress.accuracy}% точность
                      </span>
                    )}
                    {totalSRS > 0 && (
                      <span style={{ display:"inline-flex", alignItems:"center", gap:5, padding:"5px 11px", borderRadius:99, background: data.srsSummary.overdue > 0 ? "rgba(194,80,63,0.18)" : "rgba(212,165,55,0.18)", color: data.srsSummary.overdue > 0 ? "#C2503F" : "#D4A537", fontFamily: T.sans, fontSize:12.5, fontWeight:600 }}>
                        {totalSRS} карточек ждут
                      </span>
                    )}
                  </div>
                </div>
                <Link
                  href={data.progress.lessonsCompleted === 0 ? "/letters" : "/review"}
                  className="lk-btn-gold lk-lift"
                  style={{ display:"inline-flex", alignItems:"center", gap:10, padding:"16px 28px", borderRadius:14, background:"#D4A537", color:"#0E1B2E", fontFamily: T.sans, fontSize:15, fontWeight:700, textDecoration:"none", flexShrink:0, whiteSpace:"nowrap" as const }}
                >
                  {data.progress.lessonsCompleted === 0 ? "К алфавиту →" : totalSRS === 0 ? "Открыть словарь →" : "Начать повторение →"}
                </Link>
              </div>
              {data.srsSummary.nextReviewTime && totalSRS === 0 && (
                <div style={{ position:"relative", borderTop:`1px solid rgba(212,165,55,0.2)`, padding:"10px 28px", fontSize:12.5, color:"rgba(236,224,196,0.5)" }}>
                  Следующее повторение в{" "}
                  <span style={{ color:"#ECE0C4", fontWeight:600 }}>
                    {new Date(data.srsSummary.nextReviewTime).toLocaleTimeString("ru-RU", { hour:"2-digit", minute:"2-digit" })}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* КОЛЛЕКЦИИ */}
          <div style={{ ...card, padding:24, marginBottom:18 }}>
            <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:16 }}>
              <div style={{ fontFamily: T.sans, fontSize:11, fontWeight:700, letterSpacing:1.4, textTransform:"uppercase" as const, color: T.gold }}>Прогресс по темам</div>
              {data.collections.length > 0 && (
                <Link href="/dictionary" style={{ display:"inline-flex", alignItems:"center", gap:5, color: T.gold, fontSize:13, fontWeight:600, textDecoration:"none" }}>
                  Все темы <ArrowRight size={14} style={{ color: T.gold, display:"block" }} />
                </Link>
              )}
            </div>
            {data.collections.length > 0 ? (
              <div style={{ display:"grid", gridTemplateColumns:"repeat(3, 1fr)", gap:14 }}>
                {data.collections.slice(0, 6).map((col, i) => {
                  const pct   = col.totalWords > 0 ? Math.round((col.learnedWords / col.totalWords) * 100) : 0;
                  const color = pct === 100 ? T.green : pct > 0 ? T.gold : COLL_COLORS[i % COLL_COLORS.length] ?? T.gold;
                  return (
                    <div key={col.id} style={{ display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline" }}>
                        <span style={{ fontSize:13, fontWeight:600, color: T.text, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" as const, maxWidth:130 }}>{col.title}</span>
                        <span style={{ fontSize:11.5, color: T.textMut, whiteSpace:"nowrap" as const, marginLeft:6 }}>{col.learnedWords}/{col.totalWords}</span>
                      </div>
                      <div style={{ height:6, borderRadius:6, background: isDark ? "rgba(157,176,199,0.16)" : "rgba(0,0,0,0.08)", overflow:"hidden" }}>
                        <div style={{ height:"100%", width:`${pct}%`, background: color, borderRadius:6 }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:14, padding:"24px 0 8px", textAlign:"center" as const }}>
                <PabakoMini size={48} gold={T.gold} />
                <div>
                  <div style={{ fontFamily: T.serif, fontSize:18, fontWeight:700, color: T.text, marginBottom:6 }}>Здесь появится ваш прогресс</div>
                  <div style={{ color: T.textMut, fontSize:14, lineHeight:1.6, maxWidth:360 }}>Добавьте слова из словаря чтобы начать отслеживать прогресс по темам</div>
                </div>
                <Link href="/dictionary" style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"10px 20px", borderRadius:10, border:`1px solid ${T.line}`, background: T.goldDim, color: T.gold, fontSize:14, fontWeight:600, textDecoration:"none" }}>
                  Открыть словарь <ArrowRight size={14} style={{ display:"block" }} />
                </Link>
              </div>
            )}
          </div>

          {/* ЛИДЕРБОРД */}
          {(data.leaderboardTop.length > 0 || data.myLeaderboardRow) && (
            <div style={{ ...card, padding:24, marginBottom:18 }}>
              <div style={{ fontFamily: T.sans, fontSize:11, fontWeight:700, letterSpacing:1.4, textTransform:"uppercase" as const, color: T.gold, marginBottom:16 }}>Лидерборд</div>
              <div style={{ display:"flex", flexDirection:"column", gap:2 }}>
                {data.leaderboardTop.slice(0, 5).map(row => {
                  const isMe = data.myLeaderboardRow?.id === row.id;
                  return (
                    <div key={row.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 10px", borderRadius:10, background: isMe ? T.goldDim : "transparent", transition:"background 0.3s" }}>
                      <span style={{ fontSize:12, fontWeight:700, color: row.rank <= 3 ? T.gold : T.textFaint, width:20, textAlign:"center" as const }}>{row.rank}</span>
                      <div style={{ width:28, height:28, borderRadius:"50%", background: T.navy3, border:`1px solid ${T.line}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color: isMe ? T.gold : T.textMut, flexShrink:0 }}>
                        {getInitials(row.name)}
                      </div>
                      <span style={{ flex:1, fontSize:13, color: isMe ? T.gold : T.text }}>{row.name}{isMe ? " (вы)" : ""}</span>
                      <span style={{ fontSize:12, color: T.textMut }}>{row.xp} XP</span>
                    </div>
                  );
                })}
                {data.myLeaderboardRow && !data.leaderboardTop.slice(0,5).some(r => r.id === data.myLeaderboardRow?.id) && (
                  <>
                    <div style={{ height:1, background: T.line, margin:"4px 0" }} />
                    <div style={{ display:"flex", alignItems:"center", gap:12, padding:"8px 10px", borderRadius:10, background: T.goldDim }}>
                      <span style={{ fontSize:12, fontWeight:700, color: T.gold, width:20, textAlign:"center" as const }}>{data.myLeaderboardRow.rank}</span>
                      <div style={{ width:28, height:28, borderRadius:"50%", background: T.goldDim, border:`1px solid ${T.line}`, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color: T.gold, flexShrink:0 }}>
                        {getInitials(data.myLeaderboardRow.name)}
                      </div>
                      <span style={{ flex:1, fontSize:13, color: T.gold }}>{data.myLeaderboardRow.name} (вы)</span>
                      <span style={{ fontSize:12, color: T.gold }}>{data.myLeaderboardRow.xp} XP</span>
                    </div>
                  </>
                )}
              </div>
            </div>
          )}

        </div>
      </div>

      {/* ── BOTTOM BAR (мобиль) ───────────────────────────────────── */}
      <nav className="lk-mobile-only lk-bottom-bar hidden h-[62px] shrink-0 border-t border-lk-line bg-lk-navy2 transition-colors duration-[400ms]" aria-label="Мобильная навигация">
        <div className="flex h-full w-full">
          {NAV_LINKS.map((link, index) => {
            const active = pathname === link.href || (link.href !== "/dashboard" && pathname.startsWith(link.href));
            const { Icon } = link;
            return (
              <Link key={link.href} href={link.href}
                className={`lk-bb-item${active ? " active" : ""} relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 no-underline`}
                aria-current={active ? "page" : undefined}>
                <span className="lk-bb-dot" />
                <span className="lk-bb-icon text-lk-faint"><Icon size={20} className={active ? "text-lk-gold" : undefined} /></span>
                <span className="lk-bb-label">{link.label}</span>
                {index === 3 && totalSRS > 0 && <span className="lk-bb-badge">{totalSRS}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* ── ФУТЕР ─────────────────────────────────────────────────── */}
      <div style={{ background: T.navy, borderTop:`1px solid ${T.line}`, padding:"18px 20px", textAlign:"center" as const, color: T.textFaint, fontSize:12.5, flexShrink:0, transition:"background 0.4s, border-color 0.4s" }}>
        <span style={{ display:"inline-flex", alignItems:"center", gap:8 }}>
          <PabakoMini size={18} gold={T.gold} />
          Laklearn · язык лакцев, бережно — для всех поколений
        </span>
      </div>

    </div>
  );
}