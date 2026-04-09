import json
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.resume.service import create_default_sections
from shared.database import get_session
from shared.models import Resume
from shared.types.resume import ResumeSchema

router = APIRouter(prefix="/resume", tags=["resume"])


class WorkspaceInfo(ResumeSchema):
    """工作空间信息，包含子简历数量"""

    sub_resume_count: int = 0


@router.get("/list", summary="查询workspace_id = null的主简历")
async def list_resumes(
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[WorkspaceInfo]:
    result = await db.execute(
        select(Resume)
        .where(Resume.workspace_id.is_(None))
        .options(selectinload(Resume.versions))
    )
    resume_list = result.scalars().all()

    return [
        WorkspaceInfo(
            **resume.to_pydantic().model_dump(),
            sub_resume_count=len(resume.versions),
        )
        for resume in resume_list
    ]


@router.get("/{id}", summary="根据简历id查询单份简历")
async def get_resume(
    id: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> WorkspaceInfo:
    result = await db.execute(
        select(Resume).where(Resume.id == id).options(selectinload(Resume.versions))
    )
    resume = result.scalar_one_or_none()
    if not result:
        raise HTTPException(status_code=404, detail="数据为空")
    return WorkspaceInfo(
        **resume.to_pydantic().model_dump(), sub_resume_count=len(resume.versions)
    )


@router.post("/create", summary="新建简历")
async def create_resume(
    data: ResumeSchema,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> WorkspaceInfo:
    resume_id = str(uuid.uuid4())

    # 创建新简历
    resume = Resume.from_pydantic(data)
    resume.id = resume_id
    db.add(resume)

    # 为每个创建的新简历创建默认的section
    await create_default_sections(resume_id, db)

    try:
        await db.commit()
        await db.refresh(resume)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="新增失败")

    return WorkspaceInfo(**resume.to_pydantic().model_dump(), sub_resume_count=0)


@router.put("/update", summary="修改简历")
async def update_resume(
    data: ResumeSchema,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> ResumeSchema:
    result = await db.execute(select(Resume).where(Resume.id == data.id))
    resume = result.scalar_one_or_none()
    if not resume:
        raise HTTPException(status_code=404, detail="简历不存在")

    for key, value in data.model_dump(exclude_unset=True).items():
        if key == "theme_config":
            value = json.dumps(value, ensure_ascii=False)
        setattr(resume, key, value)

    try:
        await db.commit()
        await db.refresh(resume)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="修改失败")
    return resume.to_pydantic()


# TODO: 删除简历还需将对应的section和conversation_message_record删除, 已经本地的json文件也要删除
@router.delete("/delete", summary="根据简历id删除简历")
async def delete_resume(
    id: Annotated[str, Query(description="简历ID")],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    await db.execute(delete(Resume).where(Resume.id == id))
    try:
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="删除失败")
    return None
