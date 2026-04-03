"""解析任务执行服务。"""

import asyncio
import json
import uuid
from datetime import UTC, datetime

from apps.parser.call_llm import executor_llm
from apps.parser.pdf_parser import pdf_parser
from apps.parser.schemas import ParserResult
from apps.parser.state import (
    TaskStatus,
    cleanup_task,
    update_task_error,
    update_task_result,
    update_task_status,
)
from shared.exceptions.base import ParseError
from shared.java_client import java_client
from shared.java_client.endpoints import endpoints


def _now_iso() -> str:
    """返回当前时间的 ISO 格式字符串。"""
    return datetime.now(UTC).isoformat().replace("+00:00", "Z")


def _ensure_id(obj: dict) -> dict:
    """确保对象有 id 字段。"""
    if "id" not in obj or not obj["id"]:
        obj["id"] = str(uuid.uuid4())
    return obj


async def _create_resume_sections(
    resume_id: str, result: ParserResult, title: str
) -> None:
    """创建简历的所有区块。

    Args:
        resume_id: 简历 ID。
        result: LLM 解析结果。
        title: 简历标题（用于生成区块标题）。
    """
    now = _now_iso()

    def build_section(section_type: str, content: dict, sort_order: int) -> dict:
        return {
            "resumeId": resume_id,
            "type": section_type,
            "title": title,
            "sortOrder": sort_order,
            "visible": True,
            "content": json.dumps(content, ensure_ascii=False),
            "createdAt": now,
            "updatedAt": now,
        }

    sections = [
        ("personal_info", result.personal_info.model_dump(), 0),
        ("summary", {"text": result.summary}, 1),
        (
            "education",
            {"items": [_ensure_id(e.model_dump()) for e in result.education]},
            2,
        ),
        (
            "skills",
            {"categories": [_ensure_id(s.model_dump()) for s in result.skills]},
            3,
        ),
        (
            "projects",
            {"items": [_ensure_id(p.model_dump()) for p in result.projects]},
            4,
        ),
        (
            "certifications",
            {"items": [_ensure_id(c.model_dump()) for c in result.certifications]},
            5,
        ),
    ]

    for section_type, content, sort_order in sections:
        await java_client.post(
            endpoints.resume_section_create,
            json=build_section(section_type, content, sort_order),
        )


def infer_parser_type(filename: str, content_type: str | None) -> str:
    """根据文件名和内容类型推断解析器类型。

    Args:
        filename: 上传文件的文件名。
        content_type: 文件的 MIME 类型。

    Returns:
        解析器类型标识符，如 "pdf"。

    Raises:
        ValueError: 不支持的文件类型。
    """
    ext = filename.lower().split(".")[-1] if "." in filename else ""

    if ext == "pdf" or content_type == "application/pdf":
        return "pdf"

    raise ValueError(f"不支持的文件类型: {ext or content_type or '未知'}")


async def _execute_parse_flow(
    task_id: str,
    file_path: str,
    base_url: str,
    api_key: str,
    model: str,
    template: str,
    title: str,
    *,
    delete_file: bool,
) -> None:
    """执行解析流程的公共逻辑。

    编排整个解析流程：PDF 文本提取 -> LLM 解析。

    Args:
        task_id: 任务 ID。
        file_path: PDF 文件绝对路径。
        base_url: AI API 地址。
        api_key: AI API 密钥。
        model: 模型名称。
        template: 模板名称。
        title: 简历标题。
        delete_file: 是否在清理时删除上传文件。
    """
    try:
        await update_task_status(task_id, TaskStatus.RUNNING)
        # 向 Java 后端更新任务状态为 RUNNING
        await java_client.post(
            endpoints.work_update_status,
            params={"id": task_id, "status": TaskStatus.RUNNING.value},
        )

        result = await pdf_parser.parse(file_path)
        result = await executor_llm(api_key, base_url, model, result["text"])

        await update_task_result(task_id, result.model_dump())
        # 向 Java 后端更新任务状态为 SUCCESS
        await java_client.post(
            endpoints.work_update_status,
            params={"id": task_id, "status": TaskStatus.SUCCESS.value},
        )
        # 创建简历
        await java_client.post(
            endpoints.resume_create,
            json={
                "id": task_id,
                "userId": "0",
                "title": title,
                "template": template,
            },
        )
        # 创建简历区块
        await _create_resume_sections(task_id, result, title)

        asyncio.create_task(cleanup_task(task_id, file_path, delete_file=delete_file))

    except ParseError as e:
        await update_task_error(task_id, str(e))
        # 向 Java 后端更新任务状态为 ERROR
        await java_client.post(
            endpoints.work_update_status,
            params={"id": task_id, "status": TaskStatus.ERROR.value},
        )
        asyncio.create_task(cleanup_task(task_id, file_path, delete_file=False))
    except Exception as e:
        await update_task_error(task_id, f"解析失败: {str(e)}")
        # 向 Java 后端更新任务状态为 ERROR
        await java_client.post(
            endpoints.work_update_status,
            params={"id": task_id, "status": TaskStatus.ERROR.value},
        )
        asyncio.create_task(cleanup_task(task_id, file_path, delete_file=False))


async def run_parser_task(
    task_id: str,
    file_path: str,
    base_url: str,
    api_key: str,
    model: str,
    template: str,
    title: str,
) -> None:
    """后台解析任务执行函数。

    编排整个解析流程：PDF 文本提取 -> LLM 解析。

    Args:
        task_id: 任务 ID。
        file_path: PDF 文件绝对路径。
        base_url: AI API 地址。
        api_key: AI API 密钥。
        model: 模型名称。
        template: 模板名称。
        title: 简历标题。
    """
    await _execute_parse_flow(
        task_id, file_path, base_url, api_key, model, template, title, delete_file=True
    )


async def retry_parser_task(
    task_id: str,
    file_path: str,
    base_url: str,
    api_key: str,
    model: str,
    template: str,
    title: str,
) -> None:
    """重试解析任务执行函数。

    读取已提取的文本内容，重新调用 LLM 解析。

    Args:
        task_id: 任务 ID。
        file_path: PDF 文件绝对路径（暂未使用，保留接口兼容性）。
        base_url: AI API 地址。
        api_key: AI API 密钥。
        model: 模型名称。
        template: 模板名称。
        title: 简历标题。
    """
    await _execute_parse_flow(
        task_id, file_path, base_url, api_key, model, template, title, delete_file=True
    )
