from collections.abc import AsyncGenerator
from pathlib import Path
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from shared.models import Base

db_path = Path(__file__).parent.parent / "app.db"
engine = create_async_engine(f"sqlite+aiosqlite:///{db_path}")

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """初始化数据库表"""
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)


async def get_session() -> AsyncGenerator[AsyncSession, Any]:
    """获取数据库会话"""
    async with async_session() as session:
        yield session
