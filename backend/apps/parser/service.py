"""解析任务执行服务。"""

import asyncio
import json
import secrets
from datetime import datetime, timedelta, timezone

from sqlalchemy import select

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
from shared.api.client import SupportsStreamingMessages
from shared.database import async_session
from shared.exceptions.base import ParseError
from shared.models import BaseWork, Resume, ResumeSection
from shared.types.resume import (
    CertificationsContent,
    EducationContent,
    LanguagesContent,
    PersonalInfo,
    ProjectsContent,
    SkillsContent,
    Summary,
    WorkExperienceContent,
)

SHANGHAI_TZ = timezone(timedelta(hours=8))


def _ensure_id(obj: dict, prefix: str, index: int) -> dict:
    """确保对象有 id 字段。

    Args:
        obj: 待处理的对象字典。
        prefix: 该 section 共用的随机前缀。
        index: 序号（从1开始）。

    Returns:
        添加了 id 字段的对象字典。
    """
    if "id" not in obj or not obj["id"]:
        obj["id"] = f"{prefix}-{index:04d}"
    return obj


async def _create_resume_sections(resume_id: str, result: ParserResult) -> None:
    """创建简历的所有区块。

    按照预定义的固定顺序创建 section，缺失的 section 使用默认空内容填充。

    Args:
        resume_id: 简历 ID。
        result: LLM 解析结果。
    """
    section_configs: list[dict] = [
        {
            "type": "personal_info",
            "title": "个人信息",
            "content_fn": lambda: result.personal_info.model_dump(),
            "default": lambda: PersonalInfo().model_dump(),
        },
        {
            "type": "summary",
            "title": "个人简介",
            "content_fn": lambda: {"text": result.summary},
            "default": lambda: Summary().model_dump(),
        },
        {
            "type": "work_experience",
            "title": "工作经历",
            "content_fn": lambda: {
                "items": [
                    _ensure_id(item.model_dump(), _prefix("work_experience"), idx)
                    for idx, item in enumerate(result.work_experiences, start=1)
                ]
            },
            "default": lambda: WorkExperienceContent().model_dump(),
        },
        {
            "type": "education",
            "title": "教育背景",
            "content_fn": lambda: {
                "items": [
                    _ensure_id(item.model_dump(), _prefix("education"), idx)
                    for idx, item in enumerate(result.education, start=1)
                ]
            },
            "default": lambda: EducationContent().model_dump(),
        },
        {
            "type": "skills",
            "title": "技能特长",
            "content_fn": lambda: {
                "categories": [
                    _ensure_id(item.model_dump(), _prefix("skills"), idx)
                    for idx, item in enumerate(result.skills, start=1)
                ]
            },
            "default": lambda: SkillsContent().model_dump(),
        },
        {
            "type": "projects",
            "title": "项目经历",
            "content_fn": lambda: {
                "items": [
                    _ensure_id(item.model_dump(), _prefix("projects"), idx)
                    for idx, item in enumerate(result.projects, start=1)
                ]
            },
            "default": lambda: ProjectsContent().model_dump(),
        },
        {
            "type": "languages",
            "title": "语言能力",
            "content_fn": lambda: {
                "items": [
                    _ensure_id(item.model_dump(), _prefix("languages"), idx)
                    for idx, item in enumerate(result.languages, start=1)
                ]
            },
            "default": lambda: LanguagesContent().model_dump(),
        },
        {
            "type": "certifications",
            "title": "资格证书",
            "content_fn": lambda: {
                "items": [
                    _ensure_id(item.model_dump(), _prefix("certifications"), idx)
                    for idx, item in enumerate(result.certifications, start=1)
                ]
            },
            "default": lambda: CertificationsContent().model_dump(),
        },
    ]

    def build_section(
        section_type: str, content: dict, sort_order: int
    ) -> ResumeSection:
        return ResumeSection(
            resume_id=resume_id,
            type=section_type,
            title=next(
                cfg["title"] for cfg in section_configs if cfg["type"] == section_type
            ),
            sort_order=sort_order,
            visible=True,
            content=json.dumps(content, ensure_ascii=False),
        )

    _section_prefixes: dict[str, str] = {}

    def _prefix(section_type: str) -> str:
        if section_type not in _section_prefixes:
            _section_prefixes[section_type] = secrets.token_hex(4)
        return _section_prefixes[section_type]

    sections = []
    sort_order = 0

    for config in section_configs:
        section_type = config["type"]
        field_value = getattr(result, _result_field_name(section_type), None)

        content = config["content_fn"]() if field_value else config["default"]()

        sections.append(build_section(section_type, content, sort_order))
        sort_order += 1

    async with async_session() as session:
        session.add_all(sections)
        await session.commit()


