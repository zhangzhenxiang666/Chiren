import json
import secrets
from collections.abc import AsyncIterator
from typing import Any

import json_repair
from openai import APIError, AsyncOpenAI, RateLimitError
from openai.types.chat import ChatCompletionChunk
from pydantic import BaseModel, ValidationError
from sse_starlette import EventSourceResponse

from .prompt import SYSTEM, build_sections_prompt
from .schemas import (
    CertificationItem,
    ChatRequest,
    CustomItem,
    EducationItem,
    GitHubItem,
    LanguageItem,
    Message,
    PersonalInfo,
    ProjectItem,
    ResumeSection,
    SkillItem,
    Summary,
    ToolCall,
    WorkExperienceItem,
)
from .tools.update_section import make_update_section_tool

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


def _handle_tool_calls(
    accumulated_tool_calls: dict[str, dict[str, Any]],
    id_to_type: dict[str, str],
    sections: list[dict[str, Any]],
    messages: list[Message],
):
    tool_results: list[dict[str, Any]] = []

    for tool_call in accumulated_tool_calls.values():
        if tool_call["name"] != "update_section":
            continue

        yield make_sse_event(
            "tool_call",
            {
                "name": tool_call["name"],
                "tool_call_id": tool_call["id"],
                "arguments": tool_call["arguments"],
            },
        )

        # 1. 将 arguments 解析为 dict
        try:
            args = json_repair.loads(tool_call["arguments"])
        except Exception as e:
            error_msg = f"参数解析失败: {e}"
            tool_results.append(
                {"success": False, "error": error_msg, "tool_call_id": tool_call["id"]}
            )
            yield make_sse_event(
                "tool_result",
                {"success": False, "error": error_msg, "tool_call_id": tool_call["id"]},
            )
            continue

        # 2. 根据 section_id 获取 section_type
        section_id = args.get("section_id")
        section_type = id_to_type.get(section_id)
        if not section_type:
            error_msg = f"未找到 section_id: {section_id}"
            tool_results.append(
                {"success": False, "error": error_msg, "tool_call_id": tool_call["id"]}
            )
            yield make_sse_event(
                "tool_result",
                {"success": False, "error": error_msg, "tool_call_id": tool_call["id"]},
            )
            continue

        # 3. 获取对应的 pydantic 模型并验证 value
        model = SECTION_TYPE_TO_MODEL.get(section_type)
        value = args.get("value", {})

        try:
            if section_type in ("personal_info", "summary"):
                model.model_validate(value)
            elif section_type in (
                "work_experience",
                "education",
                "projects",
                "certifications",
                "languages",
                "github",
                "custom",
            ):
                for item_data in value.get("items", []):
                    model.model_validate(item_data)
            elif section_type == "skills":
                for category_data in value.get("categories", []):
                    model.model_validate(category_data)
        except ValidationError as e:
            error_msg = f"数据验证失败: {e}"
            tool_results.append(
                {"success": False, "error": error_msg, "tool_call_id": tool_call["id"]}
            )
            yield make_sse_event(
                "tool_result",
                {"success": False, "error": error_msg, "tool_call_id": tool_call["id"]},
            )
            continue

        # 4. 验证通过，执行更新
        for section in sections:
            if section["id"] != section_id:
                continue

            content = section.get("content", {})

            if section_type in ("personal_info", "summary"):
                content.update(value)
            elif section_type in (
                "work_experience",
                "education",
                "projects",
                "certifications",
                "languages",
                "github",
                "custom",
            ):
                content["items"] = _assign_ids(
                    value.get("items", []), content.get("items", [])
                )
            elif section_type == "skills":
                content["categories"] = _assign_ids(
                    value.get("categories", []), content.get("categories", [])
                )
            break

        yield make_sse_event(
            "tool_result", {"success": True, "tool_call_id": tool_call["id"]}
        )

        # 5. 添加成功结果到 messages
        tool_msg = Message(
            role="tool",
            tool_call_id=tool_call["id"],
            content=json.dumps({"success": True}),
        )
        messages.append(tool_msg)

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

        if count == 1 and is_last_msg and last_msg.role == "user":
            final_messages.append(
                {"role": "user", "content": f"当前简历信息: \n---\n{resume_info}\n---"}
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


SECTION_TYPE_TO_MODEL: dict[str, type[BaseModel]] = {
    "personal_info": PersonalInfo,
    "summary": Summary,
    "work_experience": WorkExperienceItem,
    "education": EducationItem,
    "projects": ProjectItem,
    "certifications": CertificationItem,
    "languages": LanguageItem,
    "github": GitHubItem,
    "custom": CustomItem,
    "skills": SkillItem,
}


def _generate_prefix() -> str:
    return secrets.token_hex(4)


def _generate_id(prefix: str, index: int) -> str:
    return f"{prefix}-{index:04d}"


def _assign_ids(submitted_items: list, existing_items: list) -> list:
    if existing_items:
        last_id = (
            existing_items[-1].get("id", "")
            if isinstance(existing_items[-1], dict)
            else existing_items[-1].get("id", "")
        )
        prefix = last_id.split("-")[0]
        last_index = int(last_id.split("-")[1])
    else:
        prefix = _generate_prefix()
        last_index = 0

    next_index = last_index + 1
    result = []
    for item in submitted_items:
        if isinstance(item, dict):
            if "id" not in item or not item["id"]:
                item["id"] = _generate_id(prefix, next_index)
                next_index += 1
            result.append(item)
        else:
            result.append(item)
    return result


async def generate_content(
    request: ChatRequest, sections: list[dict[str, Any]], id_to_type: dict[str, str]
):
    max_count = 100
    client = AsyncOpenAI(base_url=request.base_url, api_key=request.api_key)
    messages: list[Message] = [msg for msg in request.messages if msg.role != "think"]

    count = 0

    while count < max_count:
        count += 1

        system = SYSTEM.format(sections=build_sections_prompt(sections))
        resume_info = make_current_resume_info(sections)
        update_section_tool = make_update_section_tool(sections)

        final_messages = [{"role": "system", "content": system}]
        final_messages.extend(build_final_messages(messages, resume_info, count))

        yield make_sse_event("next", {})

        try:
            input_args = {
                "model": request.model,
                "messages": final_messages,
                "tools": [update_section_tool.openai_tool],
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
            for event in _handle_tool_calls(
                accumulated_tool_calls, id_to_type, sections, messages
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
