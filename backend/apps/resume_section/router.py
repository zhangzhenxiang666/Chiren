import json
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_session
from shared.models import ResumeSection
from shared.types.resume import ResumeSectionSchema

router = APIRouter(prefix="/resume-section", tags=["resume-section"])


@router.get(
    "/one",
    summary="获取指定简历的指定区块信息",
)
async def get_by_id_and_type(
    id: str,
    type: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeSectionSchema:
    result = await db.execute(
        select(ResumeSection).where(
            ResumeSection.resume_id == id, ResumeSection.type == type
        )
    )
    resume_section = result.scalar_one_or_none()
    if not resume_section:
        raise HTTPException(status_code=404, detail="数据不存在")
    return resume_section.to_pydantic()


@router.get(
    "/{id}",
    summary="根据简历id获取区块列表",
)
async def get_by_resumeid(
    id: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[ResumeSectionSchema]:
    result = await db.execute(
        select(ResumeSection).where(ResumeSection.resume_id == id)
    )
    resume_section_list = result.scalars().all()
    return [item.to_pydantic() for item in resume_section_list]


@router.post("/create", summary="添加区块")
async def create_section(
    data: ResumeSectionSchema,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeSectionSchema:

    section = ResumeSection.from_pydantic(data)
    db.add(section)
    try:
        await db.commit()
        await db.refresh(section)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="新增失败")
    return section.to_pydantic()


@router.put("/update", summary="修改区块")
async def update_section(
    data: ResumeSectionSchema,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeSectionSchema:
    result = await db.execute(select(ResumeSection).where(ResumeSection.id == data.id))
    resume_section = result.scalar_one_or_none()
    if not resume_section:
        raise HTTPException(status_code=404, detail="没有该区块")

    for key, value in data.model_dump(exclude_unset=True).items():
        if key == "content":
            value = json.dumps(value)
        setattr(resume_section, key, value)
    try:
        await db.commit()
        await db.refresh(resume_section)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="修改失败")
    return resume_section.to_pydantic()


@router.delete("/delete", summary="删除指定区块")
async def delete_section(
    id: Annotated[str, Query(description="区块ID")],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    await db.execute(delete(ResumeSection).where(ResumeSection.id == id))
    try:
        await db.commit()
    except Exception:
        raise HTTPException(status_code=500, detail="删除失败")
    return None


@router.delete("/delete/all", summary="清除指定简历所有区块")
async def delete_all(
    id: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    await db.execute(delete(ResumeSection).where(ResumeSection.resume_id == id))
    try:
        await db.commit()
    except Exception:
        raise HTTPException(status_code=500, detail="删除失败")
    return None
