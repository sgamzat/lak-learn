import { createHmac } from "node:crypto";

type JwtPayload = Record<string, unknown> & {
  exp: number;
  iat: number;
};

function toBase64Url(input: string | Buffer): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function fromBase64Url(input: string): Buffer {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return Buffer.from(padded, "base64");
}

function parseTtlToSeconds(ttl: string): number {
  const match = ttl.trim().match(/^(\d+)([smhd])$/i);

  if (!match) {
    throw new Error(`Invalid TTL format: ${ttl}. Supported examples: 15m, 24h, 30d`);
  }

  const value = Number(match[1]);
  const unit = match[2].toLowerCase();

  switch (unit) {
    case "s":
      return value;
    case "m":
      return value * 60;
    case "h":
      return value * 60 * 60;
    case "d":
      return value * 60 * 60 * 24;
    default:
      throw new Error(`Unsupported TTL unit: ${unit}`);
  }
}

function sign(data: string, secret: string): string {
  return toBase64Url(createHmac("sha256", secret).update(data).digest());
}

export function createJwt(payload: Record<string, unknown>, secret: string, ttl: string): string {
  const now = Math.floor(Date.now() / 1000);
  const exp = now + parseTtlToSeconds(ttl);

  const header = { alg: "HS256", typ: "JWT" };
  const fullPayload: JwtPayload = {
    ...payload,
    iat: now,
    exp
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(fullPayload));
  const signature = sign(`${encodedHeader}.${encodedPayload}`, secret);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyJwt<T extends Record<string, unknown>>(token: string, secret: string): T | null {
  const [header, payload, signature] = token.split(".");

  if (!header || !payload || !signature) {
    return null;
  }

  const expected = sign(`${header}.${payload}`, secret);
  if (expected !== signature) {
    return null;
  }

  try {
    const parsed = JSON.parse(fromBase64Url(payload).toString("utf8")) as JwtPayload;

    if (typeof parsed.exp !== "number" || parsed.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }

    return parsed as T;
  } catch {
    return null;
  }
}

export function ttlToMaxAgeSeconds(ttl: string): number {
  return parseTtlToSeconds(ttl);
}

