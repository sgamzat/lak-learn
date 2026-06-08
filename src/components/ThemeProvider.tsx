"use client";

/**
 * ThemeProvider — управляет темой приложения.
 *
 * Поддерживает 12 тем: 6 тёмных + 6 светлых.
 * Тема сохраняется в localStorage и применяется как класс на <html>.
 *
 * Использование:
 *   // layout.tsx
 *   <ThemeProvider>
 *     {children}
 *   </ThemeProvider>
 *
 *   // любой компонент
 *   const { theme, setTheme, isDark, toggleMode } = useTheme();
 */

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from "react";

/* ── Типы ─────────────────────────────────────────────────────── */

export type DarkTheme =
  | "d-indigo"
  | "d-warm"
  | "d-cosmos"
  | "d-slate"
  | "d-forest"
  | "d-obsidian";

export type LightTheme =
  | "l-paper"
  | "l-snow"
  | "l-sand"
  | "l-mint"
  | "l-rose"
  | "l-stone";

export type ThemeId = DarkTheme | LightTheme;

export interface ThemeOption {
  id: ThemeId;
  name: string;
  description: string;
  bg: string;      // цвет фона для превью
  gold: string;    // цвет акцента для превью
  green: string;   // цвет успеха для превью
}

/* ── Метаданные тем ───────────────────────────────────────────── */

export const DARK_THEMES: ThemeOption[] = [
  {
    id: "d-indigo",
    name: "Индиго",
    description: "Тёмно-синий с фиолетовым оттенком. Золото превращается в тёплый янтарь. Ночное небо над горами.",
    bg: "#0D0F1A", gold: "#DDB96A", green: "#52A87A",
  },
  {
    id: "d-warm",
    name: "Тёплая ночь",
    description: "Тёмно-коричневый фон. Золото органично вписывается — как огонь в ночи. Уютно и тепло.",
    bg: "#16120A", gold: "#D4A537", green: "#5BAF7A",
  },
  {
    id: "d-cosmos",
    name: "Глубокий космос",
    description: "Почти чёрный с синеватым оттенком. Золото приглушено до бронзы. Элегантно, как Linear.",
    bg: "#0A0A14", gold: "#C9A96E", green: "#6A9E8A",
  },
  {
    id: "d-slate",
    name: "Сланец",
    description: "Нейтральный тёмно-серый без оттенков. Самый профессиональный вариант. Как GitHub Dark.",
    bg: "#111418", gold: "#E2A84B", green: "#4FA876",
  },
  {
    id: "d-forest",
    name: "Ночной лес",
    description: "Очень тёмный зелёный — горы Дагестана ночью. Золото резко контрастирует. Уникально.",
    bg: "#0A120E", gold: "#D4A537", green: "#5BAF7A",
  },
  {
    id: "d-obsidian",
    name: "Обсидиан",
    description: "Почти чёрный с тёплым коричневым намёком. Ярче золото — акцент бьёт сильнее. Для тех кто любит контраст.",
    bg: "#100C08", gold: "#F0B429", green: "#6AB882",
  },
];

export const LIGHT_THEMES: ThemeOption[] = [
  {
    id: "l-paper",
    name: "Бумага",
    description: "Тёплый кремовый фон — как страница старой книги. Глаза не устают при долгом чтении.",
    bg: "#F7F4EE", gold: "#9A6E00", green: "#1E6E3A",
  },
  {
    id: "l-snow",
    name: "Снег",
    description: "Белый с холодным синим намёком. Свежо и чисто — как горный воздух. Классика продуктовых приложений.",
    bg: "#F5F8FF", gold: "#B8860B", green: "#1A6E42",
  },
  {
    id: "l-sand",
    name: "Песок",
    description: "Тёплый бежевый — земля и камень. Пара к «Тёплой ночи». Уютно и по-домашнему.",
    bg: "#F2EDE4", gold: "#8B5E00", green: "#1A5E32",
  },
  {
    id: "l-mint",
    name: "Мята",
    description: "Свежий зелёный оттенок фона. Пара к «Ночному лесу». Природа, горные луга.",
    bg: "#F0F7F4", gold: "#9A6E00", green: "#1A6E42",
  },
  {
    id: "l-rose",
    name: "Роза",
    description: "Едва уловимый розовый оттенок. Мягко и нежно — для тех, кто хочет чуть больше теплоты.",
    bg: "#FDF5F5", gold: "#8B5E00", green: "#1A6030",
  },
  {
    id: "l-stone",
    name: "Камень",
    description: "Нейтральный серо-бежевый — горная порода. Сдержанно и строго. Пара к «Сланцу».",
    bg: "#F4F2F0", gold: "#7A5800", green: "#1A6038",
  },
];

