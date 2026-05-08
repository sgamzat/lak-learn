import { redirect } from "next/navigation";
import { AdminWordForm } from "@/components/admin/AdminWordForm";
import { AdminUsersPanel } from "@/components/admin/AdminUsersPanel";
import { getPageAuthContext } from "@/lib/server/page-auth";

export default async function AdminPage() {
  const auth = await getPageAuthContext();

  if (!auth) {
    redirect("/login");
  }

  if (auth.user.role !== "admin") {
    return (
      <main className="mx-auto w-full max-w-3xl px-4 py-8">
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
          <h1 className="text-xl font-semibold text-amber-900">Доступ запрещён</h1>
          <p className="mt-2 text-sm text-amber-800">Эта страница доступна только пользователям с ролью admin.</p>
        </section>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8">
      <section className="mb-6">
        <h1 className="text-2xl font-bold">Админ-панель</h1>
        <p className="mt-1 text-sm text-gray-600">Управление словарём и зарегистрированными пользователями.</p>
      </section>

      <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <AdminWordForm />
        <AdminUsersPanel />
      </section>
    </main>
  );
}
