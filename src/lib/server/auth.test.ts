import { describe, expect, it } from "vitest";
import { parseCookieHeader, publicUser } from "@/lib/server/auth";
import type { AuthUser } from "@/types/auth";

describe("auth helpers", () => {
  it("parseCookieHeader parses and decodes cookies", () => {
    const map = parseCookieHeader("a=1; b=hello%20world; empty=");
    expect(map.get("a")).toBe("1");
    expect(map.get("b")).toBe("hello world");
    expect(map.get("empty")).toBe("");
    expect(parseCookieHeader(null).size).toBe(0);
  });

  it("publicUser omits sensitive fields", () => {
    const user: AuthUser = {
      id: "u1",
      email: "a@b.c",
      role: "user",
      isBlocked: false
    };

    expect(publicUser(user)).toEqual({
      id: "u1",
      email: "a@b.c",
      role: "user"
    });
  });
});
