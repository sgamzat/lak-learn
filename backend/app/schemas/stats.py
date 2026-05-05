from pydantic import BaseModel, ConfigDict


class StatsResponse(BaseModel):
    model_config = ConfigDict(strict=True)

    due_today: int
    mastered: int
    streak: int
    accuracy: float

