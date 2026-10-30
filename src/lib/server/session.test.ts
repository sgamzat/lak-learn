import { afterEach, describe, expect, it } from "vitest";
import { isSecureRequest } from "./session";

const req = (url: string, headers: Record<string, string> = {}) => new Request(url, { headers });

describe("isSecureRequest — флаг Secure у кук", () => {
  afterEach(() => {
    delete process.env.COOKIE_SECURE;
  });

  it("http через nginx (телефон в домашней сети) — без Secure, иначе браузер отбросит куки", () => {
    expect(isSecureRequest(req("http://192.168.1.10/api/auth/login", { "x-forwarded-proto": "http" }))).toBe(false);
  });

  it("https через прокси — Secure", () => {
    expect(isSecureRequest(req("http://app:3000/api/auth/login", { "x-forwarded-proto": "https" }))).toBe(true);
    expect(isSecureRequest(req("http://app:3000/x", { "x-forwarded-proto": "https, http" }))).toBe(true);
  });

  it("без заголовка — по адресу запроса", () => {
    expect(isSecureRequest(req("https://lak.example/x"))).toBe(true);
    expect(isSecureRequest(req("http://localhost:3000/x"))).toBe(false);
  });

  it("COOKIE_SECURE переопределяет", () => {
    process.env.COOKIE_SECURE = "true";
    expect(isSecureRequest(req("http://localhost/x"))).toBe(true);
    process.env.COOKIE_SECURE = "false";
    expect(isSecureRequest(req("https://lak.example/x"))).toBe(false);
  });
});
