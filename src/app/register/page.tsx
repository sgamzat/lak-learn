import Link from "next/link";
import { redirect } from "next/navigation";
import { AuthForm } from "@/components/auth/AuthForm";
import { getPageAuthContext } from "@/lib/server/page-auth";

export default async function RegisterPage() {
  const auth = await getPageAuthContext();

  if (auth) {
    redirect("/dashboard");
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-md items-center px-4 py-10">
      <section className="w-full space-y-4">
        <h1 className="text-2xl font-bold">Регистрация</h1>
        <p className="text-sm text-gray-600">Создайте аккаунт для обучения.</p>
        <AuthForm mode="register" />
        <p className="text-sm text-gray-600">
          Уже есть аккаунт?{" "}
          <Link className="font-medium text-blue-600 hover:text-blue-700" href="/login">
            Войти
          </Link>
        </p>
      </section>
    </main>
  );
}

