"""FastAPI 应用入口。"""

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apps.conversation_message import router as conversation_message_router
from apps.parser import router as parser_router
from apps.resume import router as resume_router
from apps.resume_assistant import router as resume_assistant_router
from apps.resume_section import router as resume_section_router
from apps.template import router as template_router
from apps.work import router as work_router
from shared.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    yield


app = FastAPI(lifespan=lifespan)

# CORS 中间件配置
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 注册路由
app.include_router(parser_router)
app.include_router(work_router)
app.include_router(resume_router)
app.include_router(resume_section_router)
app.include_router(template_router)
app.include_router(resume_assistant_router)
app.include_router(conversation_message_router)
