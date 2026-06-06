import { randomUUID } from "node:crypto";
import { query, withTransaction } from "@/lib/server/db";
import { env } from "@/lib/server/env";
import { createJwt, ttlToMaxAgeSeconds, verifyJwt } from "@/lib/server/jwt";
import { verifyPassword, hashPassword } from "@/lib/server/password";
import { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME, hashToken } from "@/lib/server/session";
import type { AuthUser, UserRole } from "@/types/auth";

type DbUserRow = {
  id: string;
  email: string;
  password_hash: string;
  is_blocked: boolean;
  role: UserRole;
};

type AccessTokenPayload = {
  sub: string;
  email: string;
  role: UserRole;
  type: "access";
  exp: number;
  iat: number;
};

type RefreshTokenPayload = {
  sub: string;
  sid: string;
  type: "refresh";
  exp: number;
  iat: number;
};

export type AuthContext = {
  user: AuthUser;
  refreshedAccessToken?: string;
};

export type RequestMeta = {
  userAgent: string | null;
  ipAddress: string | null;
};

export function parseCookieHeader(cookieHeader: string | null): Map<string, string> {
  const map = new Map<string, string>();

  if (!cookieHeader) {
    return map;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, ...valueParts] = part.trim().split("=");

    if (!name) {
      continue;
    }

    map.set(name, decodeURIComponent(valueParts.join("=")));
  }

  return map;
}

export function extractRequestMeta(headers: Headers): RequestMeta {
  const forwarded = headers.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || null;

  return {
    userAgent: headers.get("user-agent"),
    ipAddress
  };
}

function mapDbUser(row: DbUserRow): AuthUser {
  return {
    id: row.id,
    email: row.email,
    role: row.role,
    isBlocked: row.is_blocked
  };
}

export function publicUser(user: AuthUser) {
  return {
    id: user.id,
    email: user.email,
    role: user.role
  };
}

async function getUserById(userId: string): Promise<AuthUser | null> {
  const result = await query<DbUserRow>(
    `
      SELECT u.id, u.email, u.password_hash, u.is_blocked, r.code AS role
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1
      LIMIT 1
    `,
    [userId]
  );

  if (!result.rowCount) {
    return null;
  }

  return mapDbUser(result.rows[0]);
}

function createAccessToken(user: AuthUser): string {
  return createJwt(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
      type: "access"
    },
    env.jwtAccessSecret,
    env.accessTokenTtl
  );
}

function createRefreshToken(userId: string, sessionId: string): string {
  return createJwt(
    {
      sub: userId,
      sid: sessionId,
      type: "refresh"
    },
    env.jwtRefreshSecret,
    env.refreshTokenTtl
  );
}

async function persistRefreshSession(
  userId: string,
  sessionId: string,
  refreshToken: string,
  userAgent: string | null,
  ipAddress: string | null
) {
  const expiresAt = new Date(Date.now() + ttlToMaxAgeSeconds(env.refreshTokenTtl) * 1000);

  await query(
    `
      INSERT INTO user_sessions (id, user_id, refresh_token_hash, user_agent, ip_address, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
    `,
    [sessionId, userId, hashToken(refreshToken), userAgent, ipAddress, expiresAt]
  );
}

export async function createSessionForUser(user: AuthUser, request: RequestMeta) {
  const sessionId = randomUUID();
  const refreshToken = createRefreshToken(user.id, sessionId);
  const accessToken = createAccessToken(user);

  await persistRefreshSession(
    user.id,
    sessionId,
    refreshToken,
    request.userAgent,
    request.ipAddress
  );

  return { accessToken, refreshToken };
}

