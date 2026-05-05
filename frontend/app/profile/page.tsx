"use client";

import { useState } from "react";

import { getToken } from "../../lib/auth";


export default function ProfilePage() {
  const [exportData, setExportData] = useState<string | null>(null);

  async function handleExport() {
    const token = getToken();
    if (!token) {
      return;
    }
    const response = await fetch("/api/admin/export?format=json", {
      headers: { Authorization: `Bearer ${token}` },
    });
    const body = await response.json();
    setExportData(JSON.stringify(body, null, 2));
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl p-8">
      <h1 className="mb-4 text-3xl font-semibold">Profile</h1>
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <button className="rounded bg-slate-700 px-4 py-2" onClick={handleExport}>
          Экспорт слов (JSON)
        </button>
      </div>
      {exportData ? <pre className="mt-4 overflow-auto rounded bg-slate-950 p-4 text-xs">{exportData}</pre> : null}
    </main>
  );
}

