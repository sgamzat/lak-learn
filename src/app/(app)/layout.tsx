import { redirect } from "next/navigation";
import { getPageAuthContext } from "@/lib/server/page-auth";
import { AppBreadcrumb } from "@/components/AppBreadcrumb";

export default async function AppGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const auth = await getPageAuthContext();
  if (!auth) redirect("/login");

  return (
    <main className="min-h-screen bg-gray-50">
      <AppBreadcrumb />
      {children}
    </main>
  );
}