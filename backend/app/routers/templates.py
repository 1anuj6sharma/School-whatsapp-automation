from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.template import MessageTemplate
from app.schemas.templates import TemplateCreateMetaRequest, TemplateResponse
from app.services.whatsapp_service import whatsapp_service
from app.utils.logger import logger

router = APIRouter(prefix="/api/templates", tags=["Templates"])

@router.get("", response_model=List[TemplateResponse])
async def list_templates(db: AsyncSession = Depends(get_db)):
    stmt = select(MessageTemplate).order_by(MessageTemplate.name)
    result = await db.execute(stmt)
    templates = result.scalars().all()

    # Automatically trigger initial sync from Meta to pull all live templates
    if not templates or len(templates) <= 2:
        try:
            await sync_templates_from_meta(db=db)
            stmt = select(MessageTemplate).order_by(MessageTemplate.name)
            result = await db.execute(stmt)
            templates = result.scalars().all()
        except Exception as ex:
            logger.warning(f"[Templates] Auto-sync from Meta skipped: {ex}")

    return templates

@router.post("/sync", response_model=List[TemplateResponse])
async def sync_templates_from_meta(db: AsyncSession = Depends(get_db)):
    """
    Directly fetches all live message templates from Meta WhatsApp Business Manager (WABA)
    and syncs their latest statuses (ACTIVE, PENDING, REJECTED) into the database.
    """
    try:
        meta_templates = await whatsapp_service.fetch_templates_from_meta()
    except Exception as ex:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch templates from Meta WhatsApp API: {str(ex)}"
        )

    for item in meta_templates:
        name = item["name"]
        stmt = select(MessageTemplate).where(MessageTemplate.name == name)
        existing = (await db.execute(stmt)).scalar_one_or_none()

        if existing:
            existing.category = item["category"]
            existing.language = item["language"]
            existing.status = item["status"]
            existing.body_preview = item["body_preview"]
            existing.description = item.get("description", existing.description)
        else:
            new_tpl = MessageTemplate(
                name=name,
                category=item["category"],
                language=item["language"],
                status=item["status"],
                body_preview=item["body_preview"],
                description=item.get("description", f"Meta {item['category']} Template")
            )
            db.add(new_tpl)

    await db.commit()

    # Return updated list
    stmt = select(MessageTemplate).order_by(MessageTemplate.name)
    result = await db.execute(stmt)
    return result.scalars().all()

@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template_direct(payload: TemplateCreateMetaRequest, db: AsyncSession = Depends(get_db)):
    """
    Submits a new WhatsApp message template directly to Meta for review.
    Immediately creates a local PENDING record and transitions to ACTIVE when Meta approves it.
    """
    # 1. Check if name already exists in local DB
    stmt = select(MessageTemplate).where(MessageTemplate.name == payload.name.lower().strip())
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"Template '{payload.name}' already exists.")

    # 2. Submit to Meta API
    try:
        meta_result = await whatsapp_service.create_template_on_meta(
            name=payload.name,
            category=payload.category,
            language=payload.language,
            body_text=payload.body_text,
            sample_values=payload.sample_values
        )
    except ValueError as val_err:
        raise HTTPException(status_code=400, detail=str(val_err))
    except Exception as ex:
        raise HTTPException(status_code=502, detail=f"Failed to submit template to Meta: {str(ex)}")

    # 3. Store locally with status from Meta (usually PENDING in review)
    tpl_status = meta_result.get("status", "PENDING").upper()
    if tpl_status == "APPROVED":
        tpl_status = "ACTIVE"

    template = MessageTemplate(
        name=meta_result["name"],
        category=meta_result["category"],
        language=meta_result["language"],
        body_preview=meta_result["body_preview"],
        status=tpl_status,
        description=f"Meta {meta_result['category']} Template ({meta_result['language']})"
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)

    logger.info(f"[Templates] Template '{template.name}' saved to DB with status: {template.status}")
    return template

@router.delete("/{template_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_template(template_id: int, db: AsyncSession = Depends(get_db)):
    template = await db.get(MessageTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    # Try deleting from Meta if possible
    try:
        await whatsapp_service.delete_template_on_meta(template.name)
    except Exception as ex:
        logger.warning(f"[Templates] Could not delete '{template.name}' on Meta: {ex}")

    await db.delete(template)
    await db.commit()
    return None
