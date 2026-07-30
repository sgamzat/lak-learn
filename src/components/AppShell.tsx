"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  LogOut, Settings, User, Trophy, Flame, BookOpen, Star,
  Home, BookMarked, Type, RefreshCw, MessagesSquare
} from "lucide-react";
import { getDashboardData, logout } from "@/lib/api/client";
import type { DashboardData } from "@/types/dashboard";
import { useTheme } from "@/components/ThemeProvider";

const NAV_LINKS = [
  { href: "/dashboard",  label: "Главная",      Icon: Home },
  { href: "/dictionary", label: "Словарь",      Icon: BookMarked },
  { href: "/phrasebook", label: "Разговорник",  Icon: MessagesSquare },
  { href: "/letters",    label: "Буквы",        Icon: Type },
  { href: "/review",     label: "Повторение",   Icon: RefreshCw },
] as const;

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

export function ThemeToggle() {
  const { isDark, toggleMode, tokens: T } = useTheme();

  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); toggleMode(); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          toggleMode();
        }
      }}
      role="switch"
      aria-checked={isDark}
      aria-label={isDark ? "Включить светлую тему" : "Включить тёмную тему"}
      className="relative h-6 w-11 shrink-0 cursor-pointer rounded-full border transition-all duration-300"
      style={{
        background: isDark ? T.goldDim : "rgba(0,0,0,0.08)",
        borderColor: isDark ? T.goldBorder : T.line,
      }}
    >
      <span
        className="absolute left-0.5 top-0.5 flex h-[18px] w-[18px] items-center justify-center rounded-full text-[10px] leading-none shadow transition-transform duration-250"
        style={{
          background: isDark ? T.gold : T.textMut,
          transform: isDark ? "translateX(20px)" : "translateX(0)",
        }}
      >
        {isDark ? "🌙" : "☀️"}
      </span>
    </button>
  );
}

