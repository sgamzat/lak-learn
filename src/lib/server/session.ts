import { createHash } from "node:crypto";
import { type NextResponse } from "next/server";
import { env } from "@/lib/server/env";
import { ttlToMaxAgeSeconds } from "@/lib/server/jwt";

export const ACCESS_COOKIE_NAME = "lak_access_token";
export const REFRESH_COOKIE_NAME = "lak_refresh_token";

function getCookieBaseOptions(maxAge: number) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge
  };
}

export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string) {
  response.cookies.set(ACCESS_COOKIE_NAME, accessToken, getCookieBaseOptions(ttlToMaxAgeSeconds(env.accessTokenTtl)));
  response.cookies.set(
    REFRESH_COOKIE_NAME,
    refreshToken,
    getCookieBaseOptions(ttlToMaxAgeSeconds(env.refreshTokenTtl))
  );
}

export function setAccessCookie(response: NextResponse, accessToken: string) {
  response.cookies.set(ACCESS_COOKIE_NAME, accessToken, getCookieBaseOptions(ttlToMaxAgeSeconds(env.accessTokenTtl)));
}

export function clearAuthCookies(response: NextResponse) {
  response.cookies.set(ACCESS_COOKIE_NAME, "", getCookieBaseOptions(0));
  response.cookies.set(REFRESH_COOKIE_NAME, "", getCookieBaseOptions(0));
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
