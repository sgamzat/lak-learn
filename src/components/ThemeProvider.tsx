"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
  type ReactNode,
} from "react";

/* ── Типы ─────────────────────────────────────────────────────── */

export type DarkTheme =
  | "d-indigo" | "d-warm" | "d-cosmos"
  | "d-slate"  | "d-forest" | "d-obsidian";

export type LightTheme =
  | "l-paper" | "l-snow" | "l-sand"
  | "l-mint"  | "l-rose" | "l-stone";

export type ThemeId = DarkTheme | LightTheme;

/** Цветовые токены — читаются компонентами через useTheme().tokens */
export interface ThemeTokens {
  bg:         string;
  navy:       string;
  navy2:      string;
  navy3:      string;
  line:       string;
  lineCool:   string;
  gold:       string;
  goldHi:     string;
  goldDim:    string;
  goldBorder: string;
  text:       string;
  textMut:    string;
  textFaint:  string;
  green:      string;
  greenDim:   string;
  blue:       string;
  red:        string;
  redDim:     string;
  snow:       string;
  heroFrom:   string;
  heroTo:     string;
  mtnA:       string;
  mtnB:       string;
  serif:      string;
  sans:       string;
  mono:       string;
}

export interface ThemeOption {
  id:          ThemeId;
  name:        string;
  description: string;
  bg:          string;
  gold:        string;
  green:       string;
  tokens:      ThemeTokens;
}

/* ── Шрифты (общие для всех тем) ─────────────────────────────── */
const F = {
  serif: "'Spectral', Georgia, serif",
  sans:  "'Golos Text', system-ui, sans-serif",
  mono:  "'IBM Plex Mono', ui-monospace, monospace",
};

