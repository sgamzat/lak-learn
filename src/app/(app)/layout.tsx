import { redirect } from "next/navigation";
import { getPageAuthContext } from "@/lib/server/page-auth";

export default async function AppGroupLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  const auth = await getPageAuthContext();

  if (!auth) {
    redirect("/login");
  }

  return <main className="min-h-screen">{children}</main>;
}
