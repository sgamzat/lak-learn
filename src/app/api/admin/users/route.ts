import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";
import { deriveDisplayName } from "@/lib/server/dashboard";
import { KNOWN_INTERVAL_DAYS } from "@/lib/server/membership";

type UserListRow = {
  id: string;
  email: string;
  display_name: string | null;
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
        u.display_name,
        r.code AS role,
        u.is_blocked,
        u.created_at,
        COALESCE(up.xp, 0)::int AS xp,
        COALESCE(up.streak_days, 0)::int AS streak_days,
        -- user_progress.learned_words никто не обновлял (всегда 0).
        -- Считаем по факту: карточки с интервалом, как у stage = known на дашборде.
        (
          SELECT COUNT(*)::int
          FROM user_srs_cards usc
          WHERE usc.user_id = u.id
            AND usc.interval_days >= ${KNOWN_INTERVAL_DAYS}
        ) AS learned_words
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
        displayName: deriveDisplayName(row.email, row.display_name),
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
    setAccessCookie(response, auth.refreshedAccessToken, request);
  }

  return response;
}