/* ── Тёмные темы ──────────────────────────────────────────────── */
export const DARK_THEMES: ThemeOption[] = [
  {
    id: "d-indigo", name: "Индиго",
    description: "Тёмно-синий с фиолетовым оттенком. Золото превращается в тёплый янтарь. Ночное небо над горами.",
    bg: "#0D0F1A", gold: "#DDB96A", green: "#52A87A",
    tokens: { bg:"#0D0F1A", navy:"#181A2C", navy2:"#1E2038", navy3:"#242644", line:"rgba(221,185,106,0.15)", lineCool:"rgba(157,176,199,0.14)", gold:"#DDB96A", goldHi:"#EDD08A", goldDim:"rgba(221,185,106,0.12)", goldBorder:"rgba(221,185,106,0.28)", text:"#E8EAF5", textMut:"#606888", textFaint:"#343660", green:"#52A87A", greenDim:"rgba(82,168,122,0.14)", blue:"#4A6EC4", red:"#C2503F", redDim:"rgba(194,80,63,0.14)", snow:"#C8CFF0", heroFrom:"#141628", heroTo:"#1C1E38", mtnA:"#1C1E38", mtnB:"#141628", ...F },
  },
  {
    id: "d-warm", name: "Тёплая ночь",
    description: "Тёмно-коричневый фон. Золото органично вписывается — как огонь в ночи. Уютно и тепло.",
    bg: "#16120A", gold: "#D4A537", green: "#5BAF7A",
    tokens: { bg:"#16120A", navy:"#26201A", navy2:"#2E261E", navy3:"#382E24", line:"rgba(212,165,55,0.16)", lineCool:"rgba(157,176,199,0.14)", gold:"#D4A537", goldHi:"#E7C66B", goldDim:"rgba(212,165,55,0.12)", goldBorder:"rgba(212,165,55,0.25)", text:"#ECE0C4", textMut:"#9A8870", textFaint:"#5C4E3A", green:"#5BAF7A", greenDim:"rgba(91,175,122,0.14)", blue:"#4A90C4", red:"#C2503F", redDim:"rgba(194,80,63,0.14)", snow:"#ECE0C4", heroFrom:"#2E261E", heroTo:"#382E24", mtnA:"#382E24", mtnB:"#2E261E", ...F },
  },
  {
    id: "d-cosmos", name: "Глубокий космос",
    description: "Почти чёрный с синеватым оттенком. Золото приглушено до бронзы. Элегантно, как Linear.",
    bg: "#0A0A14", gold: "#C9A96E", green: "#6A9E8A",
    tokens: { bg:"#0A0A14", navy:"#12122A", navy2:"#1A1A3A", navy3:"#22224A", line:"rgba(201,169,110,0.14)", lineCool:"rgba(157,176,199,0.12)", gold:"#C9A96E", goldHi:"#DFC090", goldDim:"rgba(201,169,110,0.12)", goldBorder:"rgba(201,169,110,0.28)", text:"#E8E0F0", textMut:"#6A7090", textFaint:"#3A3A5A", green:"#6A9E8A", greenDim:"rgba(106,158,138,0.14)", blue:"#4A6EC4", red:"#C2503F", redDim:"rgba(194,80,63,0.14)", snow:"#D0C8F0", heroFrom:"#12122A", heroTo:"#1A1A3A", mtnA:"#1A1A3A", mtnB:"#12122A", ...F },
  },
  {
    id: "d-slate", name: "Сланец",
    description: "Нейтральный тёмно-серый без оттенков. Самый профессиональный вариант. Как GitHub Dark.",
    bg: "#111418", gold: "#E2A84B", green: "#4FA876",
    tokens: { bg:"#111418", navy:"#1A1E24", navy2:"#222830", navy3:"#2A3038", line:"rgba(226,168,75,0.14)", lineCool:"rgba(157,176,199,0.14)", gold:"#E2A84B", goldHi:"#F0C070", goldDim:"rgba(226,168,75,0.12)", goldBorder:"rgba(226,168,75,0.28)", text:"#E8EDF2", textMut:"#6B7280", textFaint:"#404650", green:"#4FA876", greenDim:"rgba(79,168,118,0.14)", blue:"#4A6EC4", red:"#C2503F", redDim:"rgba(194,80,63,0.14)", snow:"#C8D4E0", heroFrom:"#1A1E24", heroTo:"#222830", mtnA:"#222830", mtnB:"#1A1E24", ...F },
  },
  {
    id: "d-forest", name: "Ночной лес",
    description: "Очень тёмный зелёный — горы Дагестана ночью. Золото резко контрастирует. Уникально.",
    bg: "#0A120E", gold: "#D4A537", green: "#5BAF7A",
    tokens: { bg:"#0A120E", navy:"#14221A", navy2:"#1A2C20", navy3:"#203626", line:"rgba(212,165,55,0.14)", lineCool:"rgba(82,112,96,0.3)", gold:"#D4A537", goldHi:"#E7C66B", goldDim:"rgba(212,165,55,0.12)", goldBorder:"rgba(212,165,55,0.28)", text:"#D8ECD0", textMut:"#527060", textFaint:"#2A4030", green:"#5BAF7A", greenDim:"rgba(91,175,122,0.14)", blue:"#4A6EC4", red:"#C2503F", redDim:"rgba(194,80,63,0.14)", snow:"#C8E0C0", heroFrom:"#0E1C14", heroTo:"#162410", mtnA:"#162410", mtnB:"#0E1C14", ...F },
  },
  {
    id: "d-obsidian", name: "Обсидиан",
    description: "Почти чёрный с тёплым коричневым намёком. Ярче золото — акцент бьёт сильнее. Для тех кто любит контраст.",
    bg: "#100C08", gold: "#F0B429", green: "#6AB882",
    tokens: { bg:"#100C08", navy:"#1C1610", navy2:"#241E16", navy3:"#2C261C", line:"rgba(240,180,41,0.15)", lineCool:"rgba(157,176,199,0.14)", gold:"#F0B429", goldHi:"#FFD060", goldDim:"rgba(240,180,41,0.13)", goldBorder:"rgba(240,180,41,0.30)", text:"#F5EDD0", textMut:"#7A6850", textFaint:"#4A3820", green:"#6AB882", greenDim:"rgba(106,184,130,0.14)", blue:"#4A6EC4", red:"#C2503F", redDim:"rgba(194,80,63,0.14)", snow:"#F5EDD0", heroFrom:"#1A1410", heroTo:"#221A12", mtnA:"#221A12", mtnB:"#1A1410", ...F },
  },
];

