import { redirect } from "next/navigation";
import { getPageAuthContext } from "@/lib/server/page-auth";
import { AppBreadcrumb } from "@/components/AppBreadcrumb";

export default async function AppGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const auth = await getPageAuthContext();
  if (!auth) redirect("/login");

  return (
    // Убираем bg-gray-50 — каждая страница управляет своим фоном сама.
    // DashboardShell имеет собственный тёмный фон.
    <div className="min-h-screen">
      <AppBreadcrumb />
      {children}
    </div>
  );
}