import json
from collections.abc import AsyncIterator
from typing import Any

import json_repair
from openai import APIError, AsyncOpenAI, RateLimitError
from openai.types.chat import ChatCompletionChunk
from pydantic import ValidationError
from sse_starlette import EventSourceResponse

from apps.chat.prompt import SYSTEM, build_sections_prompt
from apps.chat.schemas import ChatRequest, Message, ResumeSection, ToolCall
from apps.chat.tools.add_section import AddSectionTool
from apps.chat.tools.update_section import UpdateSectionTool
from shared.types.base_tool import ToolExecutionContext, ToolRegistry

# 重试机制常量
_RETRYABLE_ERRORS = (RateLimitError, APIError)
_MAX_RETRIES = 5


async def _create_chat_completion_with_retry(
    client: AsyncOpenAI,
    **input_args,
):
    import asyncio

    last_error: Exception | None = None

    for attempt in range(_MAX_RETRIES + 1):
        try:
            return await client.chat.completions.create(
                stream=True,
                **input_args,
            )
        except _RETRYABLE_ERRORS as e:
            last_error = e
            if attempt < _MAX_RETRIES:
                delay = 2**attempt
                await asyncio.sleep(delay)
            else:
                break
        except Exception:
            raise

    raise last_error


async def _process_streaming_response(
    response_stream: AsyncIterator[ChatCompletionChunk],
):
    accumulated_content: list[str] = []
    accumulated_reasoning: list[str] = []
    accumulated_tool_calls: dict[str, dict[str, Any]] = {}
    finish_reason: str | None = None

    async for chunk in response_stream:
        if chunk.choices is None or not len(chunk.choices):
            continue

        delta = chunk.choices[0].delta

        if hasattr(delta, "reasoning_content") and delta.reasoning_content:
            if not len(accumulated_reasoning):
                yield make_sse_event("thinking_start", {})

            accumulated_reasoning.append(delta.reasoning_content)
            yield make_sse_event("thinking_delta", {"text": delta.reasoning_content})

        if delta.content:
            if not len(accumulated_content):
                yield make_sse_event("text_start", {})

            accumulated_content.append(delta.content)
            yield make_sse_event("text_delta", {"text": delta.content})

        if delta.tool_calls:
            for tc in delta.tool_calls:
                idx = tc.index
                if idx not in accumulated_tool_calls:
                    accumulated_tool_calls[idx] = {
                        "id": tc.id or "",
                        "name": "",
                        "arguments": "",
                    }
                else:
                    # 调试：检查 id 是否从空字符串变成了有效值
                    existing_id = accumulated_tool_calls[idx]["id"]
                    if not existing_id and tc.id:
                        accumulated_tool_calls[idx]["id"] = tc.id

                entry = accumulated_tool_calls[idx]
                if tc.id:
                    entry["id"] = entry["id"] or tc.id
                if tc.function.name:
                    entry["name"] += tc.function.name
                if tc.function.arguments:
                    entry["arguments"] += tc.function.arguments

        finish_reason = chunk.choices[0].finish_reason

    assistant_thinking = "".join(accumulated_reasoning)
    assistant_content = "".join(accumulated_content)

    yield {
        "type": "result",
        "data": (
            assistant_thinking,
            assistant_content,
            accumulated_tool_calls,
            finish_reason,
        ),
    }


def _build_result(
    tool_call_id: str, is_error: bool, output: str = ""
) -> dict[str, Any]:
    """构建统一的工具调用结果字典"""
    return {"is_error": is_error, "tool_call_id": tool_call_id, "output": output}


async def _handle_tool_calls(
    accumulated_tool_calls: dict[str, dict[str, Any]],
    tool_registry: ToolRegistry,
    id_to_type: dict[str, str],
    sections: list[dict[str, Any]],
    messages: list[Message],
):
    tool_results: list[dict[str, Any]] = []

    for tool_call in accumulated_tool_calls.values():
        yield make_sse_event(
            "tool_call",
            {
                "name": tool_call["name"],
                "tool_call_id": tool_call["id"],
                "arguments": tool_call["arguments"],
            },
        )

        handler = tool_registry.get(tool_call["name"])

        # 工具不存在
        if handler is None:
            tool_id = tool_call["id"]
            result = _build_result(
                tool_id, is_error=True, output=f"Unknown tool: {tool_call['name']}"
            )
            tool_results.append(result)
            yield make_sse_event("tool_result", result)
            messages.append(
                Message(
                    role="tool",
                    tool_call_id=tool_id,
                    content=result["output"],
                    metadata={
                        "is_error": True,
                    },
                )
            )
            continue

        # 验证参数
        try:
            arguments = handler.input_model.model_validate_json(tool_call["arguments"])
        except ValidationError as e:
            errors = []
            for err in e.errors():
                field = ".".join(str(loc) for loc in err["loc"])
                errors.append(f"  - {field}: {err['msg']}")
            error_msg = "Validation failed:\n" + "\n".join(errors)
            tool_id = tool_call["id"]
            result = _build_result(tool_id, is_error=True, output=error_msg)
            tool_results.append(result)
            yield make_sse_event("tool_result", result)
            messages.append(
                Message(
                    role="tool",
                    tool_call_id=tool_id,
                    content=result["output"],
                    metadata={
                        "is_error": True,
                    },
                )
            )
            continue

        # 执行工具
        tool_result = await handler.execute(
            arguments,
            ToolExecutionContext(
                sections=sections,
                metadata={
                    "tool_call_id": tool_call["id"],
                    "id_to_type": id_to_type,
                },
            ),
        )

        tool_id = tool_call["id"]
        result = _build_result(tool_id, tool_result.is_error, tool_result.output)
        tool_results.append(result)
        yield make_sse_event("tool_result", result)
        messages.append(
            Message(
                role="tool",
                tool_call_id=tool_id,
                content=result["output"],
                metadata={
                    "is_error": tool_result.is_error,
                },
            )
        )

    yield {"type": "tool_results", "data": tool_results}


