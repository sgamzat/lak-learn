import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type PatchWordBody = {
  lemma?: string;
  translation?: string;
  transcription?: string | null;
  partOfSpeech?: string | null;
  gender?: string | null;
  verbAspect?: string | null;
  wordType?: string;
  notes?: string | null;
  translationPriority?: number;
  synonymGroupId?: string | null;
};

type ExistingWordRow = {
  id: number;
  lemma: string;
  translation: string;
  transcription: string | null;
  part_of_speech: string | null;
  gender: string | null;
  verb_aspect: string | null;
  word_type: string;
  notes: string | null;
  translation_priority: number;
  synonym_group_id: string | null;
};

function normalizeOptional(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const t = value.trim();
  return t.length ? t : null;
}

function normalizeOptionalField(value: unknown, previous: string | null): string | null {
  if (value === undefined) {
    return previous;
  }
  if (value === null) {
    return null;
  }
  return normalizeOptional(value);
}

function normalizeGender(value: unknown, previous: string | null): string | null {
  if (value === undefined) {
    return previous;
  }
  if (value === null || value === "") {
    return null;
  }
  if (value === "м" || value === "ж" || value === "ср") {
    return value;
  }
  throw new Error("gender: м, ж или ср");
}

function normalizeVerbAspect(value: unknown, previous: string | null): string | null {
  if (value === undefined) {
    return previous;
  }
  if (value === null || value === "") {
    return null;
  }
  if (value === "сов." || value === "несов." || value === "однокр.") {
    return value;
  }
  throw new Error("verbAspect: сов., несов. или однокр.");
}

function normalizeWordType(value: unknown, previous: string): string {
  if (value === undefined) {
    return previous;
  }
  return value === "phrase" ? "phrase" : "word";
}

function normalizePriority(value: unknown, previous: number): number {
  if (value === undefined) {
    return previous;
  }
  if (typeof value === "number" && Number.isInteger(value) && value >= 1) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const n = Number.parseInt(value, 10);
    if (Number.isInteger(n) && n >= 1) {
      return n;
    }
  }
  throw new Error("translationPriority должен быть целым числом ≥ 1");
}

function mapWord(row: ExistingWordRow) {
  return {
    id: row.id,
    lemma: row.lemma,
    translation: row.translation,
    transcription: row.transcription,
    partOfSpeech: row.part_of_speech,
    gender: row.gender,
    verbAspect: row.verb_aspect,
    wordType: row.word_type,
    notes: row.notes,
    translationPriority: row.translation_priority,
    synonymGroupId: row.synonym_group_id
  };
}

