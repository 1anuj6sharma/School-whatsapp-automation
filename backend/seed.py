import asyncio
from app.seed import seed_database

if __name__ == "__main__":
    asyncio.run(seed_database())
