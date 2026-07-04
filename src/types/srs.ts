// src/types/srs.ts
import type { WordGender, VerbAspect, WordType } from "@/types/word";

export type SRSRating = "forgot" | "unsure" | "know";
export type IntervalState = "overdue" | "dueSoon" | "scheduled";

/**
 * Карточка SRS — одно слово с priority=1.
 * Синонимы (priority>1) хранятся в поле synonyms и показываются
 * на обратной стороне карточки как справочная информация.
 */
export interface FlashcardData {
  id:              string;
  word:            string;            // лакское слово (lemma)
  transcription:   string;
  partOfSpeech:    string;
  translation:     string;            // русский перевод
  exampleSentence: string;

  // Новые грамматические поля
  gender:          WordGender | null; // м / ж / ср — для существительных
  verbAspect:      VerbAspect | null; // сов. / несов. / однокр. — для глаголов
  wordType:        WordType;          // word | phrase
  notes:           string | null;     // устар., разг. и т.д.

  // Синонимы — показываем на карточке, не изучаются отдельно
  synonyms:        { id: number; lemma: string }[];

  // SRS-метаданные
  intervalState:   IntervalState;
  nextReviewDate:  string;            // ISO дата следующего повторения
  repetition:      number;            // кол-во успешных повторений
}

export interface SRSResult {
  cardId:    string;
  rating:    SRSRating;
  timestamp: number;
}

export interface SRSReviewState {
  queue:         FlashcardData[];
  currentIndex:  number;
  isRevealed:    boolean;
  results:       SRSResult[];
  isFinished:    boolean;
  isLoading:     boolean;
  isInputLocked: boolean;
}