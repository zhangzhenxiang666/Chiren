"""Parser 路由定义。"""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, Query, UploadFile, Depends

from apps.parser.schemas import TaskIdResponse,Work,ResumeResult,ResumeSectionResult,TemplateResult
from apps.parser.service import infer_parser_type, retry_parser_task, run_parser_task
from apps.parser.sse import sse_event_generator
from apps.parser.state import TaskStatus, create_task, tasks
from shared.java_client import java_client
from shared.java_client.endpoints import endpoints
from shared.database import get_session
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select,insert,delete
from shared.models import BaseWork,Resume,ResumeSection,template

router = APIRouter(prefix="/parser", tags=["parser"])


@router.post(
    "",
    summary="上传文档并启动解析任务",
    responses={
        400: {"description": "不支持的文件类型或文件超过10MB"},
    },
)
async def parse_document(
    background_tasks: BackgroundTasks,
    file: Annotated[UploadFile, File(description="要解析的文件，最大 10MB")],
    type: Annotated[str, Form(description="LLM 供应商类型", examples=["openai"])],
    base_url: Annotated[
        str, Form(description="AI API 地址", examples=["http://127.0.0.1:5564/openai"])
    ],
    api_key: Annotated[str, Form(description="AI API 密钥", examples=["sk-xxx"])],
    model: Annotated[str, Form(description="模型名称", examples=["gpt-4o"])],
    template: Annotated[str, Form(description="模板名称", examples=["default"])],
    title: Annotated[
        str, Form(description="简历标题", examples=["未命名简历"])
    ] = "未命名简历",
) -> TaskIdResponse:
    """上传文档并启动异步解析任务。

    支持 PDF 格式文件上传，文件经后台解析后通过 SSE 接口获取结果。

    Args:
        background_tasks: FastAPI 后台任务管理器，用于异步执行解析。
        file: 要解析的文件，支持 PDF 格式，最大 10MB。
        type: LLM 供应商类型，如 "openai"。
        base_url: AI API 地址。
        api_key: AI API 密钥。
        model: 模型名称，如 "gpt-4o"。
        template: 模板名称，如 "default"。
        title: 简历标题，默认为"未命名简历"。

    Returns:
        TaskIdResponse: 包含任务 ID 的响应，用于后续查询解析结果。

    Raises:
        HTTPException: 400 - 不支持的文件类型或文件超过 10MB。
    """
    try:
        infer_parser_type(file.filename, file.content_type)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    task_id = str(uuid.uuid4())
    create_task(task_id)

    from apps.parser.storage import save_upload_file

    file_path, original_name = await save_upload_file(file, task_id)

    # 向 Java 后端创建工作任务
    await java_client.post(
        endpoints.work_create,
        json={
            "id": task_id,
            "fileName": original_name,
            "src": file_path,
            "status": TaskStatus.PENDING.value,
            "template": template,
            "title": title,
        },
    )

    background_tasks.add_task(
        run_parser_task, task_id, file_path, base_url, api_key, model, template, title
    )

    return TaskIdResponse(task_id=task_id)


@router.get(
    "/stream/{task_id}",
    summary="通过SSE流式获取解析任务结果",
    responses={
        404: {"description": "任务不存在"},
    },
)
async def stream_parser_result(task_id: str):
    """通过 SSE 流式获取解析任务结果。

    订阅指定任务的实时解析状态，包括进度、结果或错误信息。

    Args:
        task_id: 任务 ID，从解析接口获取。

    Returns:
        EventSourceResponse: SSE 事件流，包含以下事件类型：
            - status: 任务状态变化 (pending/running/success/error)
            - result: 解析完成后的结果数据
            - error: 解析过程中的错误信息
            - heartbeat: 保持连接的心跳

    Raises:
        HTTPException: 404 - 任务不存在。
    """
    if task_id not in tasks:
        raise HTTPException(status_code=404, detail="任务不存在")

    from sse_starlette.sse import EventSourceResponse

    return EventSourceResponse(sse_event_generator(task_id))


