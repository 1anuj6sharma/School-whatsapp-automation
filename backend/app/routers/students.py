from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from sqlalchemy.orm import joinedload
from app.database import get_db
from app.models.class_model import Class
from app.models.student import Student
from app.schemas.students import StudentCreate, StudentUpdate, StudentResponse

router = APIRouter(prefix="/api/students", tags=["Students"])

@router.get("", response_model=List[StudentResponse])
async def list_students(
    class_id: Optional[int] = Query(None, description="Filter by class ID"),
    search: Optional[str] = Query(None, description="Search by student or parent name, or phone"),
    opt_in: Optional[bool] = Query(None, description="Filter by WhatsApp opt-in status"),
    db: AsyncSession = Depends(get_db)
):
    stmt = select(Student).options(joinedload(Student.school_class)).order_by(Student.student_name)

    if class_id is not None:
        stmt = stmt.where(Student.class_id == class_id)
    if opt_in is not None:
        stmt = stmt.where(Student.whatsapp_opt_in == opt_in)
    if search:
        search_term = f"%{search.strip()}%"
        stmt = stmt.where(
            (Student.student_name.ilike(search_term)) |
            (Student.parent_name.ilike(search_term)) |
            (Student.whatsapp_number.ilike(search_term))
        )

    result = await db.execute(stmt)
    students = result.scalars().all()

    response = []
    for s in students:
        resp = StudentResponse(
            id=s.id,
            class_id=s.class_id,
            student_name=s.student_name,
            parent_name=s.parent_name,
            whatsapp_number=s.whatsapp_number,
            whatsapp_opt_in=s.whatsapp_opt_in,
            created_at=s.created_at,
            updated_at=s.updated_at,
            class_name=s.school_class.name if s.school_class else None
        )
        response.append(resp)
    return response

@router.post("", response_model=StudentResponse, status_code=status.HTTP_201_CREATED)
async def create_student(payload: StudentCreate, db: AsyncSession = Depends(get_db)):
    # Check if class exists
    school_class = await db.get(Class, payload.class_id)
    if not school_class:
        raise HTTPException(status_code=404, detail="Selected class does not exist.")

    student = Student(
        class_id=payload.class_id,
        student_name=payload.student_name.strip(),
        parent_name=payload.parent_name.strip() if payload.parent_name else None,
        whatsapp_number=payload.whatsapp_number,
        whatsapp_opt_in=payload.whatsapp_opt_in
    )
    db.add(student)
    await db.commit()
    await db.refresh(student)

    return StudentResponse(
        id=student.id,
        class_id=student.class_id,
        student_name=student.student_name,
        parent_name=student.parent_name,
        whatsapp_number=student.whatsapp_number,
        whatsapp_opt_in=student.whatsapp_opt_in,
        created_at=student.created_at,
        updated_at=student.updated_at,
        class_name=school_class.name
    )

@router.get("/{student_id}", response_model=StudentResponse)
async def get_student(student_id: int, db: AsyncSession = Depends(get_db)):
    stmt = select(Student).options(joinedload(Student.school_class)).where(Student.id == student_id)
    result = await db.execute(stmt)
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    return StudentResponse(
        id=student.id,
        class_id=student.class_id,
        student_name=student.student_name,
        parent_name=student.parent_name,
        whatsapp_number=student.whatsapp_number,
        whatsapp_opt_in=student.whatsapp_opt_in,
        created_at=student.created_at,
        updated_at=student.updated_at,
        class_name=student.school_class.name if student.school_class else None
    )

@router.put("/{student_id}", response_model=StudentResponse)
async def update_student(student_id: int, payload: StudentUpdate, db: AsyncSession = Depends(get_db)):
    stmt = select(Student).options(joinedload(Student.school_class)).where(Student.id == student_id)
    result = await db.execute(stmt)
    student = result.scalar_one_or_none()
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")

    if payload.class_id is not None:
        school_class = await db.get(Class, payload.class_id)
        if not school_class:
            raise HTTPException(status_code=404, detail="Selected class does not exist.")
        student.class_id = payload.class_id

    if payload.student_name is not None:
        student.student_name = payload.student_name.strip()
    if payload.parent_name is not None:
        student.parent_name = payload.parent_name.strip() if payload.parent_name else None
    if payload.whatsapp_number is not None:
        student.whatsapp_number = payload.whatsapp_number
    if payload.whatsapp_opt_in is not None:
        student.whatsapp_opt_in = payload.whatsapp_opt_in

    await db.commit()
    await db.refresh(student)

    return StudentResponse(
        id=student.id,
        class_id=student.class_id,
        student_name=student.student_name,
        parent_name=student.parent_name,
        whatsapp_number=student.whatsapp_number,
        whatsapp_opt_in=student.whatsapp_opt_in,
        created_at=student.created_at,
        updated_at=student.updated_at,
        class_name=student.school_class.name if student.school_class else None
    )

@router.delete("/{student_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_student(student_id: int, db: AsyncSession = Depends(get_db)):
    student = await db.get(Student, student_id)
    if not student:
        raise HTTPException(status_code=404, detail="Student not found")
    await db.delete(student)
    await db.commit()
    return None
