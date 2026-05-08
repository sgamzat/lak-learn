import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type UpdateAdminUserBody = {
  role?: "user" | "admin";
  isBlocked?: boolean;
};

type ExistingUserRow = {
  id: string;
  role: "user" | "admin";
  is_blocked: boolean;
};

export async function PATCH(request: Request, { params }: { params: { userId: string } }) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  if (auth.user.role !== "admin") {
    return NextResponse.json({ error: "Недостаточно прав" }, { status: 403 });
  }

  const userId = params.userId;

  if (!userId) {
    return NextResponse.json({ error: "userId обязателен" }, { status: 400 });
  }

  let body: UpdateAdminUserBody;

  try {
    body = (await request.json()) as UpdateAdminUserBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const nextRole = body.role;
  const nextBlocked = body.isBlocked;

  if (nextRole === undefined && nextBlocked === undefined) {
    return NextResponse.json({ error: "Нужно передать role и/или isBlocked" }, { status: 400 });
  }

  if (nextRole !== undefined && nextRole !== "user" && nextRole !== "admin") {
    return NextResponse.json({ error: "Некорректное значение role" }, { status: 400 });
  }

  if (nextBlocked !== undefined && typeof nextBlocked !== "boolean") {
    return NextResponse.json({ error: "isBlocked должен быть boolean" }, { status: 400 });
  }

  if (auth.user.id === userId && nextBlocked === true) {
    return NextResponse.json({ error: "Нельзя заблокировать самого себя" }, { status: 400 });
  }

  const updatedUser = await withTransaction(async (client) => {
    const existingResult = await client.query<ExistingUserRow>(
      `
        SELECT u.id, r.code AS role, u.is_blocked
        FROM users u
        JOIN roles r ON r.id = u.role_id
        WHERE u.id = $1
        LIMIT 1
      `,
      [userId]
    );

    if (!existingResult.rowCount) {
      return null;
    }

    const existing = existingResult.rows[0];
    const roleToSet = nextRole ?? existing.role;
    const blockedToSet = nextBlocked ?? existing.is_blocked;

    await client.query(
      `
        UPDATE users
        SET
          role_id = (SELECT id FROM roles WHERE code = $2),
          is_blocked = $3,
          updated_at = NOW()
        WHERE id = $1
      `,
      [userId, roleToSet, blockedToSet]
    );

    await client.query(
      `
        INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        auth.user.id,
        "admin.user.update",
        "user",
        userId,
        JSON.stringify({
          previous: { role: existing.role, isBlocked: existing.is_blocked },
          next: { role: roleToSet, isBlocked: blockedToSet }
        })
      ]
    );

    return {
      id: userId,
      role: roleToSet,
      isBlocked: blockedToSet
    };
  });

  if (!updatedUser) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, user: updatedUser }, { status: 200 });

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}

