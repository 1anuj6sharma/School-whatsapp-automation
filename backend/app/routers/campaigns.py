from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload, selectinload
from app.database import get_db
from app.models.campaign import MessageCampaign
from app.models.message_log import MessageLog
from app.schemas.campaigns import CampaignCreateRequest, CampaignResponse, CampaignDetailResponse
from app.schemas.message_logs import MessageLogResponse
from app.services.campaign_service import campaign_service

router = APIRouter(prefix="/api/campaigns", tags=["Campaigns"])

@router.get("", response_model=List[CampaignResponse])
async def list_campaigns(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(MessageCampaign)
        .options(
            joinedload(MessageCampaign.school_class),
            joinedload(MessageCampaign.template),
            selectinload(MessageCampaign.message_logs)
        )
        .order_by(MessageCampaign.created_at.desc())
    )
    result = await db.execute(stmt)
    campaigns = result.scalars().all()

    needs_commit = False
    response = []
    for c in campaigns:
        # Reconcile status if no logs are queued anymore
        if c.status == "PROCESSING" and c.message_logs:
            has_queued = any(l.status == "QUEUED" for l in c.message_logs)
            if not has_queued:
                c.status = "COMPLETED"
                c.completed_at = c.completed_at or datetime.utcnow()
                needs_commit = True

        response.append(
            CampaignResponse(
                id=c.id,
                class_id=c.class_id,
                class_name=c.school_class.name if c.school_class else None,
                template_id=c.template_id,
                template_name=c.template.name if c.template else None,
                total_recipients=c.total_recipients,
                successful_count=c.successful_count,
                failed_count=c.failed_count,
                skipped_count=c.skipped_count,
                status=c.status,
                created_at=c.created_at,
                started_at=c.started_at,
                completed_at=c.completed_at
            )
        )

    if needs_commit:
        await db.commit()

    return response

@router.post("", response_model=CampaignResponse, status_code=status.HTTP_201_CREATED)
async def create_campaign(payload: CampaignCreateRequest, db: AsyncSession = Depends(get_db)):
    try:
        campaign = await campaign_service.create_and_start_campaign(
            db=db,
            class_id=payload.class_id,
            template_id=payload.template_id,
            student_ids=payload.student_ids,
            dynamic_parameters=payload.dynamic_parameters,
            per_student_parameters=payload.per_student_parameters
        )

        # Reload with relationships
        stmt = (
            select(MessageCampaign)
            .options(
                joinedload(MessageCampaign.school_class),
                joinedload(MessageCampaign.template)
            )
            .where(MessageCampaign.id == campaign.id)
        )
        result = await db.execute(stmt)
        refreshed = result.scalar_one()

        return CampaignResponse(
            id=refreshed.id,
            class_id=refreshed.class_id,
            class_name=refreshed.school_class.name if refreshed.school_class else None,
            template_id=refreshed.template_id,
            template_name=refreshed.template.name if refreshed.template else None,
            total_recipients=refreshed.total_recipients,
            successful_count=refreshed.successful_count,
            failed_count=refreshed.failed_count,
            skipped_count=refreshed.skipped_count,
            status=refreshed.status,
            created_at=refreshed.created_at,
            started_at=refreshed.started_at,
            completed_at=refreshed.completed_at
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as ex:
        raise HTTPException(status_code=500, detail=f"Failed to create campaign: {str(ex)}")

@router.get("/{campaign_id}", response_model=CampaignDetailResponse)
async def get_campaign(campaign_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(MessageCampaign)
        .options(
            joinedload(MessageCampaign.school_class),
            joinedload(MessageCampaign.template),
            selectinload(MessageCampaign.message_logs).joinedload(MessageLog.student)
        )
        .where(MessageCampaign.id == campaign_id)
    )
    result = await db.execute(stmt)
    campaign = result.scalar_one_or_none()
    if not campaign:
        raise HTTPException(status_code=404, detail="Campaign not found")

    # If all logs are processed or none are queued, ensure campaign is marked COMPLETED
    if campaign.status == "PROCESSING" and campaign.message_logs:
        has_queued = any(l.status == "QUEUED" for l in campaign.message_logs)
        if not has_queued:
            campaign.status = "COMPLETED"
            campaign.completed_at = campaign.completed_at or datetime.utcnow()
            await db.commit()

    logs_response = [MessageLogResponse.from_model(log) for log in campaign.message_logs]

    return CampaignDetailResponse(
        id=campaign.id,
        class_id=campaign.class_id,
        class_name=campaign.school_class.name if campaign.school_class else None,
        template_id=campaign.template_id,
        template_name=campaign.template.name if campaign.template else None,
        total_recipients=campaign.total_recipients,
        successful_count=campaign.successful_count,
        failed_count=campaign.failed_count,
        skipped_count=campaign.skipped_count,
        status=campaign.status,
        created_at=campaign.created_at,
        started_at=campaign.started_at,
        completed_at=campaign.completed_at,
        message_logs=logs_response
    )