export async function registerWithEmail(email: string, password: string, displayName: string | null = null): Promise<AuthUser | null> {
  const normalizedEmail = email.toLowerCase();
  const passwordHash = await hashPassword(password);

  try {
    const inserted = await withTransaction(async (client) => {
      const userResult = await client.query<{ id: string; email: string; is_blocked: boolean }>(
        `
          INSERT INTO users (email, password_hash, role_id, display_name)
          VALUES ($1, $2, (SELECT id FROM roles WHERE code = 'user'), $3)
          RETURNING id, email, is_blocked
        `,
        [normalizedEmail, passwordHash, displayName]
      );

      const user = userResult.rows[0];

      await client.query(
        `
          INSERT INTO user_progress (user_id, xp, streak_days, learned_words)
          VALUES ($1, 0, 0, 0)
          ON CONFLICT (user_id) DO NOTHING
        `,
        [user.id]
      );

      return user;
    });

    return {
      id: inserted.id,
      email: inserted.email,
      role: "user",
      isBlocked: inserted.is_blocked
    };
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && error.code === "23505") {
      return null;
    }

    throw error;
  }
}

export async function loginWithEmail(email: string, password: string): Promise<AuthUser | null> {
  const result = await query<DbUserRow>(
    `
      SELECT u.id, u.email, u.password_hash, u.is_blocked, r.code AS role
      FROM users u
      JOIN roles r ON r.id = u.role_id
      WHERE u.email = $1
      LIMIT 1
    `,
    [email.toLowerCase()]
  );

  const row = result.rows[0];

  if (!row) {
    return null;
  }

  const isValid = await verifyPassword(password, row.password_hash);
  if (!isValid) {
    return null;
  }

  return mapDbUser(row);
}

export async function revokeRefreshSessionFromToken(refreshToken: string) {
  const payload = verifyJwt<RefreshTokenPayload>(refreshToken, env.jwtRefreshSecret);

  if (!payload || payload.type !== "refresh") {
    return;
  }

  await query(
    `
      UPDATE user_sessions
      SET revoked_at = NOW()
      WHERE id = $1
        AND user_id = $2
        AND revoked_at IS NULL
    `,
    [payload.sid, payload.sub]
  );
}

async function findValidRefreshSession(payload: RefreshTokenPayload, refreshToken: string): Promise<boolean> {
  const result = await query(
    `
      SELECT id
      FROM user_sessions
      WHERE id = $1
        AND user_id = $2
        AND refresh_token_hash = $3
        AND revoked_at IS NULL
        AND expires_at > NOW()
      LIMIT 1
    `,
    [payload.sid, payload.sub, hashToken(refreshToken)]
  );

  return Boolean(result.rowCount);
}

export async function getAuthContextFromTokens(
  accessToken: string | undefined,
  refreshToken: string | undefined
): Promise<AuthContext | null> {

  if (accessToken) {
    const accessPayload = verifyJwt<AccessTokenPayload>(accessToken, env.jwtAccessSecret);

    if (accessPayload?.type === "access") {
      const user = await getUserById(accessPayload.sub);

      if (user && !user.isBlocked) {
        return { user };
      }
    }
  }

  if (!refreshToken) {
    return null;
  }

  const refreshPayload = verifyJwt<RefreshTokenPayload>(refreshToken, env.jwtRefreshSecret);

  if (!refreshPayload || refreshPayload.type !== "refresh") {
    return null;
  }

  const hasValidSession = await findValidRefreshSession(refreshPayload, refreshToken);

  if (!hasValidSession) {
    return null;
  }

  const user = await getUserById(refreshPayload.sub);
  if (!user || user.isBlocked) {
    return null;
  }

  return {
    user,
    refreshedAccessToken: createAccessToken(user)
  };
}

export async function getAuthContextFromCookieMap(cookieMap: Map<string, string>): Promise<AuthContext | null> {
  return getAuthContextFromTokens(cookieMap.get(ACCESS_COOKIE_NAME), cookieMap.get(REFRESH_COOKIE_NAME));
}

export async function getAuthContextFromRequest(request: Request): Promise<AuthContext | null> {
  return getAuthContextFromCookieMap(parseCookieHeader(request.headers.get("cookie")));
}

export { ACCESS_COOKIE_NAME, REFRESH_COOKIE_NAME };
