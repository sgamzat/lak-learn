import { describe, expect, it } from "vitest";
import { createJwt, verifyJwt } from "@/lib/server/jwt";

const SECRET = "s".repeat(40);

describe("verifyJwt", () => {
  it("принимает корректный токен", () => {
    const token = createJwt({ sub: "u1" }, SECRET, "15m");
    expect(verifyJwt<{ sub: string }>(token, SECRET)?.sub).toBe("u1");
  });

  it("отклоняет изменённую, укороченную или чужую подпись", () => {
    const token = createJwt({ sub: "u1" }, SECRET, "15m");
    const [h, p, s] = token.split(".");
    const flipped = s.slice(0, -1) + (s.endsWith("A") ? "B" : "A");
    expect(verifyJwt(`${h}.${p}.${flipped}`, SECRET)).toBeNull();
    expect(verifyJwt(`${h}.${p}.abc`, SECRET)).toBeNull();
    expect(verifyJwt(token, "x".repeat(40))).toBeNull();
  });

  it("отклоняет изменённый payload", () => {
    const token = createJwt({ sub: "u1", role: "user" }, SECRET, "15m");
    const [h, , s] = token.split(".");
    const forged = Buffer.from(JSON.stringify({ sub: "u1", role: "admin", iat: 0, exp: 9_999_999_999 }))
      .toString("base64url");
    expect(verifyJwt(`${h}.${forged}.${s}`, SECRET)).toBeNull();
  });

  it("отклоняет просроченный токен", () => {
    const token = createJwt({ sub: "u1" }, SECRET, "0s");
    const later = Date.now;
    Date.now = () => later() + 2_000;
    try {
      expect(verifyJwt(token, SECRET)).toBeNull();
    } finally {
      Date.now = later;
    }
  });
});
