import { NextResponse } from "next/server";
import { getAuthContextFromRequest } from "@/lib/server/auth";
import { query } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";
import { LAK_ALPHABET, displayLetter } from "@/lib/lak/alphabet";

export type LetterCount = {
  /** Буква в форме ключа (строчная, палочка ӏ) — передаётся в /api/words?lakLetter= */
  letter: string;
  /** Для показа: «КӀ», «Хьхь» */
  display: string;
  /** Основных слов (без синонимов и фраз) на эту букву */
  count: number;
};

// GET /api/letters — сколько слов начинается с каждой буквы лакского алфавита.
// first_letter считается в БД (миграция 011), диграфы — отдельные буквы.
export async function GET(request: Request) {
  const auth = await getAuthContextFromRequest(request);
  if (!auth) {
    return NextResponse.json({ error: "Не авторизован" }, { status: 401 });
  }

  const result = await query<{ first_letter: string; count: number }>(
    `
      SELECT first_letter, COUNT(*)::int AS count
      FROM words
      WHERE is_active = TRUE
        AND word_type = 'word'
        AND translation_priority = 1
        AND first_letter IS NOT NULL
      GROUP BY first_letter
    `
  );

  const counts = new Map(result.rows.map((row) => [row.first_letter, row.count]));
  const letters: LetterCount[] = LAK_ALPHABET.map((letter) => ({
    letter,
    display: displayLetter(letter),
    count: counts.get(letter) ?? 0
  }));

  const response = NextResponse.json({ letters }, { status: 200 });
  if (auth.refreshedAccessToken) {
    setAccessCookie(response, auth.refreshedAccessToken);
  }
  return response;
}
