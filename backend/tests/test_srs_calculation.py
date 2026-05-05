from app.models.entities import UserWordProgress
from app.services.srs import calculate_next_review


def _progress() -> UserWordProgress:
    return UserWordProgress(
        user_id="00000000-0000-0000-0000-000000000001",
        word_id="00000000-0000-0000-0000-000000000002",
        ease_factor=2.5,
        interval=0,
        repetitions=0,
        status="new",
    )


def test_quality_zero_resets_learning_state() -> None:
    progress = _progress()
    updated = calculate_next_review(progress, 0)
    assert updated.repetitions == 0
    assert updated.interval == 0
    assert updated.status == "learning"
    assert updated.next_review is not None
    assert updated.last_review is not None


def test_quality_two_moves_to_review() -> None:
    progress = _progress()
    updated = calculate_next_review(progress, 2)
    assert updated.repetitions == 1
    assert updated.interval == 1
    assert updated.status == "review"
    assert updated.ease_factor >= 1.3


def test_interval_is_capped_by_one_year() -> None:
    progress = _progress()
    progress.repetitions = 5
    progress.interval = 500
    progress.ease_factor = 3.0

    updated = calculate_next_review(progress, 3)
    assert updated.interval <= 365

