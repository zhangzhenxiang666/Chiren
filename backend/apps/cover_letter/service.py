import json

from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette import EventSourceResponse

from apps.cover_letter.prompt import (
    build_cover_letter_system_prompt,
    build_cover_letter_user_prompt,
)
from apps.cover_letter.schemas import CoverLetterRequest
from shared.api import get_client
from shared.api.client import ApiMessageRequest, ApiTextDeltaEvent
from shared.types.messages import ConversationMessage
from shared.types.resume import ResumeSectionSchema


def make_see_event(event: str, data: dict[str, any]) -> dict[str, str]:
    return {"event": event, "data": json.dumps(data, ensure_ascii=False)}


def extract_personal_info(
    sections: list[ResumeSectionSchema],
) -> tuple[str, str, str]:
    """从简历区块中提取个人信息。

    Returns:
        tuple[姓名, 邮箱, 电话]
    """
    full_name = ""
    email = ""
    phone = ""

    for section in sections:
        if section.type == "personal_info" and section.content:
            if isinstance(section.content, dict):
                content_data = section.content
            else:
                content_data = (
                    section.content.model_dump()
                    if hasattr(section.content, "model_dump")
                    else {}
                )

            # 兼容前端驼峰命名和后端下划线命名
            personal_info = content_data.get("personal_info") or content_data
            # 前端: fullName, email, phone; 后端: full_name, email, phone
            full_name = (
                personal_info.get("full_name") or personal_info.get("fullName") or ""
            )
            email = personal_info.get("email") or ""
            phone = personal_info.get("phone") or ""

    return full_name, email, phone


async def cover_letter_service(
    request: CoverLetterRequest,
    sections: list[ResumeSectionSchema],
    db: AsyncSession,
) -> EventSourceResponse:
    return EventSourceResponse(generetor_cover_letter(request, sections, db))


async def generetor_cover_letter(
    request: CoverLetterRequest,
    sections: list[ResumeSectionSchema],
    db: AsyncSession,
):
    """生成求职信，流式输出（不保存到数据库）"""
    from apps.config.router import _get_provider_config_from_db

    # 提取个人信息
    full_name, email, phone = extract_personal_info(sections)

    config = await _get_provider_config_from_db(db)
    provider = config.providers.get(config.active)
    if not provider or not provider.api_key:
        yield make_see_event(
            "error", {"message": "请先在设置中配置 AI 供应商和 API Key"}
        )
        return

    client = get_client(config.active, provider.api_key, provider.base_url)
    message = [
        ConversationMessage.from_user_text(
            build_cover_letter_user_prompt(
                sections, request.jd_description, full_name, email, phone
            )
        )
    ]

    system_prompt = build_cover_letter_system_prompt(request.type, request.language)
    sended_text = False

    try:
        async for event in client.stream_message(
            ApiMessageRequest(
                model=provider.model,
                messages=message,
                system_prompt=system_prompt,
                temperature=0.5,
            )
        ):
            if isinstance(event, ApiTextDeltaEvent):
                if event.is_think:
                    continue
                if not sended_text:
                    sended_text = True
                    yield make_see_event("text_start", {})
                yield make_see_event("text_delta", {"text": event.text})

        yield make_see_event("done", {})

    except Exception as e:
        yield make_see_event("error", {"message": str(e)})
