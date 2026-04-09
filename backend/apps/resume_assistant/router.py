from typing import Annotated

from fastapi import APIRouter, Body, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette import EventSourceResponse

from apps.resume_assistant.schemas import ResumeAssistantRequest
from apps.resume_assistant.service import resume_assistant_service
from shared.database import get_session
from shared.models import ResumeSection

router = APIRouter(prefix="/resume-assistant", tags=["resume-assistant"])


@router.post(
    "",
    summary="AI 简历助手 Agent",
)
async def resume_assistant(
    request: Annotated[ResumeAssistantRequest, Body(description="AI 简历助手请求参数")],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> EventSourceResponse:
    """AI 简历助手 Agent 接口。

    基于 LLM 的 Agent 接口，LLM 作为大脑，通过工具操作简历数据。
    自动处理多轮工具调用，并将 AI 回复和工具调用记录自动写入数据库。

    注意：调用此接口前，**用户消息需自行入库**。

    请求参数：
        - **resume_id**: 简历唯一标识
        - **type**: LLM 供应商类型（openai / anthropic）
        - **base_url**: AI API 地址
        - **api_key**: AI API 密钥
        - **model**: 模型名称
        - **input**: 用户输入/指令

    SSE 事件类型：

    + **next**: 开始新一轮交互。当 AI 需要多轮调用工具时会发送此事件。
    + **thinking_start**: AI 开始深度思考（CoT）。首次收到思考内容前发送。
    + **thinking_delta**: AI 思考内容的增量。payload: ``{"text": "思考内容片段"}``。
    + **text_start**: AI 开始输出文本回复。首次收到文本内容前发送。
    + **text_delta**: AI 输出文本的增量。payload: ``{"text": "文本内容片段"}``。
    + **tool_use**: AI 调用工具。payload: ``{"name": "工具名", "id": "调用ID", "input": {参数}}``。
    + **tool_result**: 工具执行结果。payload: ``{"is_error": bool, "tool_use_id": "调用ID", "content": "结果内容"}``。
    + **done**: 会话正常结束。
    + **error**: 发生错误。payload: ``{"message": "错误信息"}``。
    """
    result = await db.execute(
        select(ResumeSection)
        .where(
            ResumeSection.resume_id == request.resume_id, ResumeSection.visible == True
        )
        .order_by(ResumeSection.sort_order.asc())
    )
    resume_section_list = result.scalars().all()

    sections = [resume.to_pydantic() for resume in resume_section_list]

    return await resume_assistant_service(request, sections, db)
