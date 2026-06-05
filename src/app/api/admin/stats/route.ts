import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type StatsRow = {
  total_words: number;
  total_collections: number;
  total_users: number;
  audit_today: number;
};

export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const result = await query<StatsRow>(`
    SELECT
      (SELECT COUNT(*)::int FROM words      WHERE is_active = TRUE)                           AS total_words,
      (SELECT COUNT(*)::int FROM collections WHERE is_active = TRUE)                          AS total_collections,
      (SELECT COUNT(*)::int FROM users)                                                        AS total_users,
      (SELECT COUNT(*)::int FROM audit_log  WHERE created_at >= NOW()::date)                  AS audit_today
  `);

  const row = result.rows[0];

  const response = NextResponse.json(
    {
      totalWords:       row.total_words,
      totalCollections: row.total_collections,
      totalUsers:       row.total_users,
      auditToday:       row.audit_today,
    },
    { status: 200 }
  );

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}