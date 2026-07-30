import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type UpdateAdminUserBody = {
  role?: "user" | "admin";
  isBlocked?: boolean;
};

type ExistingUserRow = {
  id: string;
  email: string;
  role: "user" | "admin";
  is_blocked: boolean;
};

export async function PATCH(request: Request, { params }: { params: { userId: string } }) {
  const guard = await requireAdmin(request);

  if (!guard.auth || guard.response) {
    return guard.response;
  }

  const auth = guard.auth;

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

export async function DELETE(request: Request, { params }: { params: { userId: string } }) {
  const guard = await requireAdmin(request);

  if (!guard.auth || guard.response) {
    return guard.response;
  }

  const auth = guard.auth;

  const userId = params.userId;

  if (!userId) {
    return NextResponse.json({ error: "userId обязателен" }, { status: 400 });
  }

  if (auth.user.id === userId) {
    return NextResponse.json({ error: "Нельзя удалить самого себя" }, { status: 400 });
  }

  const deleted = await withTransaction(async (client) => {
    const existingResult = await client.query<ExistingUserRow>(
      `
        SELECT u.id, u.email, r.code AS role, u.is_blocked
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

    await client.query(
      `
        UPDATE words
        SET created_by = NULL
        WHERE created_by = $1
      `,
      [userId]
    );

    await client.query(
      `
        UPDATE words
        SET updated_by = NULL
        WHERE updated_by = $1
      `,
      [userId]
    );

    await client.query(
      `
        UPDATE audit_log
        SET actor_user_id = NULL
        WHERE actor_user_id = $1
      `,
      [userId]
    );

    await client.query(
      `
        DELETE FROM users
        WHERE id = $1
      `,
      [userId]
    );

    await client.query(
      `
        INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        auth.user.id,
        "admin.user.delete",
        "user",
        userId,
        JSON.stringify({ deletedUser: { id: existing.id, email: existing.email, role: existing.role } })
      ]
    );

    return {
      id: existing.id,
      email: existing.email
    };
  });

  if (!deleted) {
    return NextResponse.json({ error: "Пользователь не найден" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, user: deleted }, { status: 200 });

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}
