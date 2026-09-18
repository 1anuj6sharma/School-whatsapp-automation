from datetime import datetime
from typing import List, TYPE_CHECKING
from sqlalchemy import String, Boolean, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.class_model import Class
    from app.models.message_log import MessageLog

class Student(Base):
    __tablename__ = "students"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    class_id: Mapped[int] = mapped_column(ForeignKey("classes.id", ondelete="CASCADE"), nullable=False, index=True)
    student_name: Mapped[str] = mapped_column(String(150), nullable=False)
    parent_name: Mapped[str | None] = mapped_column(String(150), nullable=True)
    whatsapp_number: Mapped[str] = mapped_column(String(20), nullable=False, index=True)
    whatsapp_opt_in: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    school_class: Mapped["Class"] = relationship("Class", back_populates="students")
    message_logs: Mapped[List["MessageLog"]] = relationship("MessageLog", back_populates="student")
