import { redirect } from "next/navigation";
import Link from "next/link";
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

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto flex w-full max-w-7xl items-center justify-end px-4 pt-4">
        <Link
          href="/"
          className="inline-flex min-h-11 items-center rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 transition hover:bg-gray-100"
        >
          На главный экран
        </Link>
      </div>
      {children}
    </main>
  );
}
