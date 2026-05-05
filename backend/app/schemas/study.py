from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class QueueItem(BaseModel):
    model_config = ConfigDict(strict=True)

    word_id: UUID
    lemma: str
    translation: str
    example_sentence: str | None = None
    progress_id: UUID


class ReviewRequest(BaseModel):
    model_config = ConfigDict(strict=True)

    progress_id: UUID
    quality: int = Field(ge=0, le=3)


class ReviewStats(BaseModel):
    model_config = ConfigDict(strict=True)

    new: int
    learning: int
    review: int


class ReviewResponse(BaseModel):
    model_config = ConfigDict(strict=True)

    next_word: QueueItem | None = None
    remaining: int
    stats: ReviewStats


class ProgressState(BaseModel):
    model_config = ConfigDict(strict=True)

    progress_id: UUID
    status: str
    ease_factor: float
    interval: int
    repetitions: int
    last_review: datetime | None
    next_review: datetime | None

