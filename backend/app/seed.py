import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal, init_db
from app.models.template import MessageTemplate
from app.utils.logger import logger

async def seed_database():
    logger.info("Initializing database and system templates...")
    await init_db()

    async with AsyncSessionLocal() as session:
        # Seed Meta hello_world template (pre-approved by Meta for instant testing)
        stmt = select(MessageTemplate).where(MessageTemplate.name == "hello_world")
        tpl_hello = (await session.execute(stmt)).scalar_one_or_none()
        hello_preview = (
            "Hello World\n\n"
            "Welcome and congratulations!! This message demonstrates your ability to send a WhatsApp message "
            "notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us."
        )
        if not tpl_hello:
            tpl_hello = MessageTemplate(
                name="hello_world",
                category="UTILITY",
                language="en_US",
                status="ACTIVE",
                description="Default Meta WhatsApp Testing Template (Pre-approved)",
                body_preview=hello_preview
            )
            session.add(tpl_hello)
            logger.info("Created system template: hello_world (Status: ACTIVE)")
        else:
            tpl_hello.status = "ACTIVE"
            tpl_hello.body_preview = hello_preview

        # Seed sample attendance template
        stmt = select(MessageTemplate).where(MessageTemplate.name == "student_attendance")
        tpl_att = (await session.execute(stmt)).scalar_one_or_none()
        if not tpl_att:
            tpl_att = MessageTemplate(
                name="student_attendance",
                category="UTILITY",
                language="en_US",
                status="PENDING",
                description="Student Attendance Notification Template (Pending Meta Approval)",
                body_preview="Hello {{1}},\n\nThis is to inform you that {{2}} was marked {{3}} today, {{4}}.\n\nRegards,\nSchool Administration"
            )
            session.add(tpl_att)
            logger.info("Created template: student_attendance (Status: PENDING)")

        await session.commit()
        logger.info("Database initialization completed successfully without dummy records.")

if __name__ == "__main__":
    asyncio.run(seed_database())
