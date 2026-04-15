from typing import Annotated
from fastapi import APIRouter, Body, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from starlette import status
from apps.cover_letter.schemas import AiRequest
from apps.cover_letter.service import cover_letter_service
from shared.database import get_session
from shared.models import Resume, ResumeSection

router = APIRouter(prefix="/cover-letter", tags=["cover-letter"])


@router.post("", summary="ai生成求职信")
async def generate_cover_letter(
    data: Annotated[AiRequest, Body(description="请求参数")],
    db: Annotated[AsyncSession, Depends(get_session)],
):
    result = await db.execute(select(Resume).where(Resume.id == data.resume_id))
    one = result.scalar_one_or_none()
    if not one:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="没有该简历")
    info = one.meta_info
    if not info or "job_description" not in info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="简历没有岗位信息"
        )
    des: str = info.get("job_description")
    title: str | None = info.get("job_title")

    section = await db.execute(
        select(ResumeSection)
        .where(ResumeSection.resume_id == data.resume_id, ResumeSection.visible == True)
        .order_by(ResumeSection.sort_order)
    )
    items = section.scalars().all()
    sections = [item.to_pydantic() for item in items]
    return await cover_letter_service(data, des, title, sections, db)
