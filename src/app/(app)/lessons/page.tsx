import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, ChevronRight } from "lucide-react";
import { getPageAuthContext } from "@/lib/server/page-auth";
import { getLessonProgressMap } from "@/lib/server/lessons";
import { LESSONS, LESSON_SOURCE } from "@/lib/lessons";

export default async function LessonsPage() {
  const auth = await getPageAuthContext();
  if (!auth) redirect("/login");

  const progress = await getLessonProgressMap(auth.user.id);
  // Рекомендуемый урок — первый непройденный. Остальные тоже открыты:
  // многие ученики что-то уже знают и хотят начать с середины.
  const current = LESSONS.find((l) => !progress.get(l.number)?.completedAt) ?? null;
  const doneCount = LESSONS.filter((l) => progress.get(l.number)?.completedAt).length;

  return (
    <main className="mx-auto w-full max-w-2xl px-4 pb-10 pt-6">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-lk-gold">Курс</p>
      <h1 className="mt-1 font-serif text-3xl font-bold text-lk-text">Уроки</h1>
      <p className="mt-2 text-sm leading-relaxed text-lk-muted">
        По учебнику {LESSON_SOURCE.title} ({LESSON_SOURCE.author}). Пройдено {doneCount} из {LESSONS.length}.
      </p>

      <h2 className="mb-3 mt-8 text-xs font-semibold uppercase tracking-wider text-lk-muted">Часть 1 · Первые шаги</h2>
      <ol className="space-y-3">
        {LESSONS.map((lesson) => {
          const p = progress.get(lesson.number);
          const done = Boolean(p?.completedAt);
          const inProgress = !done && (p?.step ?? 0) > 0;
          const isCurrent = current?.number === lesson.number;
          const status = done ? "Пройден" : inProgress ? `Продолжить · шаг ${(p?.step ?? 0) + 1} из ${lesson.steps.length}` : "Начать";

          return (
            <li key={lesson.number}>
              <Link
                href={`/lessons/${lesson.number}`}
                className={[
                  "flex items-start gap-4 rounded-2xl border p-4 no-underline transition active:scale-[0.99]",
                  isCurrent ? "border-lk-gold-border bg-lk-gold-dim" : "border-lk-line bg-lk-card"
                ].join(" ")}
              >
                <span
                  className={[
                    "flex h-11 w-11 shrink-0 items-center justify-center rounded-full font-serif text-lg font-bold",
                    done ? "bg-lk-green-dim text-lk-green" : isCurrent ? "bg-lk-gold text-lk-bg" : "bg-lk-card2 text-lk-muted"
                  ].join(" ")}
                  aria-hidden
                >
                  {done ? <Check size={20} /> : lesson.number}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-serif text-lg font-semibold leading-snug text-lk-text">{lesson.title}</span>
                  <span lang="lbe" className="block font-serif text-sm text-lk-muted">{lesson.titleLak}</span>
                  <span className="mt-1.5 line-clamp-2 block text-sm leading-snug text-lk-muted">{lesson.goal}</span>
                  <span className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-lk-muted">
                    <span className={isCurrent || inProgress ? "font-semibold text-lk-gold" : done ? "text-lk-green" : ""}>{status}</span>
                    <span>{lesson.words.length} слов</span>
                    {lesson.sounds.length ? <span lang="lbe">звуки: {lesson.sounds.join(", ")}</span> : null}
                  </span>
                </span>
                <ChevronRight size={18} className="mt-3 shrink-0 text-lk-muted" aria-hidden />
              </Link>
            </li>
          );
        })}
      </ol>

      <p className="mt-8 text-xs leading-relaxed text-lk-muted">
        Аудио к урокам появится позже. Пока произносите звуки и фразы вслух — так они запоминаются лучше.
      </p>
    </main>
  );
}