@router.post(
    "/retry/{task_id}",
    summary="重试失败的任务",
    responses={
        404: {"description": "任务不存在"},
        400: {"description": "任务状态不是错误，无法重试"},
    },
)
async def retry_failed_task(
    background_tasks: BackgroundTasks,
    task_id: str,
    type: Annotated[str, Form(description="LLM 供应商类型", examples=["openai"])],
    base_url: Annotated[
        str, Form(description="AI API 地址", examples=["http://127.0.0.1:5564/openai"])
    ],
    api_key: Annotated[str, Form(description="AI API 密钥", examples=["sk-xxx"])],
    model: Annotated[str, Form(description="模型名称", examples=["gpt-4o"])],
) -> TaskIdResponse:
    """重试失败的任务。

    从 Java 后端获取失败任务的信息，校验状态后重新执行解析。

    Args:
        background_tasks: FastAPI 后台任务管理器。
        task_id: 任务 ID。
        type: LLM 供应商类型。
        base_url: AI API 地址。
        api_key: AI API 密钥。
        model: 模型名称。

    Returns:
        TaskIdResponse: 包含任务 ID 的响应。

    Raises:
        HTTPException: 404 - 任务不存在。
        HTTPException: 400 - 任务状态不是 ERROR。
    """
    # 幂等检查：任务已在本地缓存中，直接返回
    if task_id in tasks:
        return TaskIdResponse(task_id=task_id)

    # 从 Java 后端获取任务信息
    java_response = await java_client.get(endpoints.get_work_url(task_id))

    data = java_response.get("data")
    if not data:
        raise HTTPException(status_code=404, detail="任务不存在")

    work_status = data.get("status")
    if work_status != TaskStatus.ERROR.value:
        raise HTTPException(status_code=400, detail="只有错误状态的任务才能重试")

    file_path = data.get("src", "")
    template = data.get("template", "default")
    title = data.get("title", "未命名简历")

    # 创建本地任务记录
    create_task(task_id)

    background_tasks.add_task(
        retry_parser_task,
        task_id,
        file_path,
        base_url,
        api_key,
        model,
        template,
        title,
    )

    return TaskIdResponse(task_id=task_id)



##   任务相关接口

@router.get(
        "/work/list",
        summary="查询全部任务")
async def get_work_list(db: AsyncSession = Depends(get_session)) -> list[Work]:
    works = await db.execute(select(BaseWork))
    result = works.scalars().all()
    return [
        Work.model_validate(w, from_attributes=True)
        for w in result
    ]


@router.get(
    "/listByStatus",
    summary="根据状态查询任务",
    response_model=list[Work])
async def listByStatus(
    status: str = Query(description="任务状态"),
    db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(BaseWork).where(BaseWork.status == status))
    return result.scalars().all()

@router.get(
    "/{id}",
    summary="按id查询单个任务",
    response_model=Work
)
async def getById(id: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(BaseWork).where(BaseWork.id == id))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="没有该任务")
    return item

@router.post(
    "/create",
    summary="创建任务",
    response_model=Work
)
async def create(work: Work, db: AsyncSession = Depends(get_session)):
    data = work.model_dump(exclude={"created_at", "updated_at"})
    db_work = BaseWork(**data)
    db.add(db_work)
    try:
        await db.commit()
        await db.refresh(db_work)
    except Exception as ex:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Database error: {str(ex)}")
    return db_work
    
@router.put(
    "/updateStatus",
    summary="更新任务状态",
    response_model=Work
)
async def updateStatus(
    id: str,
    status: str,
    db: AsyncSession = Depends(get_session),
):
    get = await db.execute(select(BaseWork).where(BaseWork.id == id))
    item = get.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="没有该任务")

    setattr(item, "status", status)
    await db.commit()
    await db.refresh(item)
    return item

@router.delete(
    "/delete/{id}",
    summary="根据id删除任务",
    response_model=Work
)
async def deleteById(id: str, db: AsyncSession = Depends(get_session)):
    get = await db.execute(select(BaseWork).where(BaseWork.id == id))
    item = get.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="没有该任务")
    try:
        await db.delete(item)
        await db.commit()
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="删除失败")
    return item



# 生成简历相关接口

@router.get(
    "/resume/list",
    summary="根据用户id查询该用户所有简历",
    response_model=list[ResumeResult]
)
async def listResume(db: AsyncSession = Depends(get_session)):
    get = await db.execute(select(Resume))
    result_list = get.scalars().all()
    if result_list is None:
        raise HTTPException(status_code=400, detail="数据为空")
    return result_list


@router.get(
    "/resume/{id}",
    summary="根据简历id查询单份简历",
    response_model=ResumeResult
)
async def getResume(id: int,db: AsyncSession = Depends(get_session)):
    one = await db.execute(select(Resume).where(Resume.id == id))
    result = one.scalar_one_or_none()
    if not result:
        raise HTTPException(status_code=404, detail="数据为空")
    return result


@router.post(
    "/resume/create",
    summary="新建简历",
    response_model=ResumeResult
)
async def createResume(data: ResumeResult, db: AsyncSession = Depends(get_session)):
    d = data.model_dump(exclude={"created_at", "updated_at"})
    resume = Resume(**d)
    db.add(resume)
    try:
        await db.commit()
        await db.refresh(resume)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="新增失败")
    return resume


@router.put(
    "/resume/update",
    summary="修改简历",
    response_model=ResumeResult
)
async def updateResume(data: ResumeResult,db: AsyncSession = Depends(get_session)):
    get = await db.execute(select(Resume).where(Resume.id == data.id))
    result = get.scalar_one_or_none()
    one = data.model_dump()
    for key,value in one.items():
        setattr(result,key,value)
    try:
        await db.commit()
        await db.refresh(result)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="修改失败")
    return result
    

