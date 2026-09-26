from datetime import datetime
from typing import List, TYPE_CHECKING
from sqlalchemy import String, Text, DateTime, func
from sqlalchemy.orm import Mapped, mapped_column, relationship
from app.database import Base

if TYPE_CHECKING:
    from app.models.campaign import MessageCampaign

class MessageTemplate(Base):
    __tablename__ = "message_templates"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(100), unique=True, nullable=False, index=True)
    category: Mapped[str] = mapped_column(String(50), default="UTILITY", nullable=False)
    language: Mapped[str] = mapped_column(String(20), default="en_US", nullable=False)
    description: Mapped[str | None] = mapped_column(String(255), nullable=True)
    body_preview: Mapped[str | None] = mapped_column(Text, nullable=True)
    header_type: Mapped[str | None] = mapped_column(String(30), default="NONE", nullable=True) # NONE, TEXT, IMAGE, DOCUMENT, VIDEO
    header_text: Mapped[str | None] = mapped_column(String(255), nullable=True)
    sample_image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(30), default="PENDING", nullable=False) # ACTIVE, PENDING, REJECTED
    created_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime, server_default=func.now(), onupdate=func.now())

    # Relationships
    campaigns: Mapped[List["MessageCampaign"]] = relationship("MessageCampaign", back_populates="template")
