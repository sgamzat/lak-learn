import type { DashboardData } from "@/types/dashboard";
import type { FlashcardData } from "@/types/srs";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

const defaultDashboard: DashboardData = {
  profile: {
    name: "Гамзат",
    streak: 7,
    xp: 340
  },
  progress: {
    lessonsCompleted: 24,
    accuracy: 78,
    currentLevel: "A1"
  },
  srsSummary: {
    overdue: 12,
    dueSoon: 5,
    nextReviewTime: "Сегодня, 19:00"
  },
  leaderboard: [
    { id: "u1", name: "Мадина", xp: 920, streak: 21 },
    { id: "u2", name: "Али", xp: 860, streak: 14 },
    { id: "u3", name: "Гамзат", xp: 340, streak: 7 },
    { id: "u4", name: "Зарема", xp: 310, streak: 6 },
    { id: "u5", name: "Расул", xp: 280, streak: 5 }
  ]
};

const fallbackSRSQueue: FlashcardData[] = [
  {
    id: "1",
    word: "кьини",
    transcription: "qini",
    partOfSpeech: "Сущ.",
    translation: "книга",
    exampleSentence: "Кьини столда бу.",
    intervalState: "overdue",
    nextReviewDate: new Date().toISOString()
  },
  {
    id: "2",
    word: "цӀул",
    transcription: "ts’ul",
    partOfSpeech: "Прил.",
    translation: "белый",
    exampleSentence: "ЦӀул къатӀа хъун бу.",
    intervalState: "overdue",
    nextReviewDate: new Date().toISOString()
  },
  {
    id: "3",
    word: "гъира",
    transcription: "ghira",
    partOfSpeech: "Глаг.",
    translation: "читать",
    exampleSentence: "Дир гъира кьини.",
    intervalState: "dueSoon",
    nextReviewDate: new Date().toISOString()
  },
  {
    id: "4",
    word: "вила",
    transcription: "vila",
    partOfSpeech: "Сущ.",
    translation: "село",
    exampleSentence: "НитӀти вилада яшай.",
    intervalState: "dueSoon",
    nextReviewDate: new Date().toISOString()
  },
  {
    id: "5",
    word: "ххуй",
    transcription: "hhuy",
    partOfSpeech: "Прил.",
    translation: "красивый",
    exampleSentence: "Ххуй ччатӀи ттур.",
    intervalState: "scheduled",
    nextReviewDate: new Date().toISOString()
  }
];

async function requestJson<T>(path: string): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json"
    },
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getDashboardData(): Promise<DashboardData> {
  try {
    return await requestJson<DashboardData>("/api/dashboard");
  } catch {
    return defaultDashboard;
  }
}

export async function getSRSQueue(): Promise<FlashcardData[]> {
  try {
    return await requestJson<FlashcardData[]>("/api/srs/queue");
  } catch {
    return fallbackSRSQueue;
  }
}
