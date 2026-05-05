from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field


class ImportMeta(BaseModel):
    model_config = ConfigDict(strict=True)

    exported_at: datetime
    version: str


class ImportWord(BaseModel):
    model_config = ConfigDict(strict=True)

    source_key: str | None = None
    lemma: str = Field(min_length=1, max_length=100)
    translation: str = Field(min_length=1, max_length=255)
    pos: str | None = Field(default=None, max_length=20)
    difficulty_level: str = Field(default="A1", max_length=5)
    frequency: float = Field(default=1.0, ge=0)
    example_sentence: str | None = None
    categories: list[str] = Field(default_factory=list)
    tags: list[str] = Field(default_factory=list)


class ImportPayload(BaseModel):
    model_config = ConfigDict(strict=True)

    meta: ImportMeta
    words: list[ImportWord]


class ImportErrorItem(BaseModel):
    model_config = ConfigDict(strict=True)

    word: str
    reason: str


class DryRunResponse(BaseModel):
    model_config = ConfigDict(strict=True)

    added: int
    updated: int
    skipped: int
    errors: list[ImportErrorItem]


class ExecuteResponse(BaseModel):
    model_config = ConfigDict(strict=True)

    job_id: UUID
    status: str


class JobStatusResponse(BaseModel):
    model_config = ConfigDict(strict=True)

    job_id: UUID
    status: str
    diff_summary: dict | None

