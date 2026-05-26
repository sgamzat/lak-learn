import { NextResponse } from "next/server";
import { getAuthContextFromRequest, publicUser } from "@/lib/server/auth";
import { setAccessCookie } from "@/lib/server/session";

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const response = NextResponse.json({ user: publicUser(auth.user) }, { status: 200 });

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}
