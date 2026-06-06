"use client";

import { useRouter } from "next/navigation";
import { FormEvent, useMemo, useState } from "react";

type AuthMode = "login" | "register";

interface AuthFormProps {
  mode: AuthMode;
}

interface AuthApiError {
  error?: string;
}

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submitLabel = useMemo(() => (mode === "login" ? "Войти" : "Зарегистрироваться"), [mode]);
  const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/register";

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      const body: Record<string, string> = { email, password };
      if (mode === "register" && displayName.trim()) {
        body.displayName = displayName.trim();
      }

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        let payload: AuthApiError | null = null;
        try {
          payload = (await response.json()) as AuthApiError;
        } catch {
          payload = null;
        }
        setError(payload?.error ?? "Не удалось выполнить запрос");
        return;
      }

      router.push("/dashboard");
      router.refresh();
    } catch {
      setError("Ошибка сети. Попробуйте ещё раз");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

      {mode === "register" && (
        <label className="block space-y-2">
          <span className="text-sm font-medium text-gray-700">
            Как вас зовут? <span className="text-gray-400 font-normal">(необязательно)</span>
          </span>
          <input
            type="text"
            autoComplete="name"
            maxLength={64}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Например: Муса"
          />
        </label>
      )}

      <label className="block space-y-2">
        <span className="text-sm font-medium text-gray-700">Email</span>
        <input
          type="email"
          required
          autoComplete="email"
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
        />
      </label>

      <label className="block space-y-2">
        <span className="text-sm font-medium text-gray-700">Пароль</span>
        <input
          type="password"
          required
          minLength={8}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="••••••••"
        />
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Отправка..." : submitLabel}
      </button>
    </form>
  );
}