function ProfileDropdown({
  name, role, onClose, onLogout, isLoggingOut,
}: {
  name: string;
  role?: string;
  onClose: () => void;
  onLogout: () => void;
  isLoggingOut: boolean;
}) {
  const router = useRouter();
  const { isDark, tokens: T } = useTheme();

  const item = (icon: ReactNode, label: string, onClick: () => void, danger = false) => (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-medium transition-colors"
      style={{ color: danger ? T.red : T.textMut, background: "transparent", border: "none", fontFamily: T.sans }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = T.navy3;
        if (!danger) e.currentTarget.style.color = T.text;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = "transparent";
        e.currentTarget.style.color = danger ? T.red : T.textMut;
      }}
    >
      <span className="w-[18px] shrink-0 text-center">{icon}</span>
      {label}
    </button>
  );

  return (
    <div
      className="absolute right-0 top-[calc(100%+10px)] z-[200] w-[232px] overflow-hidden rounded-2xl border shadow-lk"
      style={{ background: T.navy2, borderColor: T.line }}
    >
      <div className="flex items-center gap-2.5 border-b px-4 py-3.5" style={{ borderColor: T.line }}>
        <div
          className="flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-full text-[13px] font-bold"
          style={{ background: T.goldDim, border: `1.5px solid ${T.line}`, color: T.gold }}
        >
          {getInitials(name)}
        </div>
        <div className="text-[13px] font-bold" style={{ color: T.text }}>{name}</div>
      </div>
      <div className="flex items-center justify-between border-b px-4 py-2.5" style={{ borderColor: T.line }}>
        <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color: T.textMut }}>
          <span>{isDark ? "🌙" : "☀️"}</span>
          <span>{isDark ? "Тёмная тема" : "Светлая тема"}</span>
        </span>
        <ThemeToggle />
      </div>
      {item(<User size={14} />, "Профиль", () => { router.push("/settings"); onClose(); })}
      {item(<Settings size={14} />, "Настройки", () => { router.push("/settings"); onClose(); })}
      {item(<Trophy size={14} />, "Достижения", () => { router.push("/achievements"); onClose(); })}
      {role === "admin" && item(<BookOpen size={14} />, "Админ-панель", () => { router.push("/admin"); onClose(); })}
      <div className="my-0.5 h-px" style={{ background: T.line }} />
      {item(<LogOut size={14} />, isLoggingOut ? "Выход…" : "Выйти", onLogout, true)}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { tokens: T, isDark } = useTheme();

  const immersive = pathname.startsWith("/review");
  const hideBottom = immersive || pathname.startsWith("/admin");

  const [data, setData] = useState<DashboardData | null>(null);
  const [ddOpen, setDdOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const ddRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await getDashboardData();
        if (mounted) setData(res);
      } catch {
        if (mounted) setData(null);
      }
    };
    void load();
    const id = window.setInterval(() => void load(), 60_000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  useEffect(() => {
    const h = (e: MouseEvent) => {
      if (ddRef.current && !ddRef.current.contains(e.target as Node)) setDdOpen(false);
    };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  const totalSRS = data ? data.srsSummary.overdue + data.srsSummary.dueSoon : 0;
  const displayName = data?.profile.name ?? "…";
  const role = data?.profile.role;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      router.push("/login");
    } catch {
      setIsLoggingOut(false);
    }
  };

  if (immersive) {
    return <div className="min-h-screen bg-lk-bg text-lk-text">{children}</div>;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-lk-bg font-sans text-lk-text transition-colors duration-[400ms]">
      <header
        className="sticky top-0 z-20 shrink-0 border-b backdrop-blur-[12px] transition-colors duration-[400ms]"
        style={{
          borderColor: T.line,
          background: isDark ? "rgba(14,27,46,0.92)" : `${T.bg}ee`,
        }}
      >
        <div className="mx-auto flex h-14 max-w-[1200px] items-center justify-between px-5">
          <Link href="/dashboard" className="inline-flex items-center gap-2 no-underline">
            <span
              className="inline-flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-md border"
              style={{ background: T.navy2, borderColor: T.line }}
            >
              <PabakoMini size={22} gold={T.gold} />
            </span>
            <span>
              <span className="block font-serif text-[15px] font-extrabold leading-none tracking-tight text-lk-gold">
                Laklearn
              </span>
              <span className="lk-desktop-only mt-0.5 block text-[9px] font-semibold uppercase tracking-[2px] text-lk-faint">
                Лакский язык
              </span>
            </span>
          </Link>

          <nav className="lk-desktop-only flex gap-0.5">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/dashboard" && pathname.startsWith(link.href));
              const { Icon } = link;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] no-underline transition-all duration-150 ${
                    active
                      ? "bg-lk-gold-dim font-semibold text-lk-gold"
                      : "font-medium text-lk-muted hover:text-lk-text"
                  }`}
                >
                  <Icon size={14} />
                  {link.label}
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-1.5">
            {data ? (
              <>
                <span className="lk-desktop-only inline-flex items-center gap-1 rounded-full bg-lk-gold-dim px-2.5 py-1 text-[11px] font-semibold text-lk-gold">
                  <Flame size={12} /> {data.profile.streak}
                </span>
                <span
                  className="lk-desktop-only inline-flex items-center gap-1 rounded-full border border-lk-line px-2.5 py-1 text-[11px] font-semibold text-lk-muted"
                  style={{ background: isDark ? "rgba(157,176,199,0.1)" : "rgba(0,0,0,0.05)" }}
                >
                  <Star size={12} /> {data.profile.xp}
                </span>
                <span className="lk-mobile-only hidden items-center gap-1 rounded-full bg-lk-gold-dim px-2 py-1 text-[10px] font-semibold text-lk-gold">
                  <Flame size={11} /> {data.profile.streak}
                </span>
              </>
            ) : null}

            <div ref={ddRef} className="relative">
              <button
                type="button"
                onClick={() => setDdOpen((p) => !p)}
                aria-label="Меню профиля"
                aria-expanded={ddOpen}
                className="flex h-[34px] w-[34px] shrink-0 cursor-pointer items-center justify-center rounded-full text-[11px] font-bold transition-transform"
                style={{
                  background: T.goldDim,
                  border: `2px solid ${ddOpen ? T.gold : T.line}`,
                  color: T.gold,
                  transform: ddOpen ? "scale(1.06)" : "scale(1)",
                }}
              >
                {getInitials(displayName)}
              </button>
              {ddOpen && data ? (
                <ProfileDropdown
                  name={displayName}
                  role={role}
                  onClose={() => setDdOpen(false)}
                  onLogout={() => void handleLogout()}
                  isLoggingOut={isLoggingOut}
                />
              ) : null}
            </div>
          </div>
        </div>
      </header>

      <div className={`flex-1 ${hideBottom ? "" : "pb-[62px] md:pb-0"}`}>{children}</div>

      {!hideBottom ? (
        <nav
          className="lk-mobile-only lk-bottom-bar fixed bottom-0 left-0 right-0 z-30 flex h-[62px] border-t border-lk-line bg-lk-navy2"
          aria-label="Мобильная навигация"
        >
          <div className="flex h-full w-full">
            {NAV_LINKS.map((link) => {
              const active =
                pathname === link.href ||
                (link.href !== "/dashboard" && pathname.startsWith(link.href));
              const { Icon } = link;
              const isReview = link.href === "/review";
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`lk-bb-item${active ? " active" : ""} relative flex flex-1 flex-col items-center justify-center gap-0.5 px-1 py-2 no-underline`}
                  aria-current={active ? "page" : undefined}
                >
                  <span className="lk-bb-dot" />
                  <span className="lk-bb-icon">
                    <Icon size={20} className={active ? "text-lk-gold" : "text-lk-faint"} />
                  </span>
                  <span className="lk-bb-label">{link.label}</span>
                  {isReview && totalSRS > 0 ? (
                    <span className="lk-bb-badge">{totalSRS}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </nav>
      ) : null}
    </div>
  );
}