/* ── Светлые темы ─────────────────────────────────────────────── */
export const LIGHT_THEMES: ThemeOption[] = [
  {
    id: "l-paper", name: "Бумага",
    description: "Тёплый кремовый фон — как страница старой книги. Глаза не устают при долгом чтении.",
    bg: "#F7F4EE", gold: "#9A6E00", green: "#1E6E3A",
    tokens: { bg:"#F7F4EE", navy:"#FFFFFF", navy2:"#F0EBE1", navy3:"#E8E0D0", line:"rgba(0,0,0,0.08)", lineCool:"rgba(0,0,0,0.06)", gold:"#9A6E00", goldHi:"#B88A10", goldDim:"rgba(154,110,0,0.09)", goldBorder:"rgba(154,110,0,0.22)", text:"#1A1A14", textMut:"#6B6148", textFaint:"#B0A488", green:"#1E6E3A", greenDim:"rgba(30,110,58,0.10)", blue:"#1A5288", red:"#B83232", redDim:"rgba(184,50,50,0.10)", snow:"#F0EBE1", heroFrom:"#1A2E49", heroTo:"#253D60", mtnA:"#1E3554", mtnB:"#16283E", ...F },
  },
  {
    id: "l-snow", name: "Снег",
    description: "Белый с холодным синим намёком. Свежо и чисто — как горный воздух. Классика продуктовых приложений.",
    bg: "#F5F8FF", gold: "#B8860B", green: "#1A6E42",
    tokens: { bg:"#F5F8FF", navy:"#FFFFFF", navy2:"#EEF3FF", navy3:"#E4ECFF", line:"rgba(0,0,0,0.08)", lineCool:"rgba(0,0,0,0.06)", gold:"#B8860B", goldHi:"#D09A20", goldDim:"rgba(184,134,11,0.09)", goldBorder:"rgba(184,134,11,0.25)", text:"#0F1C2E", textMut:"#4A6080", textFaint:"#96AEBF", green:"#1A6E42", greenDim:"rgba(26,110,66,0.10)", blue:"#1246A8", red:"#B83232", redDim:"rgba(184,50,50,0.10)", snow:"#E8EDF4", heroFrom:"#1A2E49", heroTo:"#253D60", mtnA:"#1E3554", mtnB:"#16283E", ...F },
  },
  {
    id: "l-sand", name: "Песок",
    description: "Тёплый бежевый — земля и камень. Пара к «Тёплой ночи». Уютно и по-домашнему.",
    bg: "#F2EDE4", gold: "#8B5E00", green: "#1A5E32",
    tokens: { bg:"#F2EDE4", navy:"#FDFAF6", navy2:"#EDE7DC", navy3:"#E4DDD0", line:"rgba(0,0,0,0.08)", lineCool:"rgba(0,0,0,0.06)", gold:"#8B5E00", goldHi:"#A87820", goldDim:"rgba(139,94,0,0.09)", goldBorder:"rgba(139,94,0,0.22)", text:"#1C1610", textMut:"#6E5A3A", textFaint:"#B09878", green:"#1A5E32", greenDim:"rgba(26,94,50,0.10)", blue:"#1A4A8A", red:"#B03030", redDim:"rgba(176,48,48,0.10)", snow:"#EDE7DC", heroFrom:"#1A2E49", heroTo:"#253D60", mtnA:"#1E3554", mtnB:"#16283E", ...F },
  },
  {
    id: "l-mint", name: "Мята",
    description: "Свежий зелёный оттенок фона. Пара к «Ночному лесу». Природа, горные луга.",
    bg: "#F0F7F4", gold: "#9A6E00", green: "#1A6E42",
    tokens: { bg:"#F0F7F4", navy:"#FFFFFF", navy2:"#E6F2EE", navy3:"#D8EBE4", line:"rgba(0,0,0,0.08)", lineCool:"rgba(0,0,0,0.06)", gold:"#9A6E00", goldHi:"#B88A10", goldDim:"rgba(154,110,0,0.09)", goldBorder:"rgba(154,110,0,0.22)", text:"#0E1E18", textMut:"#3E6054", textFaint:"#88B0A0", green:"#1A6E42", greenDim:"rgba(26,110,66,0.10)", blue:"#1A4E8A", red:"#B83232", redDim:"rgba(184,50,50,0.10)", snow:"#D8EBE4", heroFrom:"#1A2E49", heroTo:"#253D60", mtnA:"#1E3554", mtnB:"#16283E", ...F },
  },
  {
    id: "l-rose", name: "Роза",
    description: "Едва уловимый розовый оттенок. Мягко и нежно — для тех, кто хочет чуть больше теплоты.",
    bg: "#FDF5F5", gold: "#8B5E00", green: "#1A6030",
    tokens: { bg:"#FDF5F5", navy:"#FFFFFF", navy2:"#F8EEEE", navy3:"#F0E4E4", line:"rgba(0,0,0,0.08)", lineCool:"rgba(0,0,0,0.06)", gold:"#8B5E00", goldHi:"#A87820", goldDim:"rgba(139,94,0,0.09)", goldBorder:"rgba(139,94,0,0.22)", text:"#1A1014", textMut:"#6B4A4E", textFaint:"#B898A0", green:"#1A6030", greenDim:"rgba(26,96,48,0.10)", blue:"#1A4A8A", red:"#A82828", redDim:"rgba(168,40,40,0.10)", snow:"#F0E4E4", heroFrom:"#1A2E49", heroTo:"#253D60", mtnA:"#1E3554", mtnB:"#16283E", ...F },
  },
  {
    id: "l-stone", name: "Камень",
    description: "Нейтральный серо-бежевый — горная порода. Сдержанно и строго. Пара к «Сланцу».",
    bg: "#F4F2F0", gold: "#7A5800", green: "#1A6038",
    tokens: { bg:"#F4F2F0", navy:"#FFFFFF", navy2:"#EDEBE8", navy3:"#E4E0DC", line:"rgba(0,0,0,0.08)", lineCool:"rgba(0,0,0,0.06)", gold:"#7A5800", goldHi:"#9A7420", goldDim:"rgba(122,88,0,0.09)", goldBorder:"rgba(122,88,0,0.22)", text:"#18161A", textMut:"#605C60", textFaint:"#AAA4A8", green:"#1A6038", greenDim:"rgba(26,96,56,0.10)", blue:"#1A4888", red:"#B03030", redDim:"rgba(176,48,48,0.10)", snow:"#E4E0DC", heroFrom:"#1A2E49", heroTo:"#253D60", mtnA:"#1E3554", mtnB:"#16283E", ...F },
  },
];

