import json
import logging
from typing import Any

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette import EventSourceResponse

from apps.resume_assistant.conversation_store import ConversationStore
from apps.resume_assistant.prompt import SYSTEM, build_sections_prompt
from apps.resume_assistant.schemas import ResumeAssistantRequest
from apps.resume_assistant.tools import (
    AddSectionTool,
    SectionInfoTool,
    UpdateSectionTool,
)
from shared.api import get_client
from shared.api.client import (
    ApiMessageCompleteEvent,
    ApiMessageRequest,
    ApiTextDeltaEvent,
    SupportsStreamingMessages,
)
from shared.models import ConversationMessageRecord
from shared.types.base_tool import ToolExecutionContext, ToolRegistry
from shared.types.messages import ConversationMessage, ToolResultBlock, ToolUseBlock
from shared.types.resume import ResumeSectionSchema

log = logging.getLogger(__name__)


async def resume_assistant_service(
    request: ResumeAssistantRequest,
    sections: list[ResumeSectionSchema],
    db: AsyncSession,
) -> EventSourceResponse:
    sections_list: list[dict[str, Any]] = []
    id_to_type: dict[str, str] = {}

    for section in sections:
        id_to_type[section.id] = section.type
        new_section = section.model_dump()
        sections_list.append(new_section)

    return EventSourceResponse(generate_content(request, sections_list, id_to_type, db))


async def generate_content(
    request: ResumeAssistantRequest,
    sections: list[dict[str, Any]],
    id_to_type: dict[str, str],
    db: AsyncSession,
):
    max_count = 30

    client = get_client(request.type, request.api_key, request.base_url)

    # 从 .conversation_store 目录读取缓存的 messages
    store = ConversationStore()
    messages: list[ConversationMessage] = store.read(request.resume_id)
    messages.append(ConversationMessage.from_user_text(request.input))

    # 收集本轮新增消息，结束时统一写入减少 I/O
    pending: list[ConversationMessage] = [messages[-1]]

    # 工具注册只做一次
    tool_registry = ToolRegistry()
    for tool in (
        UpdateSectionTool(),
        AddSectionTool(),
        SectionInfoTool(),
    ):
        tool_registry.register(tool)

    _cached_resume_info = None
    system = None
    tools_schema = None

    count = 0
    while count < max_count:
        count += 1

        # resume_info 每轮必须算（后续 insert_resume_info 要用）
        # 用结果字符串做 cache key，只有内容真正变化才重算 system 和 tools_schema
        resume_info = make_current_resume_info(sections)
        if resume_info != _cached_resume_info:
            _cached_resume_info = resume_info
            system = SYSTEM.format(sections=build_sections_prompt(sections))
            tools_schema = tool_registry.to_api_schema_v2(sections)

        new_messages = insert_resume_info(messages, resume_info, count)

        api_request = ApiMessageRequest(
            model=request.model,
            messages=new_messages,
            system_prompt=system,
            tools=tools_schema,
        )

        sended_think = False
        sended_text = False

        yield make_sse_event("next", {})

        try:
            complete_event: ApiMessageCompleteEvent | None = None
            async for event in client.stream_message(api_request):
                if isinstance(event, ApiTextDeltaEvent):
                    if event.is_think:
                        if not sended_think:
                            sended_think = True
                            yield make_sse_event("thinking_start", {})
                        yield make_sse_event("thinking_delta", {"text": event.text})
                    else:
                        if not sended_text:
                            sended_text = True
                            yield make_sse_event("text_start", {})
                        yield make_sse_event("text_delta", {"text": event.text})
                elif isinstance(event, ApiMessageCompleteEvent):
                    complete_event = event

            if complete_event is None:
                store.extend(request.resume_id, pending)
                yield make_sse_event("done", {})
                break

            # 添加ai消息
            db.add(
                ConversationMessageRecord(
                    conversation_id=request.resume_id,
                    role="assistant",
                    content=json.dumps(
                        [
                            block.model_dump()
                            for block in complete_event.message.content
                        ],
                        ensure_ascii=False,
                    ),
                    reasoning=complete_event.message._reasoning
                    if hasattr(complete_event.message, "_reasoning")
                    else None,
                )
            )

            messages.append(complete_event.message)

            async for event in _handle_tool_calls(
                complete_event.message.tool_uses,
                tool_registry,
                client,
                request.model,
                id_to_type,
                sections,
                messages,
                db,
            ):
                yield event

            # 添加tool result消息
            if messages[-1].role == "user":
                db.add(
                    ConversationMessageRecord(
                        conversation_id=request.resume_id,
                        role="user",
                        content=json.dumps(
                            [block.model_dump() for block in messages[-1].content],
                            ensure_ascii=False,
                        ),
                    )
                )
                pending.extend(messages[-2:])
            else:
                pending.append(messages[-1])

            await db.commit()

            # TODO: 这里要考虑stop_reason各种运营商兼容的格式
            if complete_event.stop_reason in ("end_turn", "stop"):
                store.extend(request.resume_id, pending)
                yield make_sse_event("done", {})
                break
        except Exception as e:
            log.error(f"POST /resume-assistant error: {str(e)}")
            store.extend(request.resume_id, pending)
            yield make_sse_event("error", {"message": str(e)})
            break


