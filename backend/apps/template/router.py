from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from shared.database import get_session
from shared.models import Template
from shared.types.template import TemplateSchema

router = APIRouter(prefix="/template", tags=["template"])


@router.get("/list", summary="获取所有简历模板")
async def get_template_list(
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[TemplateSchema]:
    result = await db.execute(select(Template))
    template_list = result.scalars().all()
    return [TemplateSchema.model_validate(item) for item in template_list]


@router.get("/active", summary="获取启用的模板")
async def list_active_templates(
    db: Annotated[AsyncSession, Depends(get_session)],
) -> list[TemplateSchema]:
    result = await db.execute(select(Template).where(Template.is_active == True))
    template_list = result.scalars().all()
    return [TemplateSchema.model_validate(item) for item in template_list]


@router.post("/create", summary="新增简历模板")
async def create_template(
    data: TemplateSchema,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> TemplateSchema:
    d = data.model_dump(exclude={"created_at", "updated_at"})
    db_template = Template(**d)
    db.add(db_template)
    try:
        await db.commit()
        await db.refresh(db_template)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="新增失败")
    return TemplateSchema.model_validate(db_template)


@router.put("/update", summary="修改模板")
async def update_template(
    data: TemplateSchema,
    db: Annotated[AsyncSession, Depends(get_session)],
) -> TemplateSchema:
    result = await db.execute(select(Template).where(Template.id == data.id))
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="没有该模板")
    for key, value in data.model_dump(exclude_unset=True).items():
        setattr(template, key, value)
    try:
        await db.commit()
        await db.refresh(template)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="修改失败")
    return TemplateSchema.model_validate(template)


@router.delete("/delete", summary="根据id删除模板")
async def delete_template(
    id: Annotated[str, Query(description="模板ID")],
    db: Annotated[AsyncSession, Depends(get_session)],
) -> None:
    await db.execute(delete(Template).where(Template.id == id))
    try:
        await db.commit()
    except Exception:
        raise HTTPException(status_code=500, detail="删除失败")
    return None
