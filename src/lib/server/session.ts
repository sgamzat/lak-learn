import { createHash } from "node:crypto";
import { type NextResponse } from "next/server";
import { env } from "@/lib/server/env";
import { ttlToMaxAgeSeconds } from "@/lib/server/jwt";

export const ACCESS_COOKIE_NAME = "lak_access_token";
export const REFRESH_COOKIE_NAME = "lak_refresh_token";

/**
 * Флаг Secure ставится, только если запрос пришёл по HTTPS.
 *
 * Раньше он зависел от NODE_ENV: в production куки всегда были Secure, и по
 * обычному http://192.168.…:порт (телефон в домашней сети, сервер без
 * сертификата) браузер их молча отбрасывал — вход «ничего не делал».
 * На localhost это не проявлялось: браузеры считают его защищённым.
 *
 * COOKIE_SECURE=true|false — принудительно, если прокси перед nginx
 * не передаёт X-Forwarded-Proto.
 */
export function isSecureRequest(request?: Request): boolean {
  const forced = process.env.COOKIE_SECURE?.trim().toLowerCase();
  if (forced === "true" || forced === "1") return true;
  if (forced === "false" || forced === "0") return false;
  if (!request) return process.env.NODE_ENV === "production";
  const proto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim().toLowerCase();
  if (proto) return proto === "https";
  try {
    return new URL(request.url).protocol === "https:";
  } catch {
    return false;
  }
}

function getCookieBaseOptions(maxAge: number, request?: Request) {
  return {
    httpOnly: true,
    secure: isSecureRequest(request),
    sameSite: "lax" as const,
    path: "/",
    maxAge
  };
}

export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string, request?: Request) {
  response.cookies.set(ACCESS_COOKIE_NAME, accessToken, getCookieBaseOptions(ttlToMaxAgeSeconds(env.accessTokenTtl), request));
  response.cookies.set(
    REFRESH_COOKIE_NAME,
    refreshToken,
    getCookieBaseOptions(ttlToMaxAgeSeconds(env.refreshTokenTtl), request)
  );
}

export function setAccessCookie(response: NextResponse, accessToken: string, request?: Request) {
  response.cookies.set(ACCESS_COOKIE_NAME, accessToken, getCookieBaseOptions(ttlToMaxAgeSeconds(env.accessTokenTtl), request));
}

export function clearAuthCookies(response: NextResponse, request?: Request) {
  response.cookies.set(ACCESS_COOKIE_NAME, "", getCookieBaseOptions(0, request));
  response.cookies.set(REFRESH_COOKIE_NAME, "", getCookieBaseOptions(0, request));
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
