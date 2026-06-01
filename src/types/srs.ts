export type SRSRating = "forgot" | "unsure" | "know";
export type IntervalState = "overdue" | "dueSoon" | "scheduled";

export interface FlashcardData {
  id: string;
  word: string;
  transcription: string;
  partOfSpeech: string;
  translation: string;
  exampleSentence: string;
  intervalState: IntervalState;
  nextReviewDate: string;
  repetition: number;
}

export interface SRSResult {
  cardId: string;
  rating: SRSRating;
  timestamp: number;
}

export interface SRSReviewState {
  queue: FlashcardData[];
  currentIndex: number;
  isRevealed: boolean;
  results: SRSResult[];
  isFinished: boolean;
  isLoading: boolean;
  isInputLocked: boolean;
}