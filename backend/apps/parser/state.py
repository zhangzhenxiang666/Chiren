"""任务状态管理服务。"""

import asyncio
import json
from enum import StrEnum
from pathlib import Path
from typing import Any

# ============ 任务状态存储 ============


class TaskStatus(StrEnum):
    """任务状态枚举。"""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"


tasks: dict[str, dict[str, Any]] = {}
task_events: dict[str, asyncio.Queue] = {}


# ============ 任务操作函数 ============


def create_task(task_id: str) -> dict[str, Any]:
    """创建新任务并初始化其状态。"""
    tasks[task_id] = {
        "task_id": task_id,
        "status": TaskStatus.PENDING,
        "result": None,
        "error": None,
    }
    task_events[task_id] = asyncio.Queue()
    return tasks[task_id]


async def update_task_status(task_id: str, status: TaskStatus) -> None:
    """更新任务状态并通知 SSE 客户端。"""
    if task_id in tasks:
        tasks[task_id]["status"] = status
    if task_id in task_events:
        await task_events[task_id].put({"event": "status", "data": status.value})


async def update_task_result(task_id: str, result: dict) -> None:
    """更新任务结果并通知 SSE 客户端。"""
    if task_id in tasks:
        tasks[task_id]["status"] = TaskStatus.SUCCESS
        tasks[task_id]["result"] = result
    if task_id in task_events:
        await task_events[task_id].put(
            {"event": "result", "data": json.dumps(result, ensure_ascii=False)}
        )


async def update_task_error(task_id: str, error: str) -> None:
    """更新任务错误并通知 SSE 客户端。"""
    if task_id in tasks:
        tasks[task_id]["status"] = TaskStatus.ERROR
        tasks[task_id]["error"] = error
    if task_id in task_events:
        await task_events[task_id].put({"event": "error", "data": error})


async def cleanup_task(
    task_id: str, file_path: str | None = None, delete_file: bool = False
) -> None:
    """延迟清理任务相关资源。

    延迟120秒执行清理，确保SSE事件已发送给客户端。

    Args:
        task_id: 任务ID。
        file_path: 上传文件的绝对路径（可选）。
        delete_file: 是否删除上传文件。
    """
    await asyncio.sleep(120)
    if task_id in tasks:
        del tasks[task_id]
    if task_id in task_events:
        del task_events[task_id]
    if delete_file and file_path:
        Path(file_path).unlink(missing_ok=True)
