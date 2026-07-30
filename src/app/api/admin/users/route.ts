import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";
import { deriveDisplayName } from "@/lib/server/dashboard";

type UserListRow = {
  id: string;
  email: string;
  role: "user" | "admin";
  is_blocked: boolean;
  created_at: string;
  xp: number;
  streak_days: number;
  learned_words: number;
};

export async function GET(request: Request) {
  const guard = await requireAdmin(request);

  if (!guard.auth || guard.response) {
    return guard.response;
  }

  const auth = guard.auth;

  const usersResult = await query<UserListRow>(
    `
      SELECT
        u.id,
        u.email,
        r.code AS role,
        u.is_blocked,
        u.created_at,
        COALESCE(up.xp, 0)::int AS xp,
        COALESCE(up.streak_days, 0)::int AS streak_days,
        COALESCE(up.learned_words, 0)::int AS learned_words
      FROM users u
      JOIN roles r ON r.id = u.role_id
      LEFT JOIN user_progress up ON up.user_id = u.id
      ORDER BY u.created_at DESC
    `
  );

  const response = NextResponse.json(
    {
      users: usersResult.rows.map((row) => ({
        id: row.id,
        email: row.email,
        displayName: deriveDisplayName(row.email, null),
        role: row.role,
        isBlocked: row.is_blocked,
        createdAt: row.created_at,
        xp: row.xp,
        streak: row.streak_days,
        learnedWords: row.learned_words
      }))
    },
    { status: 200 }
  );

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}

