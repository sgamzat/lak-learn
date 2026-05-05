"use client";

import { useState } from "react";

import { ImportPreview } from "../../../components/ImportPreview";
import { dryRunImport, executeImport } from "../../../lib/api";
import { getToken } from "../../../lib/auth";


export default function AdminImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<{
    added: number;
    updated: number;
    skipped: number;
    errors: { word: string; reason: string }[];
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function handleDryRun() {
    const token = getToken();
    if (!token || !file) {
      return;
    }
    const result = await dryRunImport(token, file);
    setPreview(result);
  }

  async function handleExecute() {
    const token = getToken();
    if (!token || !file) {
      return;
    }
    const result = await executeImport(token, file);
    setMessage(`Import job started: ${result.job_id}`);
  }

  return (
    <main className="mx-auto min-h-screen max-w-5xl p-8">
      <h1 className="mb-4 text-3xl font-semibold">Admin Import</h1>
      <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
        <input
          type="file"
          accept="application/json"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="mb-4 block w-full text-sm"
        />
        <div className="flex gap-2">
          <button className="rounded bg-amber-700 px-4 py-2" onClick={handleDryRun}>
            Dry-run
          </button>
          <button className="rounded bg-emerald-700 px-4 py-2" onClick={handleExecute}>
            Запустить
          </button>
        </div>
      </div>
      <div className="mt-4">
        <ImportPreview data={preview} />
      </div>
      {message ? <p className="mt-4 text-emerald-300">{message}</p> : null}
    </main>
  );
}

