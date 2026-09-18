import asyncio
from sqlalchemy import select
from app.config import settings
from app.database import AsyncSessionLocal, init_db
from app.models.class_model import Class
from app.models.student import Student
from app.models.template import MessageTemplate
from app.utils.logger import logger
from app.utils.phone import sanitize_phone_number

async def seed_database():
    logger.info("Starting database seeding...")
    await init_db()

    async with AsyncSessionLocal() as session:
        # 1. Seed Default Class: Class 10-A
        stmt = select(Class).where(Class.name == "Class 10-A")
        class_10a = (await session.execute(stmt)).scalar_one_or_none()
        if not class_10a:
            class_10a = Class(name="Class 10-A", section="A")
            session.add(class_10a)
            await session.flush()
            logger.info(f"Created class: {class_10a.name} (ID: {class_10a.id})")
        else:
            logger.info(f"Class already exists: {class_10a.name} (ID: {class_10a.id})")

        # 2. Seed Templates: hello_world (ACTIVE) & student_attendance (PENDING)
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
            logger.info("Created template: hello_world (Status: ACTIVE)")
        else:
            tpl_hello.status = "ACTIVE"
            tpl_hello.body_preview = hello_preview

        stmt = select(MessageTemplate).where(MessageTemplate.name == "student_attendance")
        tpl_att = (await session.execute(stmt)).scalar_one_or_none()
        if not tpl_att:
            tpl_att = MessageTemplate(
                name="student_attendance",
                category="UTILITY",
                language="en_US",
                status="PENDING",
                description="Student Attendance Notification Template (Pending Meta Approval)",
                body_preview="Hello {{1}},\n\nThis is to inform you that {{2}} was marked {{3}} today, {{4}}.\n\nRegards,\nABC School"
            )
            session.add(tpl_att)
            logger.info("Created template: student_attendance (Status: PENDING)")
        else:
            tpl_att.status = "PENDING"
            tpl_att.body_preview = "Hello {{1}},\n\nThis is to inform you that {{2}} was marked {{3}} today, {{4}}.\n\nRegards,\nABC School"

        # 3. Seed Students dynamically reading numbers from .env
        env_numbers = settings.get_recipient_list()
        if not env_numbers:
            env_numbers = ["919876543210", "919876543211"]

        names = ["Rahul Sharma", "Priya Sharma", "Amit Patel", "Sneha Gupta", "Vikas Verma"]

        for idx, raw_phone in enumerate(env_numbers):
            clean_phone = sanitize_phone_number(raw_phone)
            student_name = names[idx] if idx < len(names) else f"Test Student {idx + 1}"
            parent_name = f"{student_name.split()[0]}'s Parent"

            stmt = select(Student).where(
                (Student.class_id == class_10a.id) &
                ((Student.student_name == student_name) | (Student.whatsapp_number == clean_phone))
            )
            existing_student = (await session.execute(stmt)).scalar_one_or_none()

            if not existing_student:
                new_student = Student(
                    class_id=class_10a.id,
                    student_name=student_name,
                    parent_name=parent_name,
                    whatsapp_number=clean_phone,
                    whatsapp_opt_in=True
                )
                session.add(new_student)
                logger.info(f"Seeded student: {student_name} with phone +{clean_phone}")
            else:
                existing_student.whatsapp_number = clean_phone
                existing_student.whatsapp_opt_in = True
                logger.info(f"Updated student {existing_student.student_name} with phone +{clean_phone}")

        await session.commit()
        logger.info("Database seeding completed successfully!")

if __name__ == "__main__":
    asyncio.run(seed_database())
