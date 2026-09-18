from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.database import get_db
from app.models.message_log import MessageLog
from app.schemas.message_logs import MessageLogResponse

router = APIRouter(prefix="/api/message-logs", tags=["Message Logs"])

@router.get("", response_model=List[MessageLogResponse])
async def list_message_logs(
    campaign_id: Optional[int] = Query(None, description="Filter by campaign ID"),
    student_id: Optional[int] = Query(None, description="Filter by student ID"),
    status: Optional[str] = Query(None, description="Filter by status (SENT, DELIVERED, READ, FAILED, SKIPPED)"),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db)
):
    stmt = (
        select(MessageLog)
        .options(joinedload(MessageLog.student))
        .order_by(MessageLog.created_at.desc())
        .limit(limit)
        .offset(offset)
    )

    if campaign_id is not None:
        stmt = stmt.where(MessageLog.campaign_id == campaign_id)
    if student_id is not None:
        stmt = stmt.where(MessageLog.student_id == student_id)
    if status is not None:
        stmt = stmt.where(MessageLog.status == status.upper())

    result = await db.execute(stmt)
    logs = result.scalars().all()

    return [MessageLogResponse.from_model(log) for log in logs]

@router.get("/{log_id}", response_model=MessageLogResponse)
async def get_message_log(log_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(MessageLog)
        .options(joinedload(MessageLog.student))
        .where(MessageLog.id == log_id)
    )
    result = await db.execute(stmt)
    log = result.scalar_one_or_none()
    if not log:
        raise HTTPException(status_code=404, detail="Message log not found")

    return MessageLogResponse.from_model(log)
