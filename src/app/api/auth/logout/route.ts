import { NextResponse } from "next/server";
import { REFRESH_COOKIE_NAME, parseCookieHeader, revokeRefreshSessionFromToken } from "@/lib/server/auth";
import { clearAuthCookies } from "@/lib/server/session";

export async function POST(request: Request) {
  const refreshToken = parseCookieHeader(request.headers.get("cookie")).get(REFRESH_COOKIE_NAME);

  if (refreshToken) {
    await revokeRefreshSessionFromToken(refreshToken);
  }

  const response = NextResponse.json({ ok: true }, { status: 200 });
  clearAuthCookies(response);

  return response;
}
