from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func
from sqlalchemy.orm import selectinload
from app.database import get_db
from app.models.class_model import Class
from app.models.student import Student
from app.schemas.classes import ClassCreate, ClassUpdate, ClassResponse

router = APIRouter(prefix="/api/classes", tags=["Classes"])

@router.get("", response_model=List[ClassResponse])
async def list_classes(db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Class)
        .options(selectinload(Class.students))
        .order_by(Class.name)
    )
    result = await db.execute(stmt)
    classes = result.scalars().all()

    response = []
    for cls in classes:
        resp_item = ClassResponse(
            id=cls.id,
            name=cls.name,
            section=cls.section,
            created_at=cls.created_at,
            updated_at=cls.updated_at,
            student_count=len(cls.students)
        )
        response.append(resp_item)
    return response

@router.post("", response_model=ClassResponse, status_code=status.HTTP_201_CREATED)
async def create_class(payload: ClassCreate, db: AsyncSession = Depends(get_db)):
    new_class = Class(
        name=payload.name.strip(),
        section=payload.section.strip() if payload.section else None
    )
    db.add(new_class)
    await db.commit()
    await db.refresh(new_class)
    return ClassResponse(
        id=new_class.id,
        name=new_class.name,
        section=new_class.section,
        created_at=new_class.created_at,
        updated_at=new_class.updated_at,
        student_count=0
    )

@router.get("/{class_id}", response_model=ClassResponse)
async def get_class(class_id: int, db: AsyncSession = Depends(get_db)):
    stmt = (
        select(Class)
        .options(selectinload(Class.students))
        .where(Class.id == class_id)
    )
    result = await db.execute(stmt)
    cls = result.scalar_one_or_none()
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    return ClassResponse(
        id=cls.id,
        name=cls.name,
        section=cls.section,
        created_at=cls.created_at,
        updated_at=cls.updated_at,
        student_count=len(cls.students)
    )

@router.put("/{class_id}", response_model=ClassResponse)
async def update_class(class_id: int, payload: ClassUpdate, db: AsyncSession = Depends(get_db)):
    cls = await db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")

    if payload.name is not None:
        cls.name = payload.name.strip()
    if payload.section is not None:
        cls.section = payload.section.strip() if payload.section else None

    await db.commit()
    await db.refresh(cls)

    # Count students
    count_stmt = select(func.count(Student.id)).where(Student.class_id == class_id)
    student_count = (await db.execute(count_stmt)).scalar() or 0

    return ClassResponse(
        id=cls.id,
        name=cls.name,
        section=cls.section,
        created_at=cls.created_at,
        updated_at=cls.updated_at,
        student_count=student_count
    )

@router.delete("/{class_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_class(class_id: int, db: AsyncSession = Depends(get_db)):
    cls = await db.get(Class, class_id)
    if not cls:
        raise HTTPException(status_code=404, detail="Class not found")
    await db.delete(cls)
    await db.commit()
    return None
