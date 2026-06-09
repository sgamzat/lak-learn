"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useTheme, DARK_THEMES, LIGHT_THEMES, type ThemeOption } from "@/components/ThemeProvider";

/* ── Переключатель темы ─────────────────────────────────────────── */
function ThemeToggle() {
  const { isDark, toggleMode, tokens: T } = useTheme();
  return (
    <div
      onClick={toggleMode}
      role="switch"
      aria-checked={isDark}
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
        boxShadow: "0 1px 4px rgba(0,0,0,0.4)",
      }}>
        {isDark ? "🌙" : "☀️"}
      </span>
    </div>
  );
}

/* ── Карточка темы ──────────────────────────────────────────────
   Принимает ThemeOption напрямую — поля bg/gold/green (не preview*)
────────────────────────────────────────────────────────────────── */
function ThemeCard({ theme, isActive, onSelect }: {
  theme: ThemeOption;
  isActive: boolean;
  onSelect: () => void;
}) {
  const { tokens: T } = useTheme();
  const isDarkTheme = theme.id.startsWith("d-");

  return (
    <div
      onClick={onSelect}
      style={{
        borderRadius: 12, overflow: "hidden", cursor: "pointer",
        border: `2px solid ${isActive ? T.gold : T.line}`,
        background: T.navy2,
        transition: "border-color 0.2s, transform 0.15s",
        transform: isActive ? "translateY(-1px)" : "none",
      }}
    >
      {/* Превью */}
      <div style={{
        height: 44, background: theme.bg,
        position: "relative", overflow: "hidden",
        padding: "10px 10px 0",
        display: "flex", flexDirection: "column", gap: 4,
      }}>
        {isActive && (
          <div style={{
            position: "absolute", top: 6, right: 6,
            width: 16, height: 16, borderRadius: "50%",
            background: T.gold,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 9, fontWeight: 700, color: "#000",
          }}>✓</div>
        )}
        <div style={{ display: "flex", gap: 3 }}>
          <div style={{ height: 3, width: 26, borderRadius: 99, background: theme.gold }} />
          <div style={{ height: 3, width: 16, borderRadius: 99, background: theme.green }} />
          <div style={{ height: 3, width: 10, borderRadius: 99, background: T.red, opacity: 0.7 }} />
        </div>
        <div style={{ height: 3, width: 18, borderRadius: 99, background: theme.gold, opacity: 0.5 }} />
      </div>

      {/* Инфо */}
      <div style={{ padding: "9px 11px 11px" }}>
        <div style={{
          fontSize: 12, fontWeight: 700, color: theme.gold,
          marginBottom: 3, display: "flex", alignItems: "center", gap: 5,
        }}>
          {theme.name}
          {isActive && (
            <span style={{
              fontSize: 8, fontWeight: 700, padding: "1px 5px",
              borderRadius: 3, background: T.goldDim, color: T.gold,
            }}>
              выбрана
            </span>
          )}
        </div>
        <div style={{
          fontSize: 10, lineHeight: 1.45,
          color: isDarkTheme ? "rgba(255,255,255,0.38)" : "rgba(0,0,0,0.42)",
        }}>
          {theme.description}
        </div>
      </div>
    </div>
  );
}

