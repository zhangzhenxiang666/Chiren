from collections.abc import AsyncGenerator
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from shared.models import Base

engine = create_async_engine("sqlite+aiosqlite:///./app.db", echo=True)

async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


async def init_db():
    """初始化数据库表"""
    async with engine.begin() as conn:
        Base.metadata.create_all(conn)


async def get_session() -> AsyncGenerator[AsyncSession, Any]:
    """获取数据库会话"""
    async with async_session() as session:
        yield session
