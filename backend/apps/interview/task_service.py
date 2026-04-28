"""面试轮次摘要生成后台任务服务。

提供 LLM 驱动的面试轮次表现摘要生成功能，
通过 BaseWork 追踪任务状态，支持 SSE 流式推送进度。
"""

import asyncio
import json
import logging
from datetime import datetime

import json_repair
from pydantic import Field, ValidationError
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.api.client import (
    ApiMessageCompleteEvent,
    ApiMessageRequest,
    ApiTextDeltaEvent,
    SupportsStreamingMessages,
)
from shared.models import (
    SHANGHAI_TZ,
    BaseWork,
    ConversationMessageRecord,
    InterviewRound,
)
from shared.task_state import (
    cleanup_task,
    update_task_error,
    update_task_result,
    update_task_status,
)
from shared.types.messages import ConversationMessage
from shared.types.strict_model import StrictBaseModel
from shared.types.task import TaskStatus

log = logging.getLogger(__name__)

MAX_RETRIES = 3

INTERVIEW_SUMMARY_SYSTEM = """\
You are a professional interview evaluator. Your task is to review a complete interview
conversation and produce a concise assessment of the candidate's performance.

Below is the JSON schema you must follow:
<json_schema>
{json_schema}
</json_schema>

Important rules:
- Return valid JSON only — no additional text, explanations, or commentary
- Base your assessment entirely on the actual conversation content
- Score should reflect overall performance: 0-39 (poor), 40-59 (below average),
  60-79 (solid), 80-100 (exceptional)
- Strengths and weaknesses must each have 2-5 concrete, specific points
- Write the overall assessment in the same language the interview was conducted in
  (Chinese or English)"""


class InterviewRoundSummary(StrictBaseModel):
    """面试轮次摘要数据结构。"""

    overall_assessment: str = Field(description="Overall performance assessment")
    strengths: list[str] = Field(description="Key strengths demonstrated")
    weaknesses: list[str] = Field(description="Areas for improvement")
    score: int = Field(ge=0, le=100, description="Overall score (0-100)")


async def _load_round_messages(
    round_id: str, db: AsyncSession
) -> list[ConversationMessage]:
    """加载指定轮次的所有对话消息。

    Args:
        round_id: 面试轮次 ID（即 conversation_id）。
        db: 数据库会话。

    Returns:
        按时间排序的对话消息列表。
    """
    stmt = (
        select(ConversationMessageRecord)
        .where(ConversationMessageRecord.conversation_id == round_id)
        .order_by(ConversationMessageRecord.created_at.asc())
    )
    result = await db.execute(stmt)
    records = result.scalars().all()

    messages: list[ConversationMessage] = []
    for rec in records:
        try:
            content = json.loads(rec.content) if rec.content else []
        except (json.JSONDecodeError, TypeError):
            content = [{"type": "text", "text": rec.content or ""}]
        messages.append(ConversationMessage(role=rec.role, content=content))
    return messages


def _build_summary_prompt(messages: list[ConversationMessage]) -> str:
    """构建发给 LLM 的摘要请求。

    Args:
        messages: 该轮的所有对话消息。

    Returns:
        LLM 用户消息内容。
    """
    conversation_text_parts: list[str] = []
    for msg in messages:
        texts: list[str] = []
        for block in msg.content:
            if hasattr(block, "text") and block.text:
                texts.append(block.text)
        if texts:
            prefix = "面试官" if msg.role == "assistant" else "候选人"
            conversation_text_parts.append(f"{prefix}: {' '.join(texts)}")

    conversation_text = "\n\n".join(conversation_text_parts)

    if not conversation_text.strip():
        conversation_text = "（无对话记录）"

    return f"""Please analyze the following interview conversation and provide a concise
performance summary.

Interview conversation:
---
{conversation_text}
---

Generate the assessment based on the conversation above."""


