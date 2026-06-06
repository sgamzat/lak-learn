import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type PatchBody = {
  displayName?: string;
};

export async function PATCH(request: Request) {
  const auth = await getAuthContextFromRequest(request);

  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  let body: PatchBody;
  try {
    body = (await request.json()) as PatchBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const displayName = body.displayName?.trim() ?? null;

  if (displayName !== null && displayName.length > 64) {
    return NextResponse.json({ error: "Имя не должно превышать 64 символа" }, { status: 400 });
  }

  await query(
    `UPDATE users SET display_name = $1, updated_at = NOW() WHERE id = $2`,
    [displayName || null, auth.user.id]
  );

  const response = NextResponse.json({ ok: true }, { status: 200 });

  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }

  return response;
}