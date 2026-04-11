from typing import Annotated

from fastapi import APIRouter, Body, Depends
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.jd_analysis.schemas import ScoreRequest
from shared.database import get_session
from shared.models import JobDescriptionAnalysis, Resume
from shared.types.jd_analysis import JobDescriptionAnalysisSchema

router = APIRouter(
    prefix="/jd-analysis",
    tags=["jd-analysis"],
)


@router.get("/list/{resume_id}", summary="获取简历的职位分析列表(按时间降序)")
async def list_jd_analysis(
    resume_id: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[JobDescriptionAnalysisSchema]:

    result = await db.execute(
        select(JobDescriptionAnalysis)
        .where(JobDescriptionAnalysis.resume_id == resume_id)
        .order_by(JobDescriptionAnalysis.created_at.desc())
    )

    jd_analysis_list = result.scalars().all()

    return [jd_analysis.to_pydantic() for jd_analysis in jd_analysis_list]


@router.get("/{jd_analysis_id}", summary="获取职位分析详情")
async def get_jd_analysis(
    jd_analysis_id: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> JobDescriptionAnalysisSchema:

    result = await db.execute(
        select(JobDescriptionAnalysis).where(
            JobDescriptionAnalysis.id == jd_analysis_id
        )
    )

    jd_analysis = result.scalars().first()

    return jd_analysis.to_pydantic()


@router.post("/score", summary="创建一个jd分析评分任务")
async def create_jd_analysis_score_task(
    request: Annotated[ScoreRequest, Body(description="jd评分请求参数")],
    db: Annotated[AsyncSession, Depends(get_session)],
):
    result = await db.execute(select(Resume).where(Resume.id == request.resume_id))
    resume = result.scalar_one_or_none()

    if resume is None:
        # 抛出404错误
        raise

    if resume.meta_info is None or resume.meta_info:
        # 抛出错误, 因为评分是针对有jd描述的简历的
        raise

    meta_info = resume.meta_info

    job_description: str | None = meta_info.get("job_description")

    if job_description is None:
        # 如果没有这个字段要报错的
        raise

    job_title: str | None = meta_info.get("job_title")

    # TODO: 这里的逻辑后续补齐
    pass
