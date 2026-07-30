import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { getDashboardData } from "@/lib/server/dashboard";
import { setAccessCookie } from "@/lib/server/session";

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const payload = await getDashboardData(auth.user);
  const response = NextResponse.json(payload, { status: 200 });

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}
