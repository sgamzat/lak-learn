import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type AuditRow = {
  id:           string;
  actor_email:  string | null;
  action:       string;
  entity_type:  string;
  entity_id:    string;
  payload:      unknown;
  created_at:   string;
};

type CountRow = {
  total: number;
};

export async function GET(request: Request) {
  const guard = await requireAdmin(request);

  if (!guard.auth || guard.response) {
    return guard.response;
  }

  const auth = guard.auth;

  const url    = new URL(request.url);
  const page   = Math.max(1, Number.parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit  = 50;
  const offset = (page - 1) * limit;

  try {
    const [rowsResult, countResult] = await Promise.all([
      query<AuditRow>(
        `
          SELECT
            al.id::text,
            u.email AS actor_email,
            al.action,
            al.entity_type,
            al.entity_id,
            al.payload,
            al.created_at
          FROM audit_log al
          LEFT JOIN users u ON u.id = al.actor_user_id
          ORDER BY al.created_at DESC
          LIMIT $1 OFFSET $2
        `,
        [limit, offset]
      ),
      query<CountRow>(`SELECT COUNT(*)::int AS total FROM audit_log`),
    ]);

    const total      = countResult.rows[0]?.total ?? 0;
    const totalPages = Math.ceil(total / limit);

    const response = NextResponse.json(
      {
        entries: rowsResult.rows.map((row) => ({
          id:         row.id,
          actorEmail: row.actor_email,
          action:     row.action,
          entityType: row.entity_type,
          entityId:   row.entity_id,
          payload:    row.payload,
          createdAt:  row.created_at,
        })),
        pagination: { page, limit, total, totalPages },
      },
      { status: 200 }
    );

    if (auth.refreshedAccessToken) {
      setAccessCookie(response, auth.refreshedAccessToken);
    }

    return response;
  } catch (err) {
    console.error("[admin/audit] DB error:", err);
    return NextResponse.json({ error: "Ошибка базы данных" }, { status: 500 });
  }
}