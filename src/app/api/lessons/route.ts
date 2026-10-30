import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { setAccessCookie } from "@/lib/server/session";
import { getLessonProgressMap } from "@/lib/server/lessons";
import { LESSONS, lessonMeta } from "@/lib/lessons";

/** Список уроков с прогрессом ученика */
export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) return NextResponse.json({ error: "Не авторизован" }, { status: 401 });

  const progress = await getLessonProgressMap(auth.user.id);
  const response = NextResponse.json({
    lessons: LESSONS.map((l) => ({ ...lessonMeta(l), progress: progress.get(l.number) ?? null }))
  });
  if (auth.refreshedAccessToken) setAccessCookie(response, auth.refreshedAccessToken, request);
  return response;
}
