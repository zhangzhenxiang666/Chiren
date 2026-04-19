"""AgentRuntime - I/O 胶水层，连接 AgentCore 和外部世界"""

import logging
from collections.abc import AsyncIterator
from typing import Any

from pydantic import ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.resume_assistant.agent.context import QueryContext
from apps.resume_assistant.agent.core import (
    AgentCore,
    BuildSectionsPromptFn,
    ToolExecutor,
)
from apps.resume_assistant.agent.events import ToolResultEvent
from apps.resume_assistant.agent.formatters import to_sse_event
from apps.resume_assistant.agent.state import IterationState
from apps.resume_assistant.prompt import build_jd_prompt
from apps.resume_assistant.schemas import ResumeAssistantRequest
from shared.api.client import SupportsStreamingMessages
from shared.models import JobDescriptionAnalysis, Resume
from shared.types.base_tool import ToolExecutionContext, ToolRegistry
from shared.types.messages import ToolResultBlock, ToolUseBlock

log = logging.getLogger(__name__)


async def create_tool_executor(
    db: AsyncSession,
    tool_registry: ToolRegistry,
    id_to_type: dict[str, str],
) -> ToolExecutor:
    async def tool_executor(
        tool_use: ToolUseBlock,
        sections: list[dict[str, Any]],
        context: QueryContext,
    ) -> tuple[ToolResultEvent, ToolResultBlock, dict | None]:
        tool_id = tool_use.id
        handler = tool_registry.get(tool_use.name)
        if handler is None:
            result_content = f"Unknown tool: {tool_use.name}"
            return (
                ToolResultEvent(
                    is_error=True, tool_use_id=tool_id, content=result_content
                ),
                ToolResultBlock(
                    tool_use_id=tool_id, content=result_content, is_error=True
                ),
                None,
            )

        try:
            arguments = handler.input_model.model_validate(tool_use.input)
        except ValidationError as e:
            errors = []
            for err in e.errors():
                field = ".".join(str(loc) for loc in err["loc"])
                errors.append(f"  - {field}: {err['msg']}")
            error_msg = "Validation failed:\n" + "\n".join(errors)
            return (
                ToolResultEvent(is_error=True, tool_use_id=tool_id, content=error_msg),
                ToolResultBlock(tool_use_id=tool_id, content=error_msg, is_error=True),
                None,
            )

        client = context.api_client
        model_name = context.model

        tool_result = await handler.execute(
            arguments,
            ToolExecutionContext(
                sections=sections,
                metadata={
                    "tool_use_id": tool_use.id,
                    "id_to_type": id_to_type,
                    "client": client,
                    "model": model_name,
                    "db": db,
                },
            ),
        )

        section_content = None
        if tool_use.name == "update_section":
            for section in sections:
                if section["id"] == tool_use.input["section_id"]:
                    section_content = {"data": section["content"], "id": section["id"]}
                    break
        elif tool_use.name == "add_section":
            for section in sections:
                if (
                    section["type"] == tool_use.input["type"]
                    and section["title"] == tool_use.input["title"]
                ):
                    section_content = {**section}
                    break

        result_event = ToolResultEvent(
            is_error=tool_result.is_error,
            tool_use_id=tool_id,
            content=tool_result.output,
            section_content=section_content,
        )
        result_block = ToolResultBlock(
            tool_use_id=tool_id,
            content=tool_result.output,
            is_error=tool_result.is_error,
        )

        return (result_event, result_block, section_content)

    return tool_executor


class AgentRuntime:
    """AgentRuntime - I/O 胶水层，连接 AgentCore 和外部世界"""

    def __init__(
        self,
        db: AsyncSession,
        store,
        api_client: SupportsStreamingMessages,
        tool_registry: ToolRegistry,
        model: str,
        max_tokens: int | None = None,
        temperature: float = 1.0,
        max_iterations: int = 30,
        stop_reasons: set[str] | None = None,
    ):
        self.db = db
        self.store = store
        self.api_client = api_client
        self.tool_registry = tool_registry
        self.model = model
        self.max_tokens = max_tokens
        self.temperature = temperature
        self.max_iterations = max_iterations
        self.stop_reasons = stop_reasons or {"end_turn", "stop"}

    async def execute(
        self,
        request: ResumeAssistantRequest,
        initial_state: IterationState,
        sections: list[dict[str, Any]],
        system_template: str,
        sub_system_template: str | None,
        build_sections_prompt_fn: BuildSectionsPromptFn,
        id_to_type: dict[str, str],
        resume: Resume | None = None,
    ) -> AsyncIterator[dict[str, str]]:
        system_suffix: str | None = None

        if resume is not None and resume.meta_info:
            job_description = resume.meta_info.get("job_description")
            if job_description:
                parts: list[str] = [
                    sub_system_template.format(job_description=job_description)
                ]
            else:
                parts = []

            result = await self.db.execute(
                select(JobDescriptionAnalysis)
                .where(JobDescriptionAnalysis.resume_id == resume.id)
                .order_by(JobDescriptionAnalysis.created_at.desc())
                .limit(1)
            )
            jd_analysis = result.scalars().first()
            if jd_analysis is not None:
                parts.append(build_jd_prompt(jd_analysis.to_pydantic(), sections))

            if parts:
                system_suffix = "\n\n" + "\n\n".join(parts)

        context = QueryContext(
            api_client=self.api_client,
            tool_registry=self.tool_registry,
            model=self.model,
            max_tokens=self.max_tokens,
            temperature=self.temperature,
            max_iterations=self.max_iterations,
            stop_reasons=self.stop_reasons,
            metadata={},
        )

        tool_executor_fn = await create_tool_executor(
            db=self.db,
            tool_registry=self.tool_registry,
            id_to_type=id_to_type,
        )

        core = AgentCore(context=context, tool_executor=tool_executor_fn)

        try:
            async for agent_event in core.run(
                initial_state=initial_state,
                sections=sections,
                system_template=system_template,
                system_suffix=system_suffix,
                build_sections_prompt_fn=build_sections_prompt_fn,
                db=self.db,
                resume_id=request.resume_id,
            ):
                yield to_sse_event(agent_event)
        finally:
            self.store.extend(request.resume_id, initial_state.pending)
            initial_state.pending.clear()