def _result_field_name(section_type: str) -> str:
    """将 section type 映射到 ParserResult 中的对应字段名。

    Args:
        section_type: 区块类型标识，如 "work_experience"。

    Returns:
        ParserResult 中对应的字段名，如 "work_experiences"。
    """
    mapping = {
        "personal_info": "personal_info",
        "summary": "summary",
        "work_experience": "work_experiences",
        "education": "education",
        "skills": "skills",
        "projects": "projects",
        "languages": "languages",
        "certifications": "certifications",
    }
    return mapping.get(section_type, section_type)


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


async def _update_work_status(task_id: str, status: TaskStatus) -> None:
    """更新任务状态到数据库。

    Args:
        task_id: 任务 ID。
        status: 新状态。
    """
    async with async_session() as session:
        result = await session.execute(select(BaseWork).where(BaseWork.id == task_id))
        work = result.scalar_one_or_none()
        if work:
            work.status = status.value
            work.updated_at = datetime.now(SHANGHAI_TZ)
            await session.commit()


async def _execute_parse_flow(
    task_id: str,
    file_path: str,
    client: SupportsStreamingMessages,
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
        model: 模型名称。
        template: 模板名称。
        title: 简历标题。
        delete_file: 是否在清理时删除上传文件。
    """
    try:
        await update_task_status(task_id, TaskStatus.RUNNING)
        await _update_work_status(task_id, TaskStatus.RUNNING)

        result = await pdf_parser.parse(file_path)
        result = await executor_llm(client, model, result["text"])

        # 创建简历
        async with async_session() as session:
            resume = Resume(
                id=task_id,
                title=title,
                template=template,
            )
            session.add(resume)
            await session.commit()

        # 创建简历区块
        await _create_resume_sections(task_id, result)

        await update_task_result(task_id, {"resume_id": task_id})
        await _update_work_status(task_id, TaskStatus.SUCCESS)

        await update_task_result(task_id, result.model_dump(), resume_id=task_id)
        await _update_work_status(task_id, TaskStatus.SUCCESS)

        asyncio.create_task(cleanup_task(task_id, file_path, delete_file=delete_file))

    except ParseError as e:
        await update_task_error(task_id, str(e))
        await _update_work_status(task_id, TaskStatus.ERROR)
        asyncio.create_task(cleanup_task(task_id, file_path, delete_file=False))
    except Exception as e:
        await update_task_error(task_id, f"解析失败: {str(e)}")
        await _update_work_status(task_id, TaskStatus.ERROR)
        asyncio.create_task(cleanup_task(task_id, file_path, delete_file=False))


async def run_parser_task(
    task_id: str,
    file_path: str,
    client: SupportsStreamingMessages,
    model: str,
    template: str,
    title: str,
) -> None:
    """后台解析任务执行函数。

    编排整个解析流程：PDF 文本提取 -> LLM 解析。

    Args:
        task_id: 任务 ID。
        file_path: PDF 文件绝对路径。
        client: LLM 客户端。
        model: 模型名称。
        template: 模板名称。
        title: 简历标题。
    """
    await _execute_parse_flow(
        task_id, file_path, client, model, template, title, delete_file=True
    )


async def retry_parser_task(
    task_id: str,
    file_path: str,
    client: SupportsStreamingMessages,
    model: str,
    template: str,
    title: str,
) -> None:
    """重试解析任务执行函数。

    读取已提取的文本内容，重新调用 LLM 解析。

    Args:
        task_id: 任务 ID。
        file_path: PDF 文件绝对路径（暂未使用，保留接口兼容性）。
        client: llm 客户端。
        model: 模型名称。
        template: 模板名称。
        title: 简历标题。
    """
    await _execute_parse_flow(
        task_id, file_path, client, model, template, title, delete_file=True
    )
