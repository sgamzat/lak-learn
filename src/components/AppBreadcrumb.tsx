"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ArrowLeft } from "lucide-react";

const PAGE_TITLES: Record<string, string> = {
  "/letters":    "Алфавит",
  "/dictionary": "Словарь",
  "/review":     "Повторение",
  "/admin":      "Админ-панель",
};

export function AppBreadcrumb() {
  const pathname = usePathname();
  const isDashboard = pathname === "/dashboard" || pathname === "/";

  if (isDashboard) return null;

  const pageTitle = PAGE_TITLES[pathname] ?? null;

  return (
    <div className="mx-auto flex w-full max-w-7xl items-center gap-3 px-4 pt-4 pb-1">
      <Link
        href="/dashboard"
        className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm text-gray-500 transition hover:bg-gray-50 hover:text-gray-800"
      >
        <ArrowLeft className="h-4 w-4" />
        Главная
      </Link>
      {pageTitle && (
        <>
          <span className="text-gray-300">/</span>
          <span className="text-sm font-medium text-gray-700">{pageTitle}</span>
        </>
      )}
    </div>
  );
}