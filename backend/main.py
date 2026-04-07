"""FastAPI 应用入口。"""

from fastapi import FastAPI

from apps.parser import router as parser_router
from apps.resume_assistant import router as chat_router

from contextlib import asynccontextmanager

from shared.database import init_db

@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield

app = FastAPI(lifespan = lifespan)

# 注册路由
app.include_router(parser_router)
app.include_router(chat_router)
