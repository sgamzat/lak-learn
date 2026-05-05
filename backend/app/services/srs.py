import math
from datetime import datetime, timedelta, timezone

from app.models.entities import UserWordProgress


def calculate_next_review(progress: UserWordProgress, quality: int) -> UserWordProgress:
    now = datetime.now(timezone.utc)

    if quality == 0:
        progress.repetitions = 0
        progress.interval = 0
        progress.status = "learning"
        progress.next_review = now + timedelta(minutes=1)
    else:
        if progress.repetitions == 0:
            interval = 1
        elif progress.repetitions == 1:
            interval = 6
        else:
            interval = math.ceil(progress.interval * progress.ease_factor)

        if quality == 1:
            interval = max(1, int(interval * 0.8))
        elif quality == 3:
            interval = max(interval, int(interval * 1.3))

        progress.ease_factor += 0.1 - (3 - quality) * 0.08
        progress.ease_factor = max(1.3, progress.ease_factor)
        progress.repetitions += 1
        progress.interval = min(interval, 365)
        progress.status = "review"
        progress.next_review = now + timedelta(days=progress.interval)

    progress.last_review = now
    return progress

