"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { login } from "../../lib/api";
import { setTokens } from "../../lib/auth";


export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("test@example.com");
  const [password, setPassword] = useState("password123");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const tokens = await login(email, password);
      setTokens(tokens.token, tokens.refresh_token);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка входа");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <form className="w-full rounded-xl border border-slate-700 bg-slate-900 p-6" onSubmit={onSubmit}>
        <h1 className="mb-4 text-2xl font-semibold">Вход</h1>
        <div className="space-y-3">
          <input
            className="w-full rounded bg-slate-800 px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            autoComplete="email"
            required
          />
          <input
            className="w-full rounded bg-slate-800 px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            autoComplete="current-password"
            required
          />
          <button className="w-full rounded bg-emerald-700 px-4 py-2" disabled={loading}>
            {loading ? "Вход..." : "Войти"}
          </button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
        <p className="mt-4 text-sm text-slate-400">
          Нет аккаунта? <a className="text-emerald-300" href="/register">Регистрация</a>
        </p>
      </form>
    </main>
  );
}
