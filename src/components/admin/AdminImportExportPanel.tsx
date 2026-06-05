"use client";

import { useState } from "react";
import { Upload, Download, FileJson, FileText } from "lucide-react";

// ── Типы ─────────────────────────────────────────────────────────────────────
type WordFormat   = "json" | "csv";
type TransferMode = "flat" | "backup";

type ImportSummary = {
  total:               number;
  added:               number;
  updated?:            number;
  skipped:             number;
  invalid:             number;
  collectionsCreated?: number;
  linksAdded?:         number;
  linksUpdated?:       number;
  linksSkipped?:       number;
  invalidItems?:       Array<{ index: number; reason: string }>;
};

type StatusState =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error";   message: string };

// ── Определяем формат по расширению файла ────────────────────────────────────
function detectFormat(file: File): WordFormat | null {
  const name = file.name.toLowerCase();
  if (name.endsWith(".json")) return "json";
  if (name.endsWith(".csv"))  return "csv";
  return null;
}

// ── Определяем режим по содержимому (есть ли поля backup) ────────────────────
function detectMode(content: string, format: WordFormat): TransferMode {
  if (format === "csv") {
    const firstLine = content.split("\n")[0] ?? "";
    return firstLine.includes("collectionIsPublic") || firstLine.includes("collectionSortOrder")
      ? "backup"
      : "flat";
  }
  // JSON
  try {
    const parsed = JSON.parse(content) as unknown[];
    const first  = Array.isArray(parsed) ? parsed[0] : null;
    if (first && typeof first === "object" && ("collectionIsPublic" in first || "collectionSortOrder" in first)) {
      return "backup";
    }
  } catch {
    // ignore
  }
  return "flat";
}