async def _call_llm_for_summary(
    client: SupportsStreamingMessages,
    model: str,
    messages: list[ConversationMessage],
) -> InterviewRoundSummary:
    """调用 LLM 生成面试摘要。

    Args:
        client: LLM API 客户端。
        model: 模型名称。
        messages: 该轮的所有对话消息。

    Returns:
        解析后的面试摘要。

    Raises:
        Exception: LLM 调用失败或解析失败。
    """
    schema_json = json.dumps(
        InterviewRoundSummary.model_json_schema(), ensure_ascii=False
    )

    system_prompt = INTERVIEW_SUMMARY_SYSTEM.format(json_schema=schema_json)
    user_prompt = _build_summary_prompt(messages)
    api_messages = [ConversationMessage.from_user_text(user_prompt)]
    accumulated_content = ""

    for attempt in range(MAX_RETRIES):
        complete_event: ApiMessageCompleteEvent | None = None
        async for event in client.stream_message(
            ApiMessageRequest(
                model=model,
                messages=api_messages,
                system_prompt=system_prompt,
                max_tokens=2048,
                temperature=0.5,
            )
        ):
            if isinstance(event, ApiTextDeltaEvent):
                if event.is_think:
                    continue
                accumulated_content += event.text
            elif isinstance(event, ApiMessageCompleteEvent):
                complete_event = event

        if complete_event is None:
            raise Exception("LLM 未返回有效响应")

        try:
            parsed = json_repair.loads(accumulated_content)
            return InterviewRoundSummary.model_validate(parsed)
        except (ValidationError, json.JSONDecodeError) as e:
            if attempt == MAX_RETRIES - 1:
                raise Exception(f"LLM 摘要解析失败: {e}")
            api_messages.append(complete_event.message)
            api_messages.append(
                ConversationMessage.from_user_text(
                    f"Invalid response format: {e}. Please retry with valid JSON."
                )
            )
            accumulated_content = ""
            continue

    raise Exception("LLM 摘要生成失败：达到最大重试次数")


async def _update_work_status(
    db: AsyncSession, task_id: str, status: TaskStatus, error: str | None = None
) -> None:
    """更新 BaseWork 记录状态。

    Args:
        db: 数据库会话。
        task_id: 任务 ID。
        status: 新状态。
        error: 错误信息（状态为 ERROR 时传入）。
    """
    result = await db.execute(select(BaseWork).where(BaseWork.id == task_id))
    work = result.scalar_one_or_none()
    if work:
        work.status = status.value
        work.updated_at = datetime.now(SHANGHAI_TZ)
        if error:
            work.error_message = error
        await db.commit()


async def run_round_summary_task(
    db: AsyncSession,
    task_id: str,
    round_id: str,
    client: SupportsStreamingMessages,
    model: str,
) -> None:
    """执行面试轮次摘要生成的后台任务。

    Args:
        db: 数据库会话。
        task_id: 任务 ID（对应 BaseWork.id）。
        round_id: 面试轮次 ID。
        client: LLM API 客户端。
        model: 模型名称。
    """
    try:
        await _update_work_status(db, task_id, TaskStatus.RUNNING)
        await update_task_status(task_id, TaskStatus.RUNNING)

        messages = await _load_round_messages(round_id, db)

        if not messages:
            raise Exception("该轮次没有对话记录，无法生成摘要")

        summary = await _call_llm_for_summary(client, model, messages)

        result = await db.execute(
            select(InterviewRound).where(InterviewRound.id == round_id)
        )
        round_obj = result.scalar_one_or_none()
        if round_obj is None:
            raise Exception(f"面试轮次不存在: {round_id}")

        meta_info = round_obj.meta_info or {}
        meta_info["round_summary"] = {
            "overall_assessment": summary.overall_assessment,
            "strengths": summary.strengths,
            "weaknesses": summary.weaknesses,
            "score": summary.score,
            "generated_at": datetime.now(SHANGHAI_TZ).isoformat(),
        }
        round_obj.meta_info = meta_info

        await db.commit()

        await _update_work_status(db, task_id, TaskStatus.SUCCESS)
        await update_task_result(task_id, {"round_id": round_id})

        asyncio.create_task(cleanup_task(task_id, None))

    except Exception as e:
        await db.rollback()
        log.exception("Interview summary task failed: %s", e)
        await _update_work_status(
            db, task_id, TaskStatus.ERROR, f"摘要生成失败: {str(e)}"
        )
        await update_task_error(task_id, f"run_round_summary_task error: {str(e)}")
        asyncio.create_task(cleanup_task(task_id, None))
        raise
