from typing import Annotated

from fastapi import APIRouter, Body
from sse_starlette import EventSourceResponse

from .schemas import ChatRequest
from .service import chat_service

router = APIRouter(prefix="/chat", tags=["chat"])


@router.post("")
async def chat(request: Annotated[ChatRequest, Body()]) -> EventSourceResponse:
    # TODO: 根据id从java中获取简历信息
    sections = []

    return await chat_service(request, sections)
