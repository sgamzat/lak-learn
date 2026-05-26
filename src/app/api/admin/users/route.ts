import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

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

function deriveDisplayName(email: string): string {
  const [localPart] = email.split("@");
  const normalized = localPart?.trim();
  return normalized && normalized.length > 0 ? normalized : email;
}

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

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
        displayName: deriveDisplayName(row.email),
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

