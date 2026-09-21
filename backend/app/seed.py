import asyncio
from sqlalchemy import select
from app.database import AsyncSessionLocal, init_db
from app.models.template import MessageTemplate
from app.services.whatsapp_service import whatsapp_service
from app.utils.logger import logger

async def seed_database():
    """
    Initializes database tables and synchronizes all live templates directly
    from Meta WhatsApp Manager (WABA ID: 1086203377344807).
    """
    logger.info("Initializing database schema...")
    await init_db()

    async with AsyncSessionLocal() as session:
        # 1. Try syncing live templates from Meta WhatsApp Business Account
        try:
            logger.info("Fetching all live templates from Meta WhatsApp Business Manager...")
            meta_templates = await whatsapp_service.fetch_templates_from_meta()
            
            for item in meta_templates:
                name = item["name"]
                stmt = select(MessageTemplate).where(MessageTemplate.name == name)
                existing = (await session.execute(stmt)).scalar_one_or_none()

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
                    session.add(new_tpl)

            await session.commit()
            logger.info(f"Successfully synced {len(meta_templates)} live templates from Meta WhatsApp Manager on startup.")

        except Exception as ex:
            logger.warning(f"Live Meta template sync on startup skipped ({ex}). Ensuring base templates...")

            # Fallback: Ensure hello_world is present
            stmt = select(MessageTemplate).where(MessageTemplate.name == "hello_world")
            tpl_hello = (await session.execute(stmt)).scalar_one_or_none()
            if not tpl_hello:
                tpl_hello = MessageTemplate(
                    name="hello_world",
                    category="UTILITY",
                    language="en_US",
                    status="ACTIVE",
                    description="Default Meta WhatsApp Testing Template (Pre-approved)",
                    body_preview="Hello World\n\nWelcome and congratulations!! This message demonstrates your ability to send a WhatsApp message notification from the Cloud API, hosted by Meta. Thank you for taking the time to test with us."
                )
                session.add(tpl_hello)

            await session.commit()

        logger.info("Database startup and live template sync completed.")

if __name__ == "__main__":
    asyncio.run(seed_database())
