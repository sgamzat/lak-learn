import { cookies } from "next/headers";
import { getAuthContextFromCookieMap } from "@/lib/server/auth";

export async function getPageAuthContext() {
  // В Next 15+ cookies() асинхронный, в Next 16 синхронный доступ удалён
  const cookieStore = await cookies();
  const cookieMap = new Map(cookieStore.getAll().map((cookie) => [cookie.name, cookie.value]));
  return getAuthContextFromCookieMap(cookieMap);
}

