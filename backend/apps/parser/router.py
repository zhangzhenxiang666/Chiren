"""Parser 路由定义。"""

import uuid
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, File, Form, HTTPException, UploadFile

from apps.parser.schemas import TaskIdResponse
from apps.parser.service import infer_parser_type, retry_parser_task, run_parser_task
from apps.parser.sse import sse_event_generator
from apps.parser.state import TaskStatus, create_task, tasks
from shared.java_client import java_client
from shared.java_client.endpoints import endpoints

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
