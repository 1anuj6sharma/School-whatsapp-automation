from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.database import get_db
from app.models.template import MessageTemplate
from app.schemas.templates import TemplateCreate, TemplateUpdate, TemplateResponse

router = APIRouter(prefix="/api/templates", tags=["Templates"])

@router.get("", response_model=List[TemplateResponse])
async def list_templates(db: AsyncSession = Depends(get_db)):
    stmt = select(MessageTemplate).order_by(MessageTemplate.name)
    result = await db.execute(stmt)
    templates = result.scalars().all()
    return templates

@router.get("/{template_id}", response_model=TemplateResponse)
async def get_template(template_id: int, db: AsyncSession = Depends(get_db)):
    template = await db.get(MessageTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template

@router.post("", response_model=TemplateResponse, status_code=status.HTTP_201_CREATED)
async def create_template(payload: TemplateCreate, db: AsyncSession = Depends(get_db)):
    # Check if template name already exists
    stmt = select(MessageTemplate).where(MessageTemplate.name == payload.name.strip())
    existing = (await db.execute(stmt)).scalar_one_or_none()
    if existing:
        raise HTTPException(status_code=400, detail=f"Template with name '{payload.name}' already exists.")

    template = MessageTemplate(
        name=payload.name.strip(),
        category=payload.category.strip().upper(),
        language=payload.language.strip(),
        description=payload.description.strip() if payload.description else None,
        body_preview=payload.body_preview.strip() if payload.body_preview else None,
        status=payload.status.strip().upper()
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return template

@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(template_id: int, payload: TemplateUpdate, db: AsyncSession = Depends(get_db)):
    template = await db.get(MessageTemplate, template_id)
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")

    if payload.category is not None:
        template.category = payload.category.strip().upper()
    if payload.language is not None:
        template.language = payload.language.strip()
    if payload.description is not None:
        template.description = payload.description.strip() if payload.description else None
    if payload.body_preview is not None:
        template.body_preview = payload.body_preview.strip() if payload.body_preview else None
    if payload.status is not None:
        template.status = payload.status.strip().upper()

    await db.commit()
    await db.refresh(template)
    return template