@router.delete(
    "/resume/delete",
    summary="根据简历id删除简历",
)
async def deleteResume(id: int = Query(description="简历ID"), db: AsyncSession = Depends(get_session)):
    await db.execute(delete(Resume).where(Resume.id == id))
    await db.commit()
    return None


##   区块相关接口

@router.get(
    "/resumeSetion/one",
    summary="获取指定简历的指定区块信息",
    response_model=ResumeSectionResult
)
async def get_by_id_and_type(id: str, type: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(ResumeSection).where(ResumeSection.resume_id == id, ResumeSection.type == type))
    item = result.scalar_one_or_none()
    if not item:
        raise HTTPException(status_code=404, detail="数据不存在")
    return item


@router.get(
    "/resumeSetion/list/{id}",
    summary="根据简历id获取区块列表",
    response_model=list[ResumeSectionResult]
)
async def get_by_resumeid(id: str, db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(ResumeSection).where(ResumeSection.resume_id == id))
    return result.scalars().all()


@router.post(
    "/resumeSetion/create",
    summary="添加区块",
    response_model=ResumeSectionResult
)
async def create_section(data: ResumeSectionResult, db: AsyncSession = Depends(get_session)):
    d = data.model_dump(exclude={"created_at", "updated_at"})
    section = ResumeSection(**d)
    db.add(section)
    try:
        await db.commit()
        await db.refresh(section)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="新增失败")
    return section


@router.put(
    "/resumeSetion/update",
    summary="修改区块",
    response_model=ResumeSectionResult
)
async def update_section(data: ResumeSectionResult, db: AsyncSession = Depends(get_session)):
    old = await db.execute(select(ResumeSection).where(ResumeSection.id == data.id))
    old_item = old.scalar_one_or_none()
    if not old_item:
        raise HTTPException(status_code=404, detail="没有该区块")
    d = data.model_dump(exclude={"created_at", "updated_at"})
    for key, value in d.items():
        setattr(old_item, key, value)
    try:
        await db.commit()
        await db.refresh(old_item)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="修改失败")
    return old_item


@router.delete(
    "/resumeSetion/delete",
    summary="删除指定区块",
)
async def delete_section(id: str = Query(description="区块ID"), db: AsyncSession = Depends(get_session)):
    await db.execute(delete(ResumeSection).where(ResumeSection.id == id))
    try:
        await db.commit()
    except Exception:
        raise HTTPException(status_code=500, detail="删除失败")
    return None

@router.delete(
    "/setion/delete/all",
    summary="清楚指定简历所有区块",
)
async def delete_all(id: str,db: AsyncSession = Depends(get_session)):
    await db.execute(delete(ResumeSection).where(ResumeSection.resume_id == id))
    try :
        await db.commit()
    except Exception:
        raise HTTPException(status_code=500, detail="删除失败")
    
    return None



#     模板相关接口

@router.get(
    "/template/list",
    summary="获取所有简历模板",
    response_model=list[TemplateResult]
)
async def get_template_list(db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(template))
    return result.scalars().all()


@router.get(
    "/template/active",
    summary="获取启用的模板",
    response_model=list[TemplateResult]
)
async def list_active_templates(db: AsyncSession = Depends(get_session)):
    result = await db.execute(select(template).where(template.is_active == True))
    return result.scalars().all()


@router.post(
    "/template/create",
    summary="新增简历模板",
    response_model=TemplateResult
)
async def create_template(data: TemplateResult, db: AsyncSession = Depends(get_session)):
    d = data.model_dump(exclude={"created_at", "updated_at"})
    db_template = template(**d)
    db.add(db_template)
    try:
        await db.commit()
        await db.refresh(db_template)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="新增失败")
    return db_template


@router.put(
    "/template/update",
    summary="修改模板",
    response_model=TemplateResult
)
async def update_template(data: TemplateResult, db: AsyncSession = Depends(get_session)):
    old = await db.execute(select(template).where(template.id == data.id))
    old_data = old.scalar_one_or_none()
    if not old_data:
        raise HTTPException(status_code=404, detail="没有该模板")
    d = data.model_dump(exclude={"created_at", "updated_at"})
    for key, value in d.items():
        setattr(old_data, key, value)
    try:
        await db.commit()
        await db.refresh(old_data)
    except Exception:
        await db.rollback()
        raise HTTPException(status_code=500, detail="修改失败")
    return old_data


@router.delete(
    "/template/delete",
    summary="根据id删除模板"
)
async def delete_template(id: str = Query(description="模板ID"), db: AsyncSession = Depends(get_session)):
    await db.execute(delete(template).where(template.id == id))
    try:
        await db.commit()
    except Exception:
        raise HTTPException(status_code=500, detail="删除失败")