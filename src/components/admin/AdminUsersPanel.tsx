"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type AdminUser = {
  id: string;
  email: string;
  displayName: string;
  role: "user" | "admin";
  isBlocked: boolean;
  createdAt: string;
  xp: number;
  streak: number;
  learnedWords: number;
};

type StatusState =
  | { type: "idle" }
  | { type: "success"; message: string }
  | { type: "error"; message: string };

export function AdminUsersPanel() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [updatingUserId, setUpdatingUserId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<StatusState>({ type: "idle" });

  const reloadUsers = useCallback(async () => {
    setIsLoading(true);
    setStatus({ type: "idle" });

    try {
      const response = await fetch("/api/admin/users", {
        method: "GET",
        headers: {
          Accept: "application/json"
        }
      });

      const payload = (await response.json().catch(() => ({}))) as { error?: string; users?: AdminUser[] };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось загрузить пользователей" });
        setUsers([]);
        return;
      }

      setUsers(payload.users ?? []);
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при загрузке пользователей" });
      setUsers([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void reloadUsers();
  }, [reloadUsers]);

  async function updateUser(userId: string, patch: { role?: "user" | "admin"; isBlocked?: boolean }) {
    setUpdatingUserId(userId);
    setStatus({ type: "idle" });

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify(patch)
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        user?: { id: string; role: "user" | "admin"; isBlocked: boolean };
      };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось обновить пользователя" });
        return;
      }

      setUsers((current) =>
        current.map((item) =>
          item.id === userId
            ? {
                ...item,
                role: payload.user?.role ?? item.role,
                isBlocked: payload.user?.isBlocked ?? item.isBlocked
              }
            : item
        )
      );

      setStatus({ type: "success", message: "Пользователь успешно обновлён" });
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при обновлении пользователя" });
    } finally {
      setUpdatingUserId(null);
    }
  }

  async function deleteUser(userId: string, displayName: string) {
    const confirmed = window.confirm(`Удалить пользователя «${displayName}»? Действие необратимо.`);
    if (!confirmed) {
      return;
    }

    setDeletingUserId(userId);
    setStatus({ type: "idle" });

    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: "DELETE",
        headers: {
          Accept: "application/json"
        }
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        user?: { id: string; email: string };
      };

      if (!response.ok) {
        setStatus({ type: "error", message: payload.error ?? "Не удалось удалить пользователя" });
        return;
      }

      setUsers((current) => current.filter((item) => item.id !== userId));
      setStatus({ type: "success", message: "Пользователь удалён" });
    } catch {
      setStatus({ type: "error", message: "Сетевая ошибка при удалении пользователя" });
    } finally {
      setDeletingUserId(null);
    }
  }

  const sortedUsers = useMemo(
    () => [...users].sort((a, b) => b.xp - a.xp || b.streak - a.streak || a.email.localeCompare(b.email)),
    [users]
  );

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Управление пользователями</h2>
        <button
          type="button"
          onClick={() => void reloadUsers()}
          disabled={isLoading}
          className="inline-flex min-h-11 items-center rounded-xl border border-gray-300 px-3 text-sm transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Обновить
        </button>
      </div>

      {status.type === "error" ? <p className="mb-3 text-sm text-red-600">{status.message}</p> : null}
      {status.type === "success" ? <p className="mb-3 text-sm text-green-700">{status.message}</p> : null}

      {isLoading ? (
        <p className="text-sm text-gray-600">Загрузка пользователей...</p>
      ) : (
        <div className="max-h-[520px] space-y-3 overflow-auto pr-1">
          {sortedUsers.map((user) => {
            const isUpdating = updatingUserId === user.id;
            const isDeleting = deletingUserId === user.id;
            const isBusy = isUpdating || isDeleting;

            return (
              <article key={user.id} className="rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-medium text-gray-900">{user.displayName}</p>
                    <p className="text-xs text-gray-500">{user.email}</p>
                    <p className="mt-1 text-xs text-gray-500">
                      XP: {user.xp} · Серия: {user.streak} · Слов выучено: {user.learnedWords}
                    </p>
                  </div>

                  <div className="text-right">
                    <p
                      className={
                        user.isBlocked
                          ? "inline-flex rounded-full bg-red-100 px-2 py-1 text-xs font-medium text-red-700"
                          : "inline-flex rounded-full bg-emerald-100 px-2 py-1 text-xs font-medium text-emerald-700"
                      }
                    >
                      {user.isBlocked ? "Заблокирован" : "Активен"}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Роль: {user.role}</p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {user.role === "admin" ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void updateUser(user.id, { role: "user" })}
                      className="inline-flex min-h-11 items-center rounded-xl border border-amber-300 px-3 text-sm text-amber-700 transition hover:bg-amber-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Снять admin
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void updateUser(user.id, { role: "admin" })}
                      className="inline-flex min-h-11 items-center rounded-xl border border-blue-300 px-3 text-sm text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Сделать admin
                    </button>
                  )}

                  {user.isBlocked ? (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void updateUser(user.id, { isBlocked: false })}
                      className="inline-flex min-h-11 items-center rounded-xl border border-emerald-300 px-3 text-sm text-emerald-700 transition hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Разблокировать
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => void updateUser(user.id, { isBlocked: true })}
                      className="inline-flex min-h-11 items-center rounded-xl border border-red-300 px-3 text-sm text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      Заблокировать
                    </button>
                  )}

                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => void deleteUser(user.id, user.displayName)}
                    className="inline-flex min-h-11 items-center rounded-xl border border-red-500 px-3 text-sm text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isDeleting ? "Удаляю..." : "Удалить пользователя"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