export const ALL_THEMES = [...DARK_THEMES, ...LIGHT_THEMES];

/* ── localStorage ─────────────────────────────────────────────── */
const LS_MODE  = "laklearn_mode";
const LS_DARK  = "laklearn_dark";
const LS_LIGHT = "laklearn_light";

const DEFAULT_DARK:  DarkTheme  = "d-indigo";
const DEFAULT_LIGHT: LightTheme = "l-paper";

function getThemeOption(id: ThemeId): ThemeOption {
  return ALL_THEMES.find(t => t.id === id) ?? DARK_THEMES[0]!;
}

/* ── Контекст ─────────────────────────────────────────────────── */
interface ThemeContextValue {
  theme:      ThemeId;
  darkTheme:  DarkTheme;
  lightTheme: LightTheme;
  isDark:     boolean;
  /** Цветовые токены активной темы — используй вместо хардкода */
  tokens:     ThemeTokens;
  setTheme:   (id: ThemeId) => void;
  toggleMode: () => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme:      DEFAULT_DARK,
  darkTheme:  DEFAULT_DARK,
  lightTheme: DEFAULT_LIGHT,
  isDark:     true,
  tokens:     DARK_THEMES[0]!.tokens,
  setTheme:   () => undefined,
  toggleMode: () => undefined,
});

/* ── Helpers ──────────────────────────────────────────────────── */
function isDarkId(id: string): id is DarkTheme {
  return id.startsWith("d-");
}

function applyThemeClass(id: ThemeId) {
  const html = document.documentElement;
  ALL_THEMES.forEach(t => html.classList.remove(`theme-${t.id}`));
  html.classList.add(`theme-${id}`);
}

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

  const theme  = isDark ? darkTheme  : lightTheme;
  const tokens = useMemo(() => getThemeOption(theme).tokens, [theme]);

  useEffect(() => {
    const { mode, dark, light } = readSaved();
    const isD = mode === "dark";
    setDarkTheme(dark);
    setLightTheme(light);
    setIsDark(isD);
    applyThemeClass(isD ? dark : light);
  }, []);

  const setTheme = useCallback((id: ThemeId) => {
    if (isDarkId(id)) {
      setDarkTheme(id);
      setIsDark(true);
      applyThemeClass(id);
      try { localStorage.setItem(LS_DARK, id); localStorage.setItem(LS_MODE, "dark"); } catch { /* ignore */ }
    } else {
      setLightTheme(id);
      setIsDark(false);
      applyThemeClass(id);
      try { localStorage.setItem(LS_LIGHT, id); localStorage.setItem(LS_MODE, "light"); } catch { /* ignore */ }
    }
  }, []);

  const toggleMode = useCallback(() => {
    setIsDark(prev => {
      const next     = !prev;
      const newTheme = next ? darkTheme : lightTheme;
      applyThemeClass(newTheme);
      try { localStorage.setItem(LS_MODE, next ? "dark" : "light"); } catch { /* ignore */ }
      return next;
    });
  }, [darkTheme, lightTheme]);

  return (
    <ThemeContext.Provider value={{ theme, darkTheme, lightTheme, isDark, tokens, setTheme, toggleMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

/* ── Хук ──────────────────────────────────────────────────────── */
export function useTheme() {
  return useContext(ThemeContext);
}