"""面试模块路由"""

import json
from typing import Annotated

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from pydantic import BaseModel, ConfigDict, alias_generators
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from apps.interview.schemas import (
    BUILT_IN_INTERVIEWERS,
    BuiltInInterviewerResponse,
    BuiltInInterviewerType,
    InterviewCollectionCreate,
    InterviewCollectionCreateWithRounds,
    InterviewRoundUpdate,
)
from apps.interview.service import (
    resolve_interviewer_profile,
    update_collection_status_by_rounds,
    validate_round_status_change,
    validate_sub_resume,
)
from shared.database import get_session
from shared.models import InterviewCollection, InterviewRound
from shared.types.interview import InterviewCollectionSchema, InterviewRoundSchema

router = APIRouter(prefix="/interview", tags=["interview"])


class UpdateRoundStatusRequest(BaseModel):
    """更新面试轮次状态请求"""

    model_config = ConfigDict(
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )

    round_id: str
    status: str


@router.get("/built-in-interviewers", summary="获取内置面试官列表")
async def get_built_in_interviewers():
    """返回所有内置面试官资料，按固定顺序排列。

    顺序按一般面试流程排列：HR → 技术 → 场景 → 项目深挖 → 行为 → Leader。
    """
    order = [
        BuiltInInterviewerType.HR,
        BuiltInInterviewerType.TECHNICAL,
        BuiltInInterviewerType.SCENARIO,
        BuiltInInterviewerType.PROJECT,
        BuiltInInterviewerType.BEHAVIORAL,
        BuiltInInterviewerType.LEADER,
    ]
    return [
        BuiltInInterviewerResponse(
            type=interviewer_type.value,
            name=profile.name,
            title=profile.title,
            round_name=profile.round_name,
            bio=profile.bio,
            question_style=profile.question_style,
            assessment_dimensions=profile.assessment_dimensions,
            personality_traits=profile.personality_traits,
            avatar_color=profile.avatar_color,
            avatar_text=profile.avatar_text,
        )
        for interviewer_type in order
        if (profile := BUILT_IN_INTERVIEWERS.get(interviewer_type)) is not None
    ]