export const ALL_THEMES = [...DARK_THEMES, ...LIGHT_THEMES];

/* ── Константы localStorage ───────────────────────────────────── */

const LS_MODE  = "laklearn_mode";   // "dark" | "light"
const LS_DARK  = "laklearn_dark";   // DarkTheme id
const LS_LIGHT = "laklearn_light";  // LightTheme id

const DEFAULT_DARK:  DarkTheme  = "d-indigo";
const DEFAULT_LIGHT: LightTheme = "l-paper";

/* ── Контекст ─────────────────────────────────────────────────── */

interface ThemeContextValue {
  /** Текущий активный id темы */
  theme: ThemeId;
  /** Текущая тёмная тема (сохраняется при переключении в светлую) */
  darkTheme: DarkTheme;
  /** Текущая светлая тема (сохраняется при переключении в тёмную) */
  lightTheme: LightTheme;
  /** Активен ли тёмный режим */
  isDark: boolean;
  /** Применить конкретную тему (автоматически определяет dark/light) */
  setTheme: (id: ThemeId) => void;
  /** Переключить тёмный / светлый режим */
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:      DEFAULT_DARK,
  darkTheme:  DEFAULT_DARK,
  lightTheme: DEFAULT_LIGHT,
  isDark:     true,
  setTheme:   () => undefined,
  toggleMode: () => undefined,
});

/* ── Вспомогательные функции ──────────────────────────────────── */

function isDarkTheme(id: string): id is DarkTheme {
  return id.startsWith("d-");
}

/** Применяет класс темы на <html> */
function applyThemeClass(id: ThemeId) {
  const html = document.documentElement;
  // Убираем все старые классы тем
  ALL_THEMES.forEach(t => html.classList.remove(`theme-${t.id}`));
  html.classList.add(`theme-${id}`);
}

/** Читает сохранённые настройки из localStorage */
function readSaved(): { mode: "dark" | "light"; dark: DarkTheme; light: LightTheme } {
  try {
    const mode  = (localStorage.getItem(LS_MODE)  ?? "dark") as "dark" | "light";
    const dark  = (localStorage.getItem(LS_DARK)  ?? DEFAULT_DARK) as DarkTheme;
    const light = (localStorage.getItem(LS_LIGHT) ?? DEFAULT_LIGHT) as LightTheme;
    return { mode, dark, light };
  } catch {
    return { mode: "dark", dark: DEFAULT_DARK, light: DEFAULT_LIGHT };
  }
}

/* ── Provider ─────────────────────────────────────────────────── */

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [darkTheme,  setDarkTheme]  = useState<DarkTheme>(DEFAULT_DARK);
  const [lightTheme, setLightTheme] = useState<LightTheme>(DEFAULT_LIGHT);
  const [isDark,     setIsDark]     = useState(true);

  // Активная тема
  const theme: ThemeId = isDark ? darkTheme : lightTheme;

  // При монтировании — восстанавливаем из localStorage
  useEffect(() => {
    const { mode, dark, light } = readSaved();
    const isD = mode === "dark";
    setDarkTheme(dark);
    setLightTheme(light);
    setIsDark(isD);
    applyThemeClass(isD ? dark : light);
  }, []);

  // Применить конкретную тему
  const setTheme = useCallback((id: ThemeId) => {
    const newIsDark = isDarkTheme(id);

    if (newIsDark) {
      setDarkTheme(id as DarkTheme);
      setIsDark(true);
      applyThemeClass(id);
      try {
        localStorage.setItem(LS_DARK, id);
        localStorage.setItem(LS_MODE, "dark");
      } catch { /* ignore */ }
    } else {
      setLightTheme(id as LightTheme);
      setIsDark(false);
      applyThemeClass(id);
      try {
        localStorage.setItem(LS_LIGHT, id);
        localStorage.setItem(LS_MODE, "light");
      } catch { /* ignore */ }
    }
  }, []);

  // Переключить режим тёмный / светлый (сохраняя выбранные темы)
  const toggleMode = useCallback(() => {
    const newIsDark = !isDark;
    const newTheme  = newIsDark ? darkTheme : lightTheme;
    setIsDark(newIsDark);
    applyThemeClass(newTheme);
    try {
      localStorage.setItem(LS_MODE, newIsDark ? "dark" : "light");
    } catch { /* ignore */ }
  }, [isDark, darkTheme, lightTheme]);

  return (
    <ThemeContext.Provider value={{ theme, darkTheme, lightTheme, isDark, setTheme, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ── Хук ──────────────────────────────────────────────────────── */

export function useTheme() {
  return useContext(ThemeContext);
}