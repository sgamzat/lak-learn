import { notFound, redirect } from "next/navigation";
import { getPageAuthContext } from "@/lib/server/page-auth";
import { getLessonProgress } from "@/lib/server/lessons";
import { LESSONS, getLesson } from "@/lib/lessons";
import { LessonPlayer } from "@/components/lessons/LessonPlayer";

export default async function LessonPage({ params }: { params: Promise<{ number: string }> }) {
  const auth = await getPageAuthContext();
  if (!auth) redirect("/login");

  const { number } = await params;
  const lesson = getLesson(Number.parseInt(number, 10));
  if (!lesson) notFound();

  const progress = await getLessonProgress(auth.user.id, lesson.number);
  const next = LESSONS.find((l) => l.number > lesson.number) ?? null;

  return (
    <LessonPlayer
      lesson={lesson}
      initialStep={progress?.step ?? 0}
      nextLesson={next ? { number: next.number, title: next.title } : null}
    />
  );
}
