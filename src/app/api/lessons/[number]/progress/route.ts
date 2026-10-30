import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { setAccessCookie } from "@/lib/server/session";
import { completeLesson, saveLessonStep } from "@/lib/server/lessons";
import { getLesson } from "@/lib/lessons";

type Body = { step?: unknown; completed?: unknown; score?: unknown };

/**
 * POST { step } — запомнить шаг;
 * POST { completed: true, score } — урок пройден, слова уходят в повторение.
 */
export async function POST(request: Request, context: { params: Promise<{ number: string }> }) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const { number } = await context.params;
  const lesson = getLesson(Number.parseInt(number, 10));
  if (!lesson) return NextResponse.json({ error: "Урок не найден" }, { status: 404 });

  const body = (await request.json().catch(() => ({}))) as Body;
  let payload: Record<string, unknown>;

  if (body.completed === true) {
    const score =
      typeof body.score === "number" && Number.isFinite(body.score)
        ? Math.max(0, Math.min(100, Math.round(body.score)))
        : null;
    payload = await completeLesson(auth.user.id, lesson.number, score);
  } else {
    const step = typeof body.step === "number" ? Math.trunc(body.step) : Number.NaN;
    if (!Number.isInteger(step) || step < 0 || step >= lesson.steps.length) {
      return NextResponse.json({ error: "Некорректный шаг" }, { status: 400 });
    }
    await saveLessonStep(auth.user.id, lesson.number, step);
    payload = { step };
  }

  const response = NextResponse.json({ ok: true, ...payload });
  if (auth.refreshedAccessToken) setAccessCookie(response, auth.refreshedAccessToken);
  return response;
}