// ── Компонент ─────────────────────────────────────────────────────────────────
export function AdminImportExportPanel() {
  const [exportFormat, setExportFormat] = useState<WordFormat>("json");
  const [exportMode,   setExportMode]   = useState<TransferMode>("flat");
  const [importFile,   setImportFile]   = useState<File | null>(null);
  const [isExporting,  setIsExporting]  = useState(false);
  const [isImporting,  setIsImporting]  = useState(false);
  const [importSummary, setImportSummary] = useState<ImportSummary | null>(null);
  const [status,       setStatus]       = useState<StatusState>({ type: "idle" });

  // ── Экспорт ────────────────────────────────────────────────────────────────
  async function handleExport() {
    setIsExporting(true);
    setStatus({ type: "idle" });
    setImportSummary(null);

    try {
      const res = await fetch(
        `/api/admin/words?format=${exportFormat}&mode=${exportMode}`,
        { method: "GET" }
      );

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        setStatus({ type: "error", message: payload.error ?? "Не удалось экспортировать" });
        return;
      }

      const blob   = await res.blob();
      const href   = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href     = href;
      anchor.download = `words-${exportMode}-export.${exportFormat}`;
      document.body.append(anchor);
      anchor.click();
      anchor.remove();
      URL.revokeObjectURL(href);

      setStatus({ type: "success", message: `Экспорт завершён: words-${exportMode}-export.${exportFormat}` });
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при экспорте" });
    } finally {
      setIsExporting(false);
    }
  }

  // ── Импорт ────────────────────────────────────────────────────────────────
  async function handleImport() {
    if (!importFile) {
      setStatus({ type: "error", message: "Выберите файл для импорта" });
      return;
    }

    const format = detectFormat(importFile);
    if (!format) {
      setStatus({ type: "error", message: "Поддерживаются только .json и .csv файлы" });
      return;
    }

    setIsImporting(true);
    setImportSummary(null);
    setStatus({ type: "idle" });

    try {
      const content = await importFile.text();
      const mode    = detectMode(content, format);

      const res = await fetch("/api/admin/words", {
        method:  "PUT",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body:    JSON.stringify({ format, mode, content }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?:   string;
        summary?: ImportSummary;
      };

      if (!res.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось импортировать" });
        return;
      }

      setImportSummary(payload.summary ?? null);
      setStatus({ type: "success", message: `Импорт завершён (режим: ${mode})` });
      setImportFile(null);

      // Сбрасываем input
      const fileInput = document.getElementById("import-file-input") as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при импорте" });
    } finally {
      setIsImporting(false);
    }
  }

  const busy = isExporting || isImporting;

  return (
    <div className="space-y-4">

      {/* ── Экспорт ──────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Download className="h-5 w-5 text-blue-600" />
          <h2 className="text-lg font-semibold">Экспорт</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Скачать все слова из базы в файл.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-3">
          {/* Формат */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-600">Формат</p>
            <div className="flex gap-2">
              {(["json", "csv"] as WordFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setExportFormat(f)}
                  className={[
                    "inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition",
                    exportFormat === f
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50",
                  ].join(" ")}
                >
                  {f === "json"
                    ? <FileJson className="h-3.5 w-3.5" />
                    : <FileText className="h-3.5 w-3.5" />}
                  {f.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Режим */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-gray-600">Режим</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setExportMode("flat")}
                className={[
                  "inline-flex flex-1 items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition",
                  exportMode === "flat"
                    ? "border-blue-500 bg-blue-50 text-blue-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50",
                ].join(" ")}
              >
                Словарь
              </button>
              <button
                type="button"
                onClick={() => setExportMode("backup")}
                className={[
                  "inline-flex flex-1 items-center justify-center rounded-xl border px-3 py-2 text-sm font-medium transition",
                  exportMode === "backup"
                    ? "border-amber-500 bg-amber-50 text-amber-700"
                    : "border-gray-200 text-gray-600 hover:bg-gray-50",
                ].join(" ")}
              >
                Резервная копия
              </button>
            </div>
            <p className="mt-1 text-xs text-gray-400">
              {exportMode === "flat"
                ? "Слова и переводы для пополнения базы или обмена."
                : "Полный снимок БД — для переезда на другой сервер."}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void handleExport()}
          disabled={busy}
          className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Download className="h-4 w-4" />
          {isExporting ? "Экспортирую..." : "Скачать файл"}
        </button>
      </section>

      {/* ── Импорт ───────────────────────────────────────────────────────── */}
      <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <Upload className="h-5 w-5 text-emerald-600" />
          <h2 className="text-lg font-semibold">Импорт</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          Загрузить слова из файла. Формат и режим определяются автоматически.
        </p>

        <div className="mt-4 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 p-4 text-center">
          <input
            id="import-file-input"
            type="file"
            accept=".json,.csv,application/json,text/csv"
            onChange={(e) => {
              setImportFile(e.target.files?.[0] ?? null);
              setImportSummary(null);
              setStatus({ type: "idle" });
            }}
            className="hidden"
          />
          <label
            htmlFor="import-file-input"
            className="cursor-pointer"
          >
            {importFile ? (
              <div>
                <p className="font-medium text-gray-800">{importFile.name}</p>
                <p className="text-xs text-gray-500 mt-0.5">
                  {(importFile.size / 1024).toFixed(1)} KB ·{" "}
                  {detectFormat(importFile)?.toUpperCase() ?? "неизвестный формат"}
                </p>
              </div>
            ) : (
              <div>
                <Upload className="mx-auto h-8 w-8 text-gray-300" />
                <p className="mt-2 text-sm text-gray-500">
                  Нажмите чтобы выбрать <span className="font-medium text-gray-700">.json</span> или{" "}
                  <span className="font-medium text-gray-700">.csv</span>
                </p>
              </div>
            )}
          </label>
        </div>

        <button
          type="button"
          onClick={() => void handleImport()}
          disabled={busy || !importFile}
          className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Upload className="h-4 w-4" />
          {isImporting ? "Импортирую..." : "Загрузить файл"}
        </button>

        {/* Итог импорта */}
        {importSummary && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm">
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-gray-700 sm:grid-cols-4">
              <div><span className="text-xs text-gray-500 block">Всего</span>{importSummary.total}</div>
              <div><span className="text-xs text-gray-500 block">Добавлено</span>{importSummary.added}</div>
              <div><span className="text-xs text-gray-500 block">Обновлено</span>{importSummary.updated ?? 0}</div>
              <div><span className="text-xs text-gray-500 block">Невалидных</span>{importSummary.invalid}</div>
            </div>

            {(importSummary.collectionsCreated ?? 0) > 0 && (
              <p className="mt-2 text-xs text-gray-500">
                Наборов создано: {importSummary.collectionsCreated} ·
                Связей добавлено: {importSummary.linksAdded ?? 0}
              </p>
            )}

            {importSummary.invalidItems && importSummary.invalidItems.length > 0 && (
              <p className="mt-2 text-xs text-red-600">
                Ошибки: {importSummary.invalidItems.slice(0, 3).map((i) => `#${i.index} ${i.reason}`).join(" · ")}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Статус */}
      {status.type === "error" && (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {status.message}
        </p>
      )}
      {status.type === "success" && (
        <p className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {status.message}
        </p>
      )}

    </div>
  );
}