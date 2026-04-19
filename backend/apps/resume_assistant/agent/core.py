"""AgentCore - 纯函数，循环控制，无任何 I/O"""

import json
import logging
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from apps.resume_assistant.agent.context import QueryContext
from shared.models import ConversationMessageRecord

log = logging.getLogger(__name__)
from apps.resume_assistant.agent.events import (
    AgentEvent,
    DoneEvent,
    ErrorEvent,
    NextEvent,
    ToolResultEvent,
    ToolUseEvent,
)
from apps.resume_assistant.agent.formatters import StreamingFormatter
from apps.resume_assistant.agent.state import IterationState
from shared.api.client import (
    ApiMessageCompleteEvent,
    ApiMessageRequest,
    ApiTextDeltaEvent,
)
from shared.types.messages import ToolResultBlock, ToolUseBlock

ToolExecutor = Callable[
    [ToolUseBlock, list[dict[str, Any]], QueryContext],
    Awaitable[tuple[ToolResultEvent, ToolResultBlock, dict | None]],
]


async def make_current_resume_info(sections: list[dict[str, Any]]) -> str:
    """计算当前 resume 的缓存 key（JSON 序列化）"""

    def json_serializer(obj: Any) -> Any:
        if hasattr(obj, "isoformat"):
            return obj.isoformat()
        if hasattr(obj, "model_dump"):
            return obj.model_dump()
        if hasattr(obj, "__dict__"):
            return obj.__dict__
        raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

    return json.dumps(sections, ensure_ascii=False, default=json_serializer)


async def insert_resume_info(
    messages: list,  # list[ConversationMessage]
    resume_info: str,
    count: int,
) -> list:  # list[ConversationMessage]
    """在最后一条消息中插入 resume_info"""
    from shared.types.messages import ConversationMessage, ToolResultBlock

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


BuildSectionsPromptFn = Callable[[list[dict[str, Any]]], str]


class AgentCore:
    """AgentCore - 循环控制逻辑"""

    def __init__(self, context: QueryContext, tool_executor: ToolExecutor):
        self.context = context
        self.tool_executor = tool_executor

    async def run(
        self,
        initial_state: IterationState,
        sections: list[dict[str, Any]],
        system_template: str,
        system_suffix: str | None,
        build_sections_prompt_fn: BuildSectionsPromptFn,
        db: AsyncSession,
        resume_id: str,
    ) -> AsyncIterator[AgentEvent]:
        """运行主循环

        Args:
            initial_state: 初始迭代状态，包含 messages, pending 等
            sections: 简历 sections 列表
            system_template: system prompt 模板
            system_suffix: system prompt 后缀（包含 JD 子系统提示和 JD 分析结果），可为 None
            build_sections_prompt_fn: 构建 sections prompt 的函数
        """
        state = initial_state
        formatter = StreamingFormatter()

        while state.count < self.context.max_iterations:
            state.count += 1
            formatter.reset()

            # 1. 计算当前 resume 的缓存 key
            resume_info = await make_current_resume_info(sections)

            # 2. 如果 cache key 变了，重建 system 和 tools_schema
            if resume_info != state._cached_resume_info:
                state._cached_resume_info = resume_info

                # 构建 system prompt
                sections_prompt = build_sections_prompt_fn(sections)
                system = system_template.format(sections=sections_prompt)
                if system_suffix:
                    system += system_suffix

                state.system = system
                state.tools_schema = self.context.tool_registry.to_api_schema_v2(
                    sections
                )

            # 3. 插入 resume_info 到 messages
            state.messages = await insert_resume_info(
                state.messages, resume_info, state.count
            )

            # 4. 构建 API 请求
            api_request = ApiMessageRequest(
                model=self.context.model,
                messages=state.messages,
                system_prompt=state.system,
                tools=state.tools_schema,
                max_tokens=self.context.max_tokens,
                temperature=self.context.temperature,
            )

            # 5. yield NextEvent 表示开始新一轮迭代
            yield NextEvent()

            # 6. 流式处理 API 响应
            complete_event = None
            try:
                async for api_event in self.context.api_client.stream_message(
                    api_request
                ):
                    if isinstance(api_event, ApiTextDeltaEvent):
                        for agent_event in formatter.format(api_event):
                            yield agent_event
                    elif isinstance(api_event, ApiMessageCompleteEvent):
                        complete_event = api_event
            except Exception as e:
                log.error(f"Agent loop error: {e}")
                yield ErrorEvent(message=str(e))
                break

            # 7. 如果没有 complete_event，结束
            if complete_event is None:
                yield DoneEvent()
                break

            # 8. 添加 assistant 消息到 state.messages
            state.messages.append(complete_event.message)

            # 8.1 保存 assistant 消息到数据库
            db.add(
                ConversationMessageRecord(
                    conversation_id=resume_id,
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

            # 9. 处理工具调用
            if complete_event.message.tool_uses:
                async for event in self._handle_tool_calls(
                    complete_event.message.tool_uses,
                    state,
                    sections,
                ):
                    yield event

            # 9.1 保存 tool result 消息并提交
            if complete_event.message.tool_uses:
                db.add(
                    ConversationMessageRecord(
                        conversation_id=resume_id,
                        role="user",
                        content=json.dumps(
                            [
                                block.model_dump()
                                for block in state.messages[-1].content
                            ],
                            ensure_ascii=False,
                        ),
                    )
                )
            await db.commit()

            # 10. 更新 pending 消息
            if state.messages[-1].role == "user":
                state.pending.extend(state.messages[-2:])
            else:
                state.pending.append(state.messages[-1])

            # 11. 检查停止条件
            if complete_event.stop_reason in self.context.stop_reasons:
                yield DoneEvent()
                break

    async def _handle_tool_calls(
        self,
        tool_use_blocks: list[ToolUseBlock],
        state: IterationState,
        sections: list[dict[str, Any]],
    ) -> AsyncIterator[AgentEvent]:
        """处理工具调用

        Args:
            tool_use_blocks: 工具调用列表
            state: 当前迭代状态
            sections: 简历 sections

        Yields:
            AgentEvent: 工具相关事件
        """
        from shared.types.messages import ConversationMessage, ToolResultBlock

        tool_results: list[ToolResultBlock] = []

        for tool_use in tool_use_blocks:
            tool_id = tool_use.id

            yield ToolUseEvent(
                name=tool_use.name,
                id=tool_id,
                input=tool_use.input,
            )

            tool_result_event, tool_result_block, _ = await self.tool_executor(
                tool_use, sections, self.context
            )

            yield tool_result_event
            tool_results.append(tool_result_block)

        if tool_results:
            tool_result_msg = ConversationMessage(
                role="user",
                content=tool_results,
            )
            state.messages.append(tool_result_msg)
