from typing import Annotated

from fastapi import APIRouter, Body
from sse_starlette import EventSourceResponse

from .schemas import ResumeAssistantRequest
from .service import resume_assistant_service

router = APIRouter(prefix="/resume-assistant", tags=["resume-assistant"])


@router.post("")
async def resume_assistant(
    request: Annotated[ResumeAssistantRequest, Body()],
) -> EventSourceResponse:
    # TODO: 根据id从java中获取简历信息
    sections = []

    return await resume_assistant_service(request, sections)
