// src/types/word.ts
// ─────────────────────────────────────────────────────────────────────────────
// Общие типы слова — используются в API, словаре, SRS и компонентах
// ─────────────────────────────────────────────────────────────────────────────

/** Грамматический род существительного */
export type WordGender = "м" | "ж" | "ср";

/** Вид глагола */
export type VerbAspect = "сов." | "несов." | "однокр.";

/** Тип записи: слово из словаря или фраза из разговорника */
export type WordType = "word" | "phrase";

/**
 * Слово как оно приходит из API GET /api/words
 * Используется в словаре, поиске и SRS
 */
export type DictionaryWord = {
  id:                  number;
  lemma:               string;
  translation:         string;
  transcription:       string | null;

  // Грамматика — разделена на отдельные поля
  partOfSpeech:        string | null;   // Сущ. / Глаг. / Прил. / Нареч. / Фраза и т.д.
  gender:              WordGender | null; // м / ж / ср — только для существительных
  verbAspect:          VerbAspect | null; // сов. / несов. / однокр. — только для глаголов
  wordType:            WordType;          // word | phrase

  // Редакторские пометы
  notes:               string | null;   // устар., разг., диалект и т.д.
  imageUrl:            string | null;   // иллюстрация (пока null)

  // Синонимы
  translationPriority: number;          // 1 = основное (в SRS), 2+ = синоним (справка)
  synonymGroupId:      string | null;   // связывает синонимы одного русского слова

  popularityScore:     number | null;   // частотность для сортировки
};

/**
 * Слово для SRS-карточки — расширяет DictionaryWord
 * дополнительными полями нужными для повторения
 */
export type FlashcardWord = DictionaryWord & {
  /** Синонимы этого слова (priority > 1, та же synonymGroupId) */
  synonyms: Pick<DictionaryWord, "id" | "lemma">[];

  /** Примеры употребления */
  examples: WordExample[];
};

/** Пример употребления слова */
export type WordExample = {
  id:                 number;
  sentenceSrc:        string;         // предложение на лакском
  sentenceTranslation: string | null; // перевод на русский
};

/**
 * Коллекция (набор) слов
 */
export type WordCollection = {
  id:          number;
  slug:        string;
  title:       string;
  description: string | null;
  wordCount:   number;
  sortOrder:   number;
  isPublic:    boolean;
};