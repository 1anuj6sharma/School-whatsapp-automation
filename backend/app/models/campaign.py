from datetime import datetime
from typing import List, TYPE_CHECKING
from sqlalchemy import Integer, String, ForeignKey, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.class_model import Class
    from app.models.template import MessageTemplate
    from app.models.message_log import MessageLog

class MessageCampaign(Base):
    __tablename__ = "message_campaigns"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    class_id: Mapped[int | None] = mapped_column(ForeignKey("classes.id", ondelete="SET NULL"), nullable=True)
    template_id: Mapped[int | None] = mapped_column(ForeignKey("message_templates.id", ondelete="SET NULL"), nullable=True)
    total_recipients: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    successful_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    failed_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    skipped_count: Mapped[int] = mapped_column(Integer, default=0, nullable=False)
    status: Mapped[str] = mapped_column(String(50), default="PENDING", nullable=False) # PENDING, PROCESSING, COMPLETED, FAILED

    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    started_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    completed_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)

    # Relationships
    school_class: Mapped["Class | None"] = relationship("Class", back_populates="campaigns")
    template: Mapped["MessageTemplate | None"] = relationship("MessageTemplate", back_populates="campaigns")
    message_logs: Mapped[List["MessageLog"]] = relationship("MessageLog", back_populates="campaign", cascade="all, delete-orphan")
