const API_BASE_URL = "/api";
const AUTH_BASE_URL = "/auth";


export type TokenPair = {
  token: string;
  refresh_token: string;
};


export type StatsResponse = {
  due_today: number;
  mastered: number;
  streak: number;
  accuracy: number;
};


export type QueueItem = {
  word_id: string;
  lemma: string;
  translation: string;
  example_sentence?: string | null;
  progress_id: string;
};


export type ReviewResponse = {
  next_word?: QueueItem | null;
  remaining: number;
  stats: {
    new: number;
    learning: number;
    review: number;
  };
};


export type DictionaryWord = {
  id: string;
  source_key?: string | null;
  lemma: string;
  translation: string;
  pos?: string | null;
  difficulty_level: string;
  frequency: number;
  example_sentence?: string | null;
};


async function parseJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `HTTP ${response.status}`);
  }
  return (await response.json()) as T;
}


export async function register(email: string, password: string): Promise<TokenPair> {
  const response = await fetch(`${AUTH_BASE_URL}/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseJson<TokenPair>(response);
}


export async function login(email: string, password: string): Promise<TokenPair> {
  const response = await fetch(`${AUTH_BASE_URL}/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  return parseJson<TokenPair>(response);
}


export async function fetchStats(token: string): Promise<StatsResponse> {
  const response = await fetch(`${API_BASE_URL}/stats`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return parseJson<StatsResponse>(response);
}


export async function fetchQueue(token: string, limit = 20): Promise<QueueItem[]> {
  const response = await fetch(`${API_BASE_URL}/study/queue?limit=${limit}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return parseJson<QueueItem[]>(response);
}


export async function submitReview(token: string, progressId: string, quality: 0 | 1 | 2 | 3): Promise<ReviewResponse> {
  const response = await fetch(`${API_BASE_URL}/study/review`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ progress_id: progressId, quality }),
  });
  return parseJson<ReviewResponse>(response);
}


export async function fetchDictionary(token: string, query?: string): Promise<DictionaryWord[]> {
  const q = query ? `?q=${encodeURIComponent(query)}` : "";
  const response = await fetch(`${API_BASE_URL}/dictionary${q}`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  return parseJson<DictionaryWord[]>(response);
}


export async function dryRunImport(token: string, file: File): Promise<{
  added: number;
  updated: number;
  skipped: number;
  errors: { word: string; reason: string }[];
}> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE_URL}/admin/import/dry-run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  return parseJson(response);
}


export async function executeImport(token: string, file: File): Promise<{ job_id: string; status: string }> {
  const form = new FormData();
  form.append("file", file);

  const response = await fetch(`${API_BASE_URL}/admin/import/execute`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });
  return parseJson(response);
}
