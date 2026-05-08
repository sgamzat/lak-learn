import { cookies } from "next/headers";
import { getAuthContextFromCookieMap } from "@/lib/server/auth";

export async function getPageAuthContext() {
  const cookieStore = cookies();
  const cookieMap = new Map(cookieStore.getAll().map((cookie) => [cookie.name, cookie.value]));
  return getAuthContextFromCookieMap(cookieMap);
}