@router.post("/collection", summary="创建面试集合")
async def create_collection(
    request: Annotated[InterviewCollectionCreate, Body()],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> InterviewCollectionSchema:
    await validate_sub_resume(request.sub_resume_id, db)
    collection = InterviewCollection(
        name=request.name,
        sub_resume_id=request.sub_resume_id,
    )
    db.add(collection)
    await db.commit()
    await db.refresh(collection)
    return collection.to_pydantic()


@router.post("/collection/with-rounds", summary="创建面试集合（含多个轮次）")
async def create_collection_with_rounds(
    request: Annotated[InterviewCollectionCreateWithRounds, Body()],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> InterviewCollectionSchema:
    await validate_sub_resume(request.sub_resume_id, db)

    collection = InterviewCollection(
        name=request.name,
        sub_resume_id=request.sub_resume_id,
    )
    db.add(collection)
    await db.flush()

    for i, draft in enumerate(request.rounds):
        profile = resolve_interviewer_profile(draft)
        if profile is not None:
            interviewer_name = profile.name
            interviewer_title = profile.title
            interviewer_bio = profile.bio
            question_style = profile.question_style
            assessment_dimensions = profile.assessment_dimensions
            personality_traits = profile.personality_traits
        else:
            interviewer_name = draft.interviewer_name
            interviewer_title = draft.interviewer_title
            interviewer_bio = draft.interviewer_bio
            question_style = draft.question_style
            assessment_dimensions = draft.assessment_dimensions
            personality_traits = draft.personality_traits

        round_obj = InterviewRound(
            interview_collection_id=collection.id,
            name=draft.name,
            interviewer_name=interviewer_name,
            interviewer_title=interviewer_title or "",
            interviewer_bio=interviewer_bio or "",
            question_style=question_style or "",
            assessment_dimensions=json.dumps(
                assessment_dimensions or [], ensure_ascii=False
            ),
            personality_traits=json.dumps(personality_traits or [], ensure_ascii=False),
            sort_order=i,
        )
        db.add(round_obj)

    await db.commit()
    await db.refresh(collection)
    return collection.to_pydantic()


@router.get("/collection/list/{sub_resume_id}", summary="获取子简历的面试集合列表")
async def list_collections(
    sub_resume_id: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[InterviewCollectionSchema]:
    stmt = (
        select(InterviewCollection)
        .where(InterviewCollection.sub_resume_id == sub_resume_id)
        .options(selectinload(InterviewCollection.rounds))
        .order_by(InterviewCollection.created_at.desc())
    )
    result = await db.execute(stmt)
    collections = result.scalars().all()
    return [c.to_pydantic() for c in collections]


@router.get("/collection/{collection_id}", summary="获取面试集合详情")
async def get_collection(
    collection_id: str,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[InterviewRoundSchema]:
    stmt = (
        select(InterviewCollection)
        .where(InterviewCollection.id == collection_id)
        .options(selectinload(InterviewCollection.rounds))
    )
    result = await db.execute(stmt)
    collection = result.scalar_one_or_none()
    if collection is None:
        raise HTTPException(status_code=404, detail="面试集合不存在")
    return [
        r.to_pydantic() for r in sorted(collection.rounds, key=lambda r: r.sort_order)
    ]


@router.delete("/collection/delete", summary="删除面试集合")
async def delete_collection(
    id: Annotated[str, Query()],
    db: Annotated[AsyncSession, Depends(get_session)],
):
    stmt = select(InterviewCollection).where(InterviewCollection.id == id)
    result = await db.execute(stmt)
    collection = result.scalar_one_or_none()
    if collection is None:
        raise HTTPException(status_code=404, detail="面试集合不存在")
    await db.delete(collection)
    await db.commit()
    return None


@router.put("/round/update", summary="更新面试轮次配置")
async def update_round(
    request: Annotated[InterviewRoundUpdate, Body()],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> InterviewRoundSchema:
    stmt = select(InterviewRound).where(InterviewRound.id == request.id)
    result = await db.execute(stmt)
    round_obj = result.scalar_one_or_none()
    if round_obj is None:
        raise HTTPException(status_code=404, detail="面试轮次不存在")

    if request.name is not None:
        round_obj.name = request.name
    if request.interviewer_name is not None:
        round_obj.interviewer_name = request.interviewer_name
    if request.interviewer_title is not None:
        round_obj.interviewer_title = request.interviewer_title
    if request.interviewer_bio is not None:
        round_obj.interviewer_bio = request.interviewer_bio
    if request.question_style is not None:
        round_obj.question_style = request.question_style
    if request.assessment_dimensions is not None:
        round_obj.assessment_dimensions = json.dumps(
            request.assessment_dimensions, ensure_ascii=False
        )
    if request.personality_traits is not None:
        round_obj.personality_traits = json.dumps(
            request.personality_traits, ensure_ascii=False
        )
    if request.sort_order is not None:
        round_obj.sort_order = request.sort_order

    await db.commit()
    await db.refresh(round_obj)
    return round_obj.to_pydantic()


@router.put("/round/status", summary="更新面试轮次状态")
async def update_round_status(
    request: Annotated[UpdateRoundStatusRequest, Body()],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> InterviewRoundSchema:
    # First find the round to get its collection_id
    stmt = select(InterviewRound).where(InterviewRound.id == request.round_id)
    result = await db.execute(stmt)
    round_obj = result.scalar_one_or_none()
    if round_obj is None:
        raise HTTPException(status_code=404, detail="面试轮次不存在")

    # Validate status change with correct collection_id
    await validate_round_status_change(
        collection_id=round_obj.interview_collection_id,
        round_id=request.round_id,
        target_status=request.status,
        db=db,
    )

    # Update status
    round_obj.status = request.status
    await db.flush()

    # Update collection status based on rounds
    await update_collection_status_by_rounds(round_obj.interview_collection_id, db)

    await db.commit()
    await db.refresh(round_obj)
    return round_obj.to_pydantic()


@router.delete("/round/delete", summary="删除面试轮次")
async def delete_round(
    id: Annotated[str, Query()],
    db: Annotated[AsyncSession, Depends(get_session)],
):
    stmt = select(InterviewRound).where(InterviewRound.id == id)
    result = await db.execute(stmt)
    round_obj = result.scalar_one_or_none()
    if round_obj is None:
        raise HTTPException(status_code=404, detail="面试轮次不存在")
    await db.delete(round_obj)
    await db.commit()
    return None