// ── PATCH /api/admin/words/:wordId ────────────────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: { wordId: string } }
) {
  const guard = await requireAdmin(request);
  if (!guard.auth || guard.response) {
    return guard.response;
  }

  const wordId = Number.parseInt(params.wordId, 10);
  if (!Number.isInteger(wordId) || wordId <= 0) {
    return NextResponse.json({ error: "Некорректный wordId" }, { status: 400 });
  }

  let body: PatchWordBody;
  try {
    body = (await request.json()) as PatchWordBody;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON" }, { status: 400 });
  }

  try {
    const updated = await withTransaction(async (client) => {
      const existing = await client.query<ExistingWordRow>(
        `
          SELECT
            id, lemma, translation, transcription, part_of_speech,
            gender, verb_aspect, word_type, notes,
            translation_priority, synonym_group_id
          FROM words
          WHERE id = $1 AND is_active = TRUE
          LIMIT 1
        `,
        [wordId]
      );
      if (!existing.rowCount) {
        return null;
      }

      const prev = existing.rows[0];
      const nextLemma = normalizeOptional(body.lemma) ?? prev.lemma;
      const nextTranslation = normalizeOptional(body.translation) ?? prev.translation;
      const nextTranscription = normalizeOptionalField(body.transcription, prev.transcription);
      const nextPos = normalizeOptionalField(body.partOfSpeech, prev.part_of_speech);
      const nextGender = normalizeGender(body.gender, prev.gender);
      const nextAspect = normalizeVerbAspect(body.verbAspect, prev.verb_aspect);
      const nextWordType = normalizeWordType(body.wordType, prev.word_type);
      const nextNotes = normalizeOptionalField(body.notes, prev.notes);
      const nextPriority = normalizePriority(body.translationPriority, prev.translation_priority);
      const nextGroup = normalizeOptionalField(body.synonymGroupId, prev.synonym_group_id);

      const result = await client.query<ExistingWordRow>(
        `
          UPDATE words SET
            lemma = $1,
            translation = $2,
            transcription = $3,
            part_of_speech = $4,
            gender = $5,
            verb_aspect = $6,
            word_type = $7,
            notes = $8,
            translation_priority = $9,
            synonym_group_id = $10,
            updated_by = $11,
            updated_at = NOW()
          WHERE id = $12
          RETURNING
            id, lemma, translation, transcription, part_of_speech,
            gender, verb_aspect, word_type, notes,
            translation_priority, synonym_group_id
        `,
        [
          nextLemma,
          nextTranslation,
          nextTranscription,
          nextPos,
          nextGender,
          nextAspect,
          nextWordType,
          nextNotes,
          nextPriority,
          nextGroup,
          guard.auth.user.id,
          wordId
        ]
      );

      await client.query(
        `
          INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
          VALUES ($1, $2, $3, $4, $5)
        `,
        [
          guard.auth.user.id,
          "admin.word.update",
          "word",
          String(wordId),
          JSON.stringify({ previous: mapWord(prev), next: mapWord(result.rows[0]) })
        ]
      );

      return mapWord(result.rows[0]);
    });

    if (!updated) {
      return NextResponse.json({ error: "Слово не найдено" }, { status: 404 });
    }

    const response = NextResponse.json({ ok: true, word: updated }, { status: 200 });
    if (guard.auth.refreshedAccessToken) {
      setAccessCookie(response, guard.auth.refreshedAccessToken);
    }
    return response;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ошибка сохранения";
    if (message.startsWith("gender:") || message.startsWith("verbAspect:") || message.startsWith("translationPriority")) {
      return NextResponse.json({ error: message }, { status: 400 });
    }
    if (message.includes("words_lemma_translation_unique")) {
      return NextResponse.json({ error: "Такая пара «слово + перевод» уже есть" }, { status: 409 });
    }
    throw err;
  }
}

// ── DELETE /api/admin/words/:wordId (soft delete) ─────────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: { wordId: string } }
) {
  const guard = await requireAdmin(request);
  if (!guard.auth || guard.response) {
    return guard.response;
  }

  const wordId = Number.parseInt(params.wordId, 10);
  if (!Number.isInteger(wordId) || wordId <= 0) {
    return NextResponse.json({ error: "Некорректный wordId" }, { status: 400 });
  }

  const deleted = await withTransaction(async (client) => {
    const existing = await client.query<{ id: number; lemma: string; translation: string }>(
      `SELECT id, lemma, translation FROM words WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [wordId]
    );
    if (!existing.rowCount) {
      return null;
    }

    const prev = existing.rows[0];

    await client.query(
      `UPDATE words SET is_active = FALSE, updated_by = $1, updated_at = NOW() WHERE id = $2`,
      [guard.auth.user.id, wordId]
    );

    await client.query(
      `
        INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
        VALUES ($1, $2, $3, $4, $5)
      `,
      [
        guard.auth.user.id,
        "admin.word.delete",
        "word",
        String(wordId),
        JSON.stringify({ lemma: prev.lemma, translation: prev.translation })
      ]
    );

    return { id: wordId, lemma: prev.lemma };
  });

  if (!deleted) {
    return NextResponse.json({ error: "Слово не найдено" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, word: deleted }, { status: 200 });
  if (guard.auth.refreshedAccessToken) {
    setAccessCookie(response, guard.auth.refreshedAccessToken);
  }
  return response;
}
