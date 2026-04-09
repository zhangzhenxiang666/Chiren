from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_session
from shared.models import BaseWork
from shared.types.work import WorkSchema

router = APIRouter(prefix="/work", tags=["work"])


@router.get("/list", summary="查询全部任务")
async def get_work_list(
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[WorkSchema]:
    result = await db.execute(select(BaseWork))
    work_list = result.scalars().all()
    return [WorkSchema.model_validate(item) for item in work_list]


@router.get("/list-by-status", summary="根据状态查询任务")
async def list_by_status(
    status: Annotated[str, Query(description="任务状态")],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[WorkSchema]:
    result = await db.execute(select(BaseWork).where(BaseWork.status == status))
    work_list = result.scalars().all()
    return [WorkSchema.model_validate(item) for item in work_list]


@router.get("/{id}", summary="按id查询单个任务")
async def get_by_id(
    id: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> WorkSchema:
    result = await db.execute(select(BaseWork).where(BaseWork.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="没有该任务")
    return WorkSchema.model_validate(item)


@router.post("/create", summary="创建任务")
async def create_work(
    work: WorkSchema,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> WorkSchema:
    data = work.model_dump(exclude={"created_at", "updated_at"})
    db_work = BaseWork(**data)
    db.add(db_work)
    try:
        await db.commit()
        await db.refresh(db_work)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="创建失败")
    return WorkSchema.model_validate(db_work)


@router.put("/update-status", summary="更新任务状态", response_model=WorkSchema)
async def update_status(
    id: str,
    status: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> BaseWork:
    result = await db.execute(select(BaseWork).where(BaseWork.id == id))
    work = result.scalar_one_or_none()
    if not work:
        raise HTTPException(status_code=404, detail="没有该任务")
    setattr(work, "status", status)
    try:
        await db.commit()
        await db.refresh(work)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="更新失败")
    return work


@router.delete("/delete/{id}", summary="根据id删除任务", response_model=WorkSchema)
async def delete_by_id(
    id: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> BaseWork:
    result = await db.execute(select(BaseWork).where(BaseWork.id == id))
    work = result.scalar_one_or_none()
    if not work:
        raise HTTPException(status_code=404, detail="没有该任务")
    try:
        await db.delete(work)
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="删除失败")
    return work
