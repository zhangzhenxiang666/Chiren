from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from apps.cover_letter.schemas import CoverLetterRequest
from apps.cover_letter.service import cover_letter_service
from shared.database import get_session
from shared.models import Resume, ResumeSection

router = APIRouter(prefix="/cover-letter", tags=["cover-letter"])


@router.post("", summary="AI 生成求职信")
async def generate_cover_letter(
    request: Annotated[CoverLetterRequest, Body(description="请求参数")],
    db: Annotated[AsyncSession, Depends(get_session)],
):
    """根据简历信息和岗位描述，AI 流式生成个性化求职信（不持久化存储）"""
    result = await db.execute(select(Resume).where(Resume.id == request.resume_id))
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="没有该简历")

    section = await db.execute(
        select(ResumeSection)
        .where(
            ResumeSection.resume_id == request.resume_id, ResumeSection.visible == True
        )
        .order_by(ResumeSection.sort_order)
    )
    items = section.scalars().all()
    sections = [item.to_pydantic() for item in items]
    return await cover_letter_service(request, sections, db)
