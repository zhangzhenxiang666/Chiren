import json
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette import EventSourceResponse
from apps.cover_letter.prompt import SYSTEM, build_user_prompt
from apps.cover_letter.schemas import AiRequest
from shared.api import get_client
from shared.api.client import ApiMessageRequest, ApiTextDeltaEvent
from shared.types.messages import ConversationMessage
from shared.types.resume import ResumeSectionSchema


def make_see_event(event: str, data: dict[str, any]) -> dict[str, str]:
    return {"event": event, "data": json.dumps(data, ensure_ascii=False)}


async def cover_letter_service(
    data: AiRequest,
    section: list[ResumeSectionSchema],
    job_discription: str,
    job_title: str,
    db: AsyncSession,
) -> EventSourceResponse:
    return EventSourceResponse(
        generetor_cover_letter(data, section, job_discription, job_title, db)
    )


async def generetor_cover_letter(
    data: AiRequest,
    section: list[ResumeSectionSchema],
    job_discription: str,
    job_title: str,
    db: AsyncSession,
):
    client = get_client(data.type, data.api_key, data.base_url)
    message = [
        ConversationMessage.from_user_text(
            build_user_prompt(section, job_discription, job_title)
        )
    ]

    sended_text = False

    try:
        async for event in client.stream_message(
            ApiMessageRequest(
                model=data.model,
                messages=message,
                system_prompt=SYSTEM,
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

        else:
            yield make_see_event("done", {})

    except Exception as e:
        yield make_see_event("error", {"message": str(e)})
