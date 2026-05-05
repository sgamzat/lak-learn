"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

import { register } from "../../lib/api";
import { setTokens } from "../../lib/auth";


export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      const tokens = await register(email, password);
      setTokens(tokens.token, tokens.refresh_token);
      router.push("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка регистрации");
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md items-center px-6">
      <form className="w-full rounded-xl border border-slate-700 bg-slate-900 p-6" onSubmit={onSubmit}>
        <h1 className="mb-4 text-2xl font-semibold">Регистрация</h1>
        <div className="space-y-3">
          <input
            className="w-full rounded bg-slate-800 px-3 py-2"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="email"
            required
          />
          <input
            className="w-full rounded bg-slate-800 px-3 py-2"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="password"
            required
          />
          <button className="w-full rounded bg-blue-700 px-4 py-2">Создать аккаунт</button>
        </div>
        {error ? <p className="mt-3 text-sm text-rose-300">{error}</p> : null}
      </form>
    </main>
  );
}

