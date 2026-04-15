import asyncio
import json
import logging
from datetime import datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.jd_analysis.call_llm import executor_llm
from shared.api import SupportsStreamingMessages
from shared.models import SHANGHAI_TZ, BaseWork, JobDescriptionAnalysis, ResumeSection
from shared.task_state import (
    cleanup_task,
    update_task_error,
    update_task_result,
    update_task_status,
)
from shared.types.task import TaskStatus

log = logging.getLogger(__name__)


async def run_match_task(
    db: AsyncSession,
    task_id: str,
    client: SupportsStreamingMessages,
    model: str,
    resume_id: str,
    job_description: str,
    job_title: str | None = None,
) -> None:

    try:
        # 查询现有的 section 信息
        sections_result = await db.execute(
            select(ResumeSection)
            .where(ResumeSection.resume_id == resume_id, ResumeSection.visible == True)
            .order_by(ResumeSection.sort_order)
        )

        resume_section_list = sections_result.scalars().all()

        sections = [resume.to_pydantic() for resume in resume_section_list]

        await _update_work_status(db, task_id, TaskStatus.RUNNING)
        await update_task_status(task_id, TaskStatus.RUNNING)

        match_result = await executor_llm(
            client, model, sections, job_description, job_title
        )

        job_description_analysis = JobDescriptionAnalysis(
            resume_id=resume_id,
            job_description=job_description,
            summary=match_result.summary,
            overall_score=match_result.overall_score,
            ats_score=match_result.ats_score,
            keyword_matches=json.dumps(
                match_result.keyword_matches,
                ensure_ascii=False,
            ),
            missing_keywords=json.dumps(
                match_result.missing_keywords,
                ensure_ascii=False,
            ),
            suggestions=json.dumps(
                [s.model_dump() for s in match_result.suggestions],
                ensure_ascii=False,
            ),
        )
        db.add(job_description_analysis)
        await db.commit()
        await db.refresh(job_description_analysis)

        await _update_work_status(db, task_id, TaskStatus.SUCCESS)
        await update_task_result(
            task_id,
            {
                "jd_analysis_id": job_description_analysis.id,
            },
        )

        asyncio.create_task(cleanup_task(task_id, None))

    except Exception as e:
        await db.rollback()
        log.error(f"run_match_task error: {str(e)}")
        await _update_work_status(db, task_id, TaskStatus.ERROR)
        await update_task_error(task_id, f"run_match_task error: {str(e)}")
        asyncio.create_task(cleanup_task(task_id, None))
        raise


async def _update_work_status(
    db: AsyncSession, task_id: str, status: TaskStatus, error: str | None = None
) -> None:
    """更新任务状态到数据库。

    Args:
        task_id: 任务 ID。
        status: 新状态。
        error: 错误信息（当状态为 ERROR 时传入）。
    """
    result = await db.execute(select(BaseWork).where(BaseWork.id == task_id))
    work = result.scalar_one_or_none()
    if work:
        work.status = status.value
        work.updated_at = datetime.now(SHANGHAI_TZ)
        if error:
            work.error_message = error
        await db.commit()
