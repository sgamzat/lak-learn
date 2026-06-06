import { NextResponse } from "next/server";
import { createSessionForUser, extractRequestMeta, publicUser, registerWithEmail } from "@/lib/server/auth";
import { setAuthCookies } from "@/lib/server/session";

type RegisterBody = {
  email?: string;
  password?: string;
  displayName?: string;
};

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export async function POST(request: Request) {
  let body: RegisterBody;

  try {
    body = (await request.json()) as RegisterBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  const email = body.email?.trim().toLowerCase();
  const password = body.password?.trim();
  const displayName = body.displayName?.trim() || null;

  if (!email || !password) {
    return NextResponse.json({ error: "email и password обязательны" }, { status: 400 });
  }

  if (!isValidEmail(email)) {
    return NextResponse.json({ error: "Некорректный email" }, { status: 400 });
  }

  if (password.length < 8) {
    return NextResponse.json({ error: "Пароль должен быть не короче 8 символов" }, { status: 400 });
  }

  // displayName не длиннее 64 символов
  if (displayName && displayName.length > 64) {
    return NextResponse.json({ error: "Имя не должно превышать 64 символа" }, { status: 400 });
  }

  const user = await registerWithEmail(email, password, displayName);

  if (!user) {
    return NextResponse.json({ error: "Пользователь с таким email уже существует" }, { status: 409 });
  }

  const { accessToken, refreshToken } = await createSessionForUser(user, extractRequestMeta(request.headers));
  const response = NextResponse.json({ user: publicUser(user) }, { status: 201 });
  setAuthCookies(response, accessToken, refreshToken);

  return response;
}