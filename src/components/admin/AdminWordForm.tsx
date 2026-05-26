"use client";

import { FormEvent, useState } from "react";

type StatusState =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

type WordFormat = "json" | "yaml" | "csv";
type TransferMode = "flat" | "backup";

type ImportSummary = {
  total: number;
  added: number;
  updated?: number;
  skipped: number;
  invalid: number;
  collectionsCreated?: number;
  linksAdded?: number;
  linksUpdated?: number;
  linksSkipped?: number;
  invalidItems?: Array<{ index: number; reason: string }>;
};

export function AdminWordForm() {
  const [lemma, setLemma] = useState("");
  const [translation, setTranslation] = useState("");
  const [transcription, setTranscription] = useState("");
  const [partOfSpeech, setPartOfSpeech] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<StatusState>({ type: "idle" });
  const [wordFormat, setWordFormat] = useState<WordFormat>("json");
  const [transferMode, setTransferMode] = useState<TransferMode>("flat");
  const [importFile, setImportFile] = useState<File | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setStatus({ type: "idle" });

    try {
      const response = await fetch("/api/admin/words", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          lemma,
          translation,
          transcription,
          partOfSpeech
        })
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; id?: number };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось добавить слово" });
        return;
      }

      setLemma("");
      setTranslation("");
      setTranscription("");
      setPartOfSpeech("");
      setStatus({ type: "success", message: `Слово добавлено (id: ${payload.id ?? "n/a"})` });
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка, попробуйте ещё раз" });
    } finally {
      setIsSubmitting(false);
    }
  }

  async function exportWords() {
    setIsExporting(true);
    setStatus({ type: "idle" });

    try {
      const response = await fetch(`/api/admin/words?format=${wordFormat}&mode=${transferMode}`, {
        method: "GET"
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        setStatus({ type: "error", message: payload.error ?? "Не удалось экспортировать слова" });
        return;
      }

      const blob = await response.blob();
      const href = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = href;
      anchor.download = `words-${transferMode}-export.${wordFormat}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);

      setStatus({ type: "success", message: `Экспорт завершён: words-${transferMode}-export.${wordFormat}` });
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при экспорте" });
    } finally {
      setIsExporting(false);
    }
  }

  async function importWords() {
    if (!importFile) {
      setStatus({ type: "error", message: "Выберите файл для импорта" });
      return;
    }

    setIsImporting(true);
    setImportSummary(null);
    setStatus({ type: "idle" });

    try {
      const content = await importFile.text();
      const response = await fetch("/api/admin/words", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          format: wordFormat,
          mode: transferMode,
          content
        })
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        summary?: ImportSummary;
      };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось импортировать слова" });
        return;
      }

      setImportSummary(payload.summary ?? null);
      setStatus({ type: "success", message: `Импорт (${transferMode}) завершён` });
      setImportFile(null);
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при импорте" });
    } finally {
      setIsImporting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-semibold">Добавить слово</h2>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Слово (lemma) *</span>
        <input
          required
          value={lemma}
          onChange={(event) => setLemma(event.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          placeholder="кьини"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Перевод *</span>
        <input
          required
          value={translation}
          onChange={(event) => setTranslation(event.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          placeholder="книга"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Транскрипция</span>
        <input
          value={transcription}
          onChange={(event) => setTranscription(event.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          placeholder="qini"
        />
      </label>

      <label className="block space-y-1">
        <span className="text-sm font-medium text-gray-700">Часть речи</span>
        <input
          value={partOfSpeech}
          onChange={(event) => setPartOfSpeech(event.target.value)}
          className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          placeholder="Сущ."
        />
      </label>

      {status.type === "error" ? <p className="text-sm text-red-600">{status.message}</p> : null}
      {status.type === "success" ? <p className="text-sm text-green-700">{status.message}</p> : null}

      <button
        type="submit"
        disabled={isSubmitting}
        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2 font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isSubmitting ? "Сохраняю..." : "Добавить слово"}
      </button>

      <hr className="border-gray-200" />

      <section className="space-y-3">
        <h3 className="text-base font-semibold">Импорт / Экспорт слов</h3>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Режим</span>
          <select
            value={transferMode}
            onChange={(event) => setTransferMode(event.target.value as TransferMode)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          >
            <option value="flat">Flat — для ручного пополнения словаря</option>
            <option value="backup">Backup — для полного восстановления БД</option>
          </select>
          <p className="text-xs text-gray-500">
            Flat: обязательна колонка collectionSlug для привязки слова к набору. Backup: сохраняет расширенные поля
            набора и связи для восстановления.
          </p>
        </label>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Формат</span>
          <select
            value={wordFormat}
            onChange={(event) => setWordFormat(event.target.value as WordFormat)}
            className="w-full rounded-xl border border-gray-300 px-4 py-3 text-sm outline-none transition focus:border-blue-500"
          >
            <option value="json">JSON</option>
            <option value="yaml">YAML</option>
            <option value="csv">CSV</option>
          </select>
        </label>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => void exportWords()}
            disabled={isExporting || isImporting}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-blue-300 px-4 py-2 text-sm font-medium text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isExporting ? "Экспорт..." : "Экспортировать"}
          </button>

          <button
            type="button"
            onClick={() => void importWords()}
            disabled={isImporting || isExporting || !importFile}
            className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-300 px-4 py-2 text-sm font-medium text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isImporting ? "Импорт..." : "Импортировать"}
          </button>
        </div>

        <label className="block space-y-1">
          <span className="text-sm font-medium text-gray-700">Файл для импорта</span>
          <input
            type="file"
            accept=".json,.yaml,.yml,.csv,text/csv,application/json,application/x-yaml,text/yaml"
            onChange={(event) => setImportFile(event.target.files?.[0] ?? null)}
            className="block w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
        </label>

        {importSummary ? (
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-sm text-gray-700">
            <p>
              Всего: {importSummary.total} · Добавлено: {importSummary.added} · Обновлено: {importSummary.updated ?? 0} ·
              Пропущено: {importSummary.skipped} · Невалидных: {importSummary.invalid}
            </p>
            <p className="mt-1 text-xs text-gray-500">
              Наборов создано: {importSummary.collectionsCreated ?? 0} · Связей добавлено: {importSummary.linksAdded ?? 0} ·
              Связей обновлено: {importSummary.linksUpdated ?? 0} · Связей без изменений: {importSummary.linksSkipped ?? 0}
            </p>
            {importSummary.invalidItems?.length ? (
              <p className="mt-1 text-xs text-gray-500">
                Примеры ошибок: {importSummary.invalidItems.slice(0, 3).map((item) => `#${item.index} ${item.reason}`).join("; ")}
              </p>
            ) : null}
          </div>
        ) : null}
      </section>
    </form>
  );
}