/* ── Основная страница ──────────────────────────────────────────── */
export default function SettingsPage() {
  const { isDark, darkTheme, lightTheme, setTheme, tokens: T } = useTheme();
  const [name,     setName]     = useState("");
  const [saved,    setSaved]    = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (name.trim()) {
        await fetch("/api/profile", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: name.trim() }),
        });
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch { /* ignore */ }
    finally { setIsSaving(false); }
  };

  const card: React.CSSProperties = {
    background: T.navy2,
    border: `1px solid ${T.line}`,
    borderRadius: 16,
    transition: "background 0.4s, border-color 0.4s",
  };

  const secLabel: React.CSSProperties = {
    fontSize: 10, fontWeight: 700, letterSpacing: 1.4,
    textTransform: "uppercase", color: T.textFaint, marginBottom: 14,
  };

  return (
    <div style={{
      minHeight: "100vh",
      background: T.bg,
      fontFamily: T.sans,
      color: T.text,
      transition: "background 0.4s, color 0.4s",
    }}>

      {/* Хедер */}
      <div style={{
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: `1px solid ${T.line}`,
        position: "sticky", top: 0, zIndex: 20,
        background: `${T.bg}ee`,
        transition: "background 0.4s",
      }}>
        <div style={{
          maxWidth: 720, margin: "0 auto",
          padding: "0 20px", height: 52,
          display: "flex", alignItems: "center", gap: 14,
        }}>
          <Link href="/dashboard" style={{
            display: "flex", alignItems: "center", gap: 6,
            color: T.textMut, textDecoration: "none", fontSize: 13,
          }}>
            <ArrowLeft size={15} /> Главная
          </Link>
          <span style={{ color: T.textFaint }}>/</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: T.text }}>Настройки</span>
        </div>
      </div>

      <div style={{ maxWidth: 720, margin: "0 auto", padding: "28px 20px 64px" }}>
        <div style={{ fontFamily: T.serif, fontSize: 22, fontWeight: 700, marginBottom: 4 }}>
          Настройки профиля
        </div>
        <div style={{ fontSize: 13, color: T.textMut, marginBottom: 28 }}>
          Персонализируй аккаунт и внешний вид приложения
        </div>

        {/* Профиль */}
        <div style={{ ...card, padding: 22, marginBottom: 16 }}>
          <div style={secLabel}>Профиль</div>
          <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: T.textMut, marginBottom: 5 }}>
            Имя отображения
          </label>
          <input
            type="text"
            maxLength={64}
            placeholder="Ваше имя"
            value={name}
            onChange={e => setName(e.target.value)}
            style={{
              width: "100%", padding: "10px 14px", borderRadius: 10,
              border: `1px solid ${T.line}`,
              background: T.navy, color: T.text,
              fontFamily: T.sans, fontSize: 13, outline: "none",
              boxSizing: "border-box" as const,
            }}
          />
        </div>

        {/* Режим */}
        <div style={{ ...card, padding: 22, marginBottom: 16 }}>
          <div style={secLabel}>Режим отображения</div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div>
              <div style={{
                fontSize: 13, fontWeight: 600, color: T.text,
                display: "flex", alignItems: "center", gap: 7,
              }}>
                <span>{isDark ? "🌙" : "☀️"}</span>
                <span>{isDark ? "Тёмная тема" : "Светлая тема"}</span>
              </div>
              <div style={{ fontSize: 11, color: T.textMut, marginTop: 2 }}>
                {isDark ? "Выбери вариант тёмной темы ниже" : "Выбери вариант светлой темы ниже"}
              </div>
            </div>
            <ThemeToggle />
          </div>
        </div>

        {/* Тёмные темы */}
        {isDark && (
          <div style={{ ...card, padding: 22, marginBottom: 16 }}>
            <div style={secLabel}>Тёмная тема</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {DARK_THEMES.map(t => (
                <ThemeCard
                  key={t.id}
                  theme={t}
                  isActive={darkTheme === t.id}
                  onSelect={() => setTheme(t.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Светлые темы */}
        {!isDark && (
          <div style={{ ...card, padding: 22, marginBottom: 16 }}>
            <div style={secLabel}>Светлая тема</div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10 }}>
              {LIGHT_THEMES.map(t => (
                <ThemeCard
                  key={t.id}
                  theme={t}
                  isActive={lightTheme === t.id}
                  onSelect={() => setTheme(t.id)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Сохранить */}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={isSaving}
          style={{
            width: "100%", padding: 13, borderRadius: 12,
            border: "none",
            background: saved ? T.green : T.gold,
            color: T.bg,
            fontSize: 14, fontWeight: 700,
            cursor: "pointer", fontFamily: T.sans,
            transition: "background 0.3s", marginTop: 4,
          }}
        >
          {isSaving ? "Сохранение…" : saved ? "✓ Сохранено" : "Сохранить настройки"}
        </button>
      </div>
    </div>
  );
}