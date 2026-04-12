from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sse_starlette.sse import EventSourceResponse

from apps.work.sse import sse_event_generator
from shared.database import get_session
from shared.models import BaseWork
from shared.task_state import tasks
from shared.types.work import WorkSchema

router = APIRouter(prefix="/work", tags=["work"])


@router.get("/list", summary="查询任务列表")
async def get_work_list(
    db: Annotated[AsyncSession, Depends(get_session)],
    task_type: Annotated[str | None, Query(description="任务类型")] = None,
    status: Annotated[str | None, Query(description="任务状态")] = None,
) -> list[WorkSchema]:
    query = select(BaseWork)
    if task_type:
        query = query.where(BaseWork.task_type == task_type)
    if status:
        query = query.where(BaseWork.status == status)
    result = await db.execute(query)
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


@router.delete("/delete/{id}", summary="根据id删除任务")
async def delete_by_id(
    id: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> WorkSchema:
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
    return WorkSchema.model_validate(work)


@router.get("/stream/{task_id}", summary="通过SSE流式获取任务结果")
async def stream_task_result(task_id: str):
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")
    return EventSourceResponse(sse_event_generator(task_id))