def make_current_resume_info(sections: list[dict[str, Any]]) -> str:
    def json_serializer(obj):
        if hasattr(obj, "isoformat"):
            return obj.isoformat()
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        if hasattr(obj, "__dict__"):
            return obj.__dict__
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    return json.dumps(sections, ensure_ascii=False, default=json_serializer)


def insert_resume_info(
    messages: list[ConversationMessage], resume_info: str, count: int
) -> list[ConversationMessage]:
    # 只处理最后一条消息，避免全量深拷贝
    if not messages:
        return messages

    last_msg = messages[-1]

    if count == 1 and last_msg.role == "user":
        return [
            *messages[:-1],
            ConversationMessage.from_user_text(
                f"Current Resume Information: \n---\n{resume_info}\n---"
            ),
            messages[-1],
        ]
    elif (
        count != 1
        and last_msg.role == "user"
        and last_msg.content
        and isinstance(last_msg.content[-1], ToolResultBlock)
    ):
        # 只对最后一条做浅拷贝 + 最后一个 content block 替换
        last_block = last_msg.content[-1]
        new_block = last_block.model_copy(
            update={
                "content": json.dumps(
                    {"content": last_block.content, "resume_info": resume_info},
                    ensure_ascii=False,
                )
            }
        )
        new_last = last_msg.model_copy(
            update={"content": [*last_msg.content[:-1], new_block]}
        )
        return [*messages[:-1], new_last]

    return messages


def make_sse_event(event: str, data: dict[str, Any]) -> dict[str, str]:

    return {
        "event": event,
        "data": json.dumps(data, ensure_ascii=False),
    }


# TODO: 这里先直接占位传递openai的客户端和model, 后续抽象出通用的接口, 和一个query_context
async def _handle_tool_calls(
    tool_use_blocks: list[ToolUseBlock],
    tool_registry: ToolRegistry,
    client: SupportsStreamingMessages,
    model: str,
    id_to_type: dict[str, str],
    sections: list[dict[str, Any]],
    messages: list[ConversationMessage],
    db: AsyncSession,
):
    tool_results: list[ToolResultBlock] = []

    for tool_use in tool_use_blocks:
        tool_id = tool_use.id

        yield make_sse_event(
            "tool_use",
            {
                "name": tool_use.name,
                "id": tool_id,
                "input": tool_use.input,
            },
        )

        handler = tool_registry.get(tool_use.name)

        # 工具不存在
        if handler is None:
            result = _build_result(
                tool_id, is_error=True, content=f"Unknown tool: {tool_use.name}"
            )

            tool_results.append(
                ToolResultBlock(
                    tool_use_id=tool_id,
                    content=result["content"],
                    is_error=True,
                )
            )

            yield make_sse_event("tool_result", result)
            continue

        # 验证参数
        try:
            arguments = handler.input_model.model_validate(tool_use.input)
        except ValidationError as e:
            errors = []
            for err in e.errors():
                field = ".".join(str(loc) for loc in err["loc"])
                errors.append(f"  - {field}: {err['msg']}")
            error_msg = "Validation failed:\n" + "\n".join(errors)
            result = _build_result(tool_id, is_error=True, content=error_msg)
            tool_results.append(
                ToolResultBlock(
                    tool_use_id=tool_id,
                    content=result["content"],
                    is_error=True,
                )
            )
            yield make_sse_event("tool_result", result)
            continue

        # 执行工具
        tool_result = await handler.execute(
            arguments,
            ToolExecutionContext(
                sections=sections,
                metadata={
                    "tool_use_id": tool_use.id,
                    "id_to_type": id_to_type,
                    "client": client,
                    "model": model,
                    "db": db,
                },
            ),
        )

        result = _build_result(tool_id, tool_result.is_error, tool_result.output)
        tool_results.append(
            ToolResultBlock(
                tool_use_id=tool_id,
                content=tool_result.output,
                is_error=tool_result.is_error,
            )
        )
        yield make_sse_event("tool_result", result)

    if tool_results:
        messages.append(
            ConversationMessage(role="user", content=tool_results),
        )


def _build_result(
    tool_use_id: str, is_error: bool, content: str = ""
) -> dict[str, Any]:
    """构建统一的工具调用结果字典"""
    return {"is_error": is_error, "tool_use_id": tool_use_id, "content": content}
