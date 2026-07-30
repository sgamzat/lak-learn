import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/server/auth";
import { withTransaction } from "@/lib/server/db";
import { setAccessCookie } from "@/lib/server/session";

type PatchWordBody = {
  lemma?:        string;
  translation?:  string;
  transcription?: string;
  partOfSpeech?: string;
};

type ExistingWordRow = {
  id:            number;
  lemma:         string;
  translation:   string;
  transcription: string | null;
  part_of_speech: string | null;
};

function normalizeOptional(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t.length ? t : null;
}

// ── PATCH /api/admin/words/:wordId ────────────────────────────────────────────
export async function PATCH(
  request: Request,
  { params }: { params: { wordId: string } }
) {
  const guard = await requireAdmin(request);
  if (!guard.auth || guard.response) return guard.response;

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

  const lemma        = normalizeOptional(body.lemma);
  const translation  = normalizeOptional(body.translation);
  const transcription = normalizeOptional(body.transcription);
  const partOfSpeech = normalizeOptional(body.partOfSpeech);

  const updated = await withTransaction(async (client) => {
    const existing = await client.query<ExistingWordRow>(
      `SELECT id, lemma, translation, transcription, part_of_speech
         FROM words WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [wordId]
    );
    if (!existing.rowCount) return null;

    const prev = existing.rows[0];
    const nextLemma        = lemma        ?? prev.lemma;
    const nextTranslation  = translation  ?? prev.translation;
    const nextTranscription = transcription !== undefined ? transcription : prev.transcription;
    const nextPos          = partOfSpeech !== undefined  ? partOfSpeech  : prev.part_of_speech;

    await client.query(
      `UPDATE words
          SET lemma = $1, translation = $2, transcription = $3,
              part_of_speech = $4, updated_by = $5, updated_at = NOW()
        WHERE id = $6`,
      [nextLemma, nextTranslation, nextTranscription, nextPos, guard.auth.user.id, wordId]
    );

    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        guard.auth.user.id,
        "admin.word.update",
        "word",
        String(wordId),
        JSON.stringify({
          previous: { lemma: prev.lemma, translation: prev.translation,
                      transcription: prev.transcription, partOfSpeech: prev.part_of_speech },
          next:     { lemma: nextLemma, translation: nextTranslation,
                      transcription: nextTranscription, partOfSpeech: nextPos },
        }),
      ]
    );

    return { id: wordId, lemma: nextLemma, translation: nextTranslation,
             transcription: nextTranscription, partOfSpeech: nextPos };
  });

  if (!updated) {
    return NextResponse.json({ error: "Слово не найдено" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, word: updated }, { status: 200 });
  if (guard.auth.refreshedAccessToken) setAccessCookie(response, guard.auth.refreshedAccessToken);
  return response;
}

// ── DELETE /api/admin/words/:wordId (soft delete) ─────────────────────────────
export async function DELETE(
  request: Request,
  { params }: { params: { wordId: string } }
) {
  const guard = await requireAdmin(request);
  if (!guard.auth || guard.response) return guard.response;

  const wordId = Number.parseInt(params.wordId, 10);
  if (!Number.isInteger(wordId) || wordId <= 0) {
    return NextResponse.json({ error: "Некорректный wordId" }, { status: 400 });
  }

  const deleted = await withTransaction(async (client) => {
    const existing = await client.query<ExistingWordRow>(
      `SELECT id, lemma, translation FROM words WHERE id = $1 AND is_active = TRUE LIMIT 1`,
      [wordId]
    );
    if (!existing.rowCount) return null;

    const prev = existing.rows[0];

    await client.query(
      `UPDATE words SET is_active = FALSE, updated_by = $1, updated_at = NOW() WHERE id = $2`,
      [guard.auth.user.id, wordId]
    );

    await client.query(
      `INSERT INTO audit_log (actor_user_id, action, entity_type, entity_id, payload)
       VALUES ($1, $2, $3, $4, $5)`,
      [
        guard.auth.user.id,
        "admin.word.delete",
        "word",
        String(wordId),
        JSON.stringify({ lemma: prev.lemma, translation: prev.translation }),
      ]
    );

    return { id: wordId, lemma: prev.lemma };
  });

  if (!deleted) {
    return NextResponse.json({ error: "Слово не найдено" }, { status: 404 });
  }

  const response = NextResponse.json({ ok: true, word: deleted }, { status: 200 });
  if (guard.auth.refreshedAccessToken) setAccessCookie(response, guard.auth.refreshedAccessToken);
  return response;
}