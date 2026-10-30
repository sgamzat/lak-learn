/**
 * Формат урока (content/lessons/NN.json).
 *
 * Урок — последовательность шагов: объяснение, звук, диалог, текст, правило,
 * слова и упражнения. Слова урока (words) попадают в словарь сервиса через
 * сид db/seeds/lessons.sql и после прохождения урока — в повторение.
 * Шаги ссылаются на слова по лакской записи (поле lak).
 *
 * Аудио пока нет: поле audio у реплик и слов зарезервировано, плеер
 * появится, когда будут записи.
 */

export type LakClass = "I" | "II" | "III";

export type LessonWord = {
  lak: string;
  ru: string;
  /** Транскрипция по системе учебника: [ǎ] — полузакрытое а, «:» — долгота */
  tr?: string;
  cls?: LakClass;
  note?: string;
  /** Слово или устойчивое выражение (по умолчанию слово) */
  kind?: "word" | "phrase";
  audio?: string;
};

export type LakLine = {
  lak: string;
  ru?: string;
  tr?: string;
  audio?: string;
};

export type DialogueLine = LakLine & { who: string };

export type IntroStep = { type: "intro"; text: string; points: string[] };

export type SoundStep = {
  type: "sound";
  sound: string;
  text: string;
  /** Минимальные пары: обычный звук → лакский («ча» → «чӀа») */
  pairs?: [string, string][];
  words?: string[];
};

export type DialogueStep = { type: "dialogue"; title?: string; text?: string; lines: DialogueLine[] };

export type TextStep = { type: "text"; title?: string; text?: string; sentences: LakLine[] };

export type RuleStep = {
  type: "rule";
  title: string;
  /** Простая разметка: **жирный**, пустая строка — новый абзац */
  text: string;
  examples?: LakLine[];
};

export type WordsStep = { type: "words"; title?: string; words: string[] };

export type ChoiceStep = {
  type: "choice";
  prompt: string;
  options: string[];
  answer: number;
  explain?: string;
  /** Варианты на русском (по умолчанию — лакские) */
  optionsRu?: boolean;
};

/** Собрать фразу из слов: показывается перевод, ученик расставляет слова */
export type OrderStep = { type: "order"; prompt: string; answer: string; extra?: string[] };

/** Сопоставить лакские слова с переводами */
export type MatchStep = { type: "match"; words: string[] };

/** Серия вопросов «выберите перевод» по словам урока */
export type QuizStep = { type: "quiz"; words: string[]; count?: number };

export type SummaryStep = { type: "summary"; text: string; farewell?: LakLine };

export type LessonStep =
  | IntroStep
  | SoundStep
  | DialogueStep
  | TextStep
  | RuleStep
  | WordsStep
  | ChoiceStep
  | OrderStep
  | MatchStep
  | QuizStep
  | SummaryStep;

export type ExerciseStep = ChoiceStep | OrderStep | MatchStep | QuizStep;

export const EXERCISE_TYPES = new Set<LessonStep["type"]>(["choice", "order", "match", "quiz"]);

export type Lesson = {
  number: number;
  title: string;
  titleLak: string;
  goal: string;
  sounds: string[];
  words: LessonWord[];
  steps: LessonStep[];
};

/** Краткие сведения для списка уроков */
export type LessonMeta = Pick<Lesson, "number" | "title" | "titleLak" | "goal" | "sounds"> & {
  wordCount: number;
  stepCount: number;
};

export type LessonProgress = {
  step: number;
  completedAt: string | null;
  bestScore: number | null;
};

export const CLASS_LABEL: Record<LakClass, string> = {
  I: "I класс · ур",
  II: "II класс · бур",
  III: "III класс · дур"
};
