"""FastAPI 应用入口。"""

import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.routing import APIRoute

from apps.config import router as config_router
from apps.conversation_message import router as conversation_message_router
from apps.cover_letter import router as cover_letter_router
from apps.export import router as export_router
from apps.export.browser_manager import ensure_browser
from apps.jd_analysis import router as jd_analysis_router
from apps.parser import router as parser_router
from apps.resume import router as resume_router
from apps.resume_assistant import router as resume_assistant_router
from apps.resume_section import router as resume_section_router
from apps.template import router as template_router
from apps.work import cleanup_work
from apps.work import router as work_router
from shared.database import init_db

logging.basicConfig(level=logging.INFO)

log = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    await init_db()
    deleted = await cleanup_work()
    log.info("Cleaned up %d work records on startup", deleted)
    asyncio.create_task(ensure_browser())
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
app.include_router(config_router)
app.include_router(parser_router)
app.include_router(work_router)
app.include_router(resume_router)
app.include_router(resume_section_router)
app.include_router(template_router)
app.include_router(jd_analysis_router)
app.include_router(cover_letter_router)
app.include_router(resume_assistant_router)
app.include_router(conversation_message_router)
app.include_router(export_router)


for route in app.routes:
    if isinstance(route, APIRoute):
        route.response_model_by_alias = True
