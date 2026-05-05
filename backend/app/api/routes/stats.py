from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.dependencies import get_current_user
from app.db.session import get_db_session
from app.models.entities import User, UserWordProgress
from app.schemas.stats import StatsResponse


router = APIRouter(prefix="/api", tags=["stats"])


@router.get("/stats", response_model=StatsResponse)
async def get_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db_session),
) -> StatsResponse:
    now = datetime.now(timezone.utc)

    due_today_result = await db.execute(
        select(func.count(UserWordProgress.id)).where(
            and_(
                UserWordProgress.user_id == current_user.id,
                UserWordProgress.next_review.is_not(None),
                UserWordProgress.next_review <= now,
            )
        )
    )
    mastered_result = await db.execute(
        select(func.count(UserWordProgress.id)).where(
            and_(
                UserWordProgress.user_id == current_user.id,
                UserWordProgress.status == "review",
                UserWordProgress.interval >= 30,
            )
        )
    )

    reviewed_result = await db.execute(
        select(func.count(UserWordProgress.id)).where(
            and_(UserWordProgress.user_id == current_user.id, UserWordProgress.last_review.is_not(None))
        )
    )
    correct_result = await db.execute(
        select(func.count(UserWordProgress.id)).where(
            and_(
                UserWordProgress.user_id == current_user.id,
                UserWordProgress.status == "review",
                UserWordProgress.repetitions > 0,
            )
        )
    )

    reviewed = reviewed_result.scalar_one()
    correct = correct_result.scalar_one()
    accuracy = float(correct / reviewed) if reviewed > 0 else 0.0

    return StatsResponse(
        due_today=due_today_result.scalar_one(),
        mastered=mastered_result.scalar_one(),
        streak=0,
        accuracy=round(accuracy, 4),
    )

