import { NextResponse } from "next/server";
import { createSessionForUser, extractRequestMeta, loginWithEmail, publicUser } from "@/lib/server/auth";
import { setAuthCookies } from "@/lib/server/session";

type LoginBody = {
  email?: string;
  password?: string;
};

export async function POST(request: Request) {
  let body: LoginBody;

  try {
    body = (await request.json()) as LoginBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();

  if (!email || !password) {
    return NextResponse.json({ error: "email и password обязательны" }, { status: 400 });
  }

  const user = await loginWithEmail(email, password);

  if (!user) {
    return NextResponse.json({ error: "Неверный email или пароль" }, { status: 401 });
  }

  if (user.isBlocked) {
    return NextResponse.json({ error: "Пользователь заблокирован" }, { status: 403 });
  }

  const { accessToken, refreshToken } = await createSessionForUser(user, extractRequestMeta(request.headers));
  const response = NextResponse.json({ user: publicUser(user) }, { status: 200 });
  setAuthCookies(response, accessToken, refreshToken);

  return response;
}

