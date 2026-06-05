"use client";

import { useState } from "react";
import { LayoutList, BookOpen, Users, ScrollText, BookMarked } from "lucide-react";
import { AdminCollectionsPanel }  from "@/components/admin/AdminCollectionsPanel";
import { AdminImportExportPanel } from "@/components/admin/AdminImportExportPanel";
import { AdminUsersPanel }        from "@/components/admin/AdminUsersPanel";
import { AdminWordsPanel }        from "@/components/admin/AdminWordsPanel";
import { AdminAuditPanel }        from "@/components/admin/AdminAuditPanel";
import { AdminStats }             from "@/components/admin/AdminStats";

type TabId = "collections" | "words" | "import" | "users" | "audit";

const TABS = [
  { id: "collections" as TabId, label: "Наборы",           icon: <LayoutList className="h-4 w-4" /> },
  { id: "words"       as TabId, label: "Слова",             icon: <BookMarked className="h-4 w-4" /> },
  { id: "import"      as TabId, label: "Импорт / Экспорт", icon: <BookOpen   className="h-4 w-4" /> },
  { id: "users"       as TabId, label: "Пользователи",      icon: <Users      className="h-4 w-4" /> },
  { id: "audit"       as TabId, label: "Журнал",            icon: <ScrollText className="h-4 w-4" /> },
];

export function AdminTabs() {
  const [active, setActive] = useState<TabId>("collections");

  return (
    <div className="space-y-4">

      {/* ── Статистика ───────────────────────────────────────────── */}
      <AdminStats />

      {/* ── Таб-бар ─────────────────────────────────────────────── */}
      <div className="flex gap-1 rounded-2xl border border-gray-200 bg-white p-1.5">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActive(tab.id)}
            className={[
              "inline-flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition",
              active === tab.id
                ? "bg-blue-600 text-white shadow-sm"
                : "text-gray-500 hover:bg-gray-100 hover:text-gray-800",
            ].join(" ")}
          >
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── Контент ──────────────────────────────────────────────── */}
      <div>
        {active === "collections" && <AdminCollectionsPanel />}
        {active === "words"       && <AdminWordsPanel />}
        {active === "import"      && <AdminImportExportPanel />}
        {active === "users"       && <AdminUsersPanel />}
        {active === "audit"       && <AdminAuditPanel />}
      </div>

    </div>
  );
}