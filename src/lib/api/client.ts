import type { DashboardData } from "@/types/dashboard";
import type { FlashcardData } from "@/types/srs";
import type { AuthResponse } from "@/types/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

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

async function requestJsonWithMethod<T>(path: string, method: "GET" | "POST"): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method,
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
  return requestJson<DashboardData>("/api/dashboard");
}

export async function getSRSQueue(): Promise<FlashcardData[]> {
  try {
    return await requestJson<FlashcardData[]>("/api/srs/queue");
  } catch {
    return fallbackSRSQueue;
  }
}

export async function getCurrentUser(): Promise<AuthResponse["user"] | null> {
  try {
    const response = await requestJsonWithMethod<AuthResponse>("/api/auth/me", "GET");
    return response.user;
  } catch {
    return null;
  }
}

export async function logout(): Promise<boolean> {
  try {
    await requestJsonWithMethod<{ ok: boolean }>("/api/auth/logout", "POST");
    return true;
  } catch {
    return false;
  }
}
