"use client";

import { useEffect, useState } from "react";

import { CategoryFilter } from "../../components/CategoryFilter";
import { fetchDictionary, type DictionaryWord } from "../../lib/api";
import { getToken } from "../../lib/auth";


export default function DictionaryPage() {
  const [words, setWords] = useState<DictionaryWord[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) {
      return;
    }
    fetchDictionary(token).then(setWords).catch((err) => setError(String(err)));
  }, []);

  async function onSearch() {
    const token = getToken();
    if (!token) {
      return;
    }
    const data = await fetchDictionary(token, query);
    setWords(data);
  }

  const filtered = activeCategory ? words.filter((w) => w.difficulty_level === activeCategory) : words;

  return (
    <main className="mx-auto min-h-screen max-w-6xl p-8">
      <h1 className="mb-4 text-3xl font-semibold">Dictionary</h1>
      <div className="mb-4 flex gap-2">
        <input
          className="flex-1 rounded bg-slate-800 px-3 py-2"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Поиск по lemma"
        />
        <button className="rounded bg-slate-700 px-4" onClick={onSearch}>
          Поиск
        </button>
      </div>
      <CategoryFilter values={["A1", "A2", "B1", "B2", "C1"]} active={activeCategory} onChange={setActiveCategory} />

      <div className="mt-4 overflow-x-auto rounded-xl border border-slate-700 bg-slate-900">
        <table className="w-full text-sm">
          <thead className="bg-slate-800 text-left text-slate-300">
            <tr>
              <th className="px-3 py-2">Lemma</th>
              <th className="px-3 py-2">Translation</th>
              <th className="px-3 py-2">POS</th>
              <th className="px-3 py-2">Level</th>
              <th className="px-3 py-2">Frequency</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((word) => (
              <tr key={word.id} className="border-t border-slate-800">
                <td className="px-3 py-2">{word.lemma}</td>
                <td className="px-3 py-2">{word.translation}</td>
                <td className="px-3 py-2">{word.pos ?? "-"}</td>
                <td className="px-3 py-2">{word.difficulty_level}</td>
                <td className="px-3 py-2">{word.frequency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {error ? <p className="mt-4 text-rose-300">{error}</p> : null}
    </main>
  );
}

