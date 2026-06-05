"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";

// ── Типы ─────────────────────────────────────────────────────────────────────
type AuditEntry = {
  id:         string;
  actorEmail: string | null;
  action:     string;
  entityType: string;
  entityId:   string;
  payload:    unknown;
  createdAt:  string;
};

type Pagination = {
  page:       number;
  limit:      number;
  total:      number;
  totalPages: number;
};

// ── Человекочитаемые названия действий ───────────────────────────────────────
const ACTION_LABELS: Record<string, string> = {
  "admin.word.create":       "Слово добавлено",
  "admin.word.update":       "Слово изменено",
  "admin.word.delete":       "Слово удалено",
  "admin.word.export":       "Экспорт слов",
  "admin.word.import":       "Импорт слов",
  "admin.collection.create": "Набор создан",
  "admin.collection.update": "Набор изменён",
  "admin.collection.delete": "Набор удалён",
  "admin.user.update":       "Пользователь изменён",
  "admin.user.delete":       "Пользователь удалён",
};

const ACTION_COLORS: Record<string, string> = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-700",
  export: "bg-gray-100 text-gray-600",
  import: "bg-violet-100 text-violet-700",
};

function getActionColor(action: string): string {
  const verb = action.split(".").at(-1) ?? "";
  return ACTION_COLORS[verb] ?? "bg-gray-100 text-gray-600";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("ru-RU", {
    day:    "2-digit",
    month:  "2-digit",
    year:   "numeric",
    hour:   "2-digit",
    minute: "2-digit",
  });
}

// ── Компонент ─────────────────────────────────────────────────────────────────
export function AdminAuditPanel() {
  const [entries,    setEntries]    = useState<AuditEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [page,       setPage]       = useState(1);
  const [isLoading,  setIsLoading]  = useState(true);
  const [error,      setError]      = useState<string | null>(null);

  const load = useCallback(async (p: number) => {
    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/admin/audit?page=${p}`, {
        headers: { Accept: "application/json" },
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?:      string;
        entries?:    AuditEntry[];
        pagination?: Pagination;
      };

      if (!res.ok) {
        setError(payload.error ?? "Не удалось загрузить журнал");
        return;
      }

      setEntries(payload.entries ?? []);
      setPagination(payload.pagination ?? null);
    } catch {
      setError("Сетевая ошибка");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { void load(page); }, [page, load]);

  function goTo(p: number) {
    setPage(p);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">

      {/* Шапка */}
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Журнал изменений</h2>
          {pagination && (
            <p className="mt-0.5 text-xs text-gray-400">
              Всего записей: {pagination.total.toLocaleString("ru-RU")}
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={() => void load(page)}
          disabled={isLoading}
          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isLoading ? "animate-spin" : ""}`} />
          Обновить
        </button>
      </div>

      {/* Ошибка */}
      {error && (
        <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* Скелетон */}
      {isLoading && (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl bg-gray-100" />
          ))}
        </div>
      )}

      {/* Таблица */}
      {!isLoading && entries.length === 0 && !error && (
        <p className="py-10 text-center text-sm text-gray-400">Записей пока нет</p>
      )}

      {!isLoading && entries.length > 0 && (
        <div className="space-y-2">
          {entries.map((entry) => (
            <article
              key={entry.id}
              className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
            >
              {/* Бейдж действия */}
              <span className={`mt-0.5 shrink-0 rounded-lg px-2 py-1 text-xs font-medium ${getActionColor(entry.action)}`}>
                {ACTION_LABELS[entry.action] ?? entry.action}
              </span>

              {/* Детали */}
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm text-gray-700">
                  <span className="font-medium">{entry.entityType}</span>
                  {" #"}{entry.entityId}
                </p>
                <p className="mt-0.5 truncate text-xs text-gray-400">
                  {entry.actorEmail ?? "система"} · {formatDate(entry.createdAt)}
                </p>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Пагинация */}
      {pagination && pagination.totalPages > 1 && (
        <div className="mt-5 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => goTo(page - 1)}
            disabled={page <= 1 || isLoading}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Назад
          </button>

          <span className="text-sm text-gray-500">
            {page} / {pagination.totalPages}
          </span>

          <button
            type="button"
            onClick={() => goTo(page + 1)}
            disabled={page >= pagination.totalPages || isLoading}
            className="inline-flex items-center gap-1 rounded-xl border border-gray-200 px-3 py-2 text-sm text-gray-600 transition hover:bg-gray-50 disabled:opacity-40"
          >
            Вперёд
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      )}

    </section>
  );
}