import { redirect } from "next/navigation";
import { getPageAuthContext } from "@/lib/server/page-auth";
import { AppShell } from "@/components/AppShell";

export default async function AppGroupLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const auth = await getPageAuthContext();
  if (!auth) redirect("/login");

  return <AppShell>{children}</AppShell>;
}