def make_sse_event(event: str, data: dict[str, Any]) -> dict[str, str]:
    return {"event": event, "data": json.dumps(data, ensure_ascii=False)}


async def chat_service(
    request: ChatRequest, sections: list[ResumeSection]
) -> EventSourceResponse:
    visible_sections: list[dict[str, Any]] = []
    id_to_type: dict[str, str] = {}
    for section in sections:
        if section.visible:
            id_to_type[section.id] = section.type
            content = json_repair.loads(section.content)
            new_section = section.model_dump()
            new_section["content"] = content
            visible_sections.append(new_section)

    visible_sections = sorted(
        visible_sections, key=lambda section: section["sort_order"]
    )

    return EventSourceResponse(generate_content(request, visible_sections, id_to_type))


def build_final_messages(
    messages: list[Message], resume_info: str, count: int
) -> list[dict[str, Any]]:
    final_messages: list[dict[str, Any]] = []
    last_msg = messages[-1] if messages else None

    for i, msg in enumerate(messages):
        msg_dict: dict[str, Any] = {"role": msg.role, "content": msg.content}
        is_last_msg = i == len(messages) - 1

        if msg.role == "assistant" and msg.tool_calls:
            msg_dict["tool_calls"] = [
                {
                    "id": tc.id,
                    "type": "function",
                    "function": {"name": tc.name, "arguments": tc.arguments},
                }
                for tc in msg.tool_calls
            ]

        if msg.role == "tool" and msg.tool_call_id:
            msg_dict["tool_call_id"] = msg.tool_call_id

        if count == 1 and is_last_msg and last_msg.role == "user":
            final_messages.append(
                {
                    "role": "user",
                    "content": f"Current Resume Information: \n---\n{resume_info}\n---",
                }
            )
            final_messages.append(msg_dict)
        elif count != 1 and is_last_msg and last_msg.role == "tool":
            msg_dict["content"] = json.dumps(
                {"content": msg.content, "resume_info": resume_info},
                ensure_ascii=False,
            )
            final_messages.append(msg_dict)
        else:
            final_messages.append(msg_dict)

    return final_messages


def make_current_resume_info(sections: list[dict[str, Any]]) -> str:
    return json.dumps(sections, ensure_ascii=False)


def convert_tool_schema(tools: list[dict[str, Any]]) -> list[dict[str, Any]]:
    return [
        {
            "type": "function",
            "function": {
                "name": tool["name"],
                "description": tool["description"],
                "parameters": {**tool["input_schema"]},
            },
        }
        for tool in tools
    ]


async def generate_content(
    request: ChatRequest, sections: list[dict[str, Any]], id_to_type: dict[str, str]
):
    max_count = 100
    client = AsyncOpenAI(base_url=request.base_url, api_key=request.api_key)
    messages: list[Message] = [msg for msg in request.messages if msg.role != "think"]
    tool_registry = ToolRegistry()
    tool_registry.register(UpdateSectionTool())
    tool_registry.register(AddSectionTool())
    count = 0

    while count < max_count:
        count += 1

        system = SYSTEM.format(sections=build_sections_prompt(sections))
        resume_info = make_current_resume_info(sections)
        tools = tool_registry.to_api_schema(sections)
        tools = convert_tool_schema(tools)

        final_messages = [{"role": "system", "content": system}]
        final_messages.extend(build_final_messages(messages, resume_info, count))

        yield make_sse_event("next", {})

        try:
            input_args = {
                "model": request.model,
                "messages": final_messages,
                "tools": tools,
            }
            response_stream = await _create_chat_completion_with_retry(
                client, **input_args
            )

            accumulated_tool_calls: dict[str, dict[str, Any]] = {}
            finish_reason: str | None = None

            async for event in _process_streaming_response(response_stream):
                if event.get("type") == "result":
                    _, assistant_content, accumulated_tool_calls, finish_reason = event[
                        "data"
                    ]
                else:
                    yield event

            # TODO: 这里占位提交think消息给后端数据库
            pass

            # TODO: 这里占位提交assistant消息给后端数据库, 而且要合并可能的tool_calls
            pass

            # 在messages中插入ai消息
            assistant_msg = Message(role="assistant")
            if assistant_content:
                assistant_msg.content = assistant_content
            if accumulated_tool_calls:
                assistant_msg.tool_calls = [
                    ToolCall(id=tc["id"], name=tc["name"], arguments=tc["arguments"])
                    for tc in accumulated_tool_calls.values()
                ]
            messages.append(assistant_msg)

            # 处理工具调用请求
            async for event in _handle_tool_calls(
                accumulated_tool_calls, tool_registry, id_to_type, sections, messages
            ):
                if event.get("type") == "tool_results":
                    tool_results = event["data"]
                else:
                    yield event

            # TODO: 这里占位将tool_results提交给后端数据库
            pass

            if finish_reason == "stop":
                yield make_sse_event("done", {})
                break
        except Exception as e:
            yield make_sse_event("error", {"message": str(e)})
            break
