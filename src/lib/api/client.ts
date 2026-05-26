import type { DashboardData } from "@/types/dashboard";
import type { FlashcardData, SRSRating } from "@/types/srs";
import type { AuthResponse } from "@/types/auth";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, "") ?? "";

export type StudySelection = {
  wordIds: number[];
  collectionIds: number[];
};

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

async function requestJsonPost<T>(path: string, body: unknown): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    cache: "no-store",
    body: JSON.stringify(body)
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
  return requestJson<FlashcardData[]>("/api/srs/queue");
}

export async function submitSRSReview(wordId: string, rating: SRSRating): Promise<{ ok: boolean; nextReviewAt: string }> {
  return requestJsonPost<{ ok: boolean; nextReviewAt: string }>("/api/srs/review", { wordId, rating });
}

export async function getStudySelection(): Promise<StudySelection> {
  return requestJson<StudySelection>("/api/study");
}

export async function setStudySelection(
  type: "word" | "collection",
  id: number,
  selected: boolean
): Promise<StudySelection> {
  return requestJsonPost<StudySelection>("/api/study", { type, id, selected });
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
