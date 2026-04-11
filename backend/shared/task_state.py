"""通用任务状态管理服务。"""

import asyncio
import json
from collections.abc import AsyncIterator, Awaitable, Callable
from typing import Any

from shared.types.task import TaskStatus

tasks: dict[str, dict[str, Any]] = {}
task_events: dict[str, asyncio.Queue] = {}


class TaskEventHub:
    """通用任务事件中心，支持 SSE 流式推送。"""

    def __init__(self) -> None:
        self._tasks = tasks
        self._events = task_events

    def create(
        self, task_id: str, initial_data: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        task_data = {
            "task_id": task_id,
            "status": TaskStatus.PENDING,
            "result": None,
            "error": None,
        }
        if initial_data:
            task_data.update(initial_data)
        self._tasks[task_id] = task_data
        self._events[task_id] = asyncio.Queue()
        return self._tasks[task_id]

    async def emit(self, task_id: str, event: str, data: Any) -> None:
        if task_id in self._tasks:
            if event == "status":
                self._tasks[task_id]["status"] = data
            elif event == "result":
                self._tasks[task_id]["result"] = data
            elif event == "error":
                self._tasks[task_id]["error"] = data
        if task_id in self._events:
            await self._events[task_id].put({"event": event, "data": data})

    async def subscribe(self, task_id: str) -> AsyncIterator[dict[str, Any]]:
        queue = self._events.get(task_id)
        if not queue:
            return
        while True:
            try:
                event = await asyncio.wait_for(queue.get(), timeout=60)
                yield event
                if event["event"] in ("result", "error"):
                    break
            except TimeoutError:
                yield {"event": "heartbeat", "data": ""}
            except asyncio.CancelledError:
                raise

    async def cleanup(
        self,
        task_id: str,
        cleanup_fn: Callable[[], Awaitable[None]] | None = None,
    ) -> None:
        await asyncio.sleep(120)
        if cleanup_fn:
            await cleanup_fn()
        if task_id in self._tasks:
            del self._tasks[task_id]
        if task_id in self._events:
            del self._events[task_id]


hub = TaskEventHub()


def create_task(
    task_id: str, initial_data: dict[str, Any] | None = None
) -> dict[str, Any]:
    return hub.create(task_id, initial_data)


async def update_task_status(task_id: str, status: TaskStatus) -> None:
    await hub.emit(task_id, "status", status.value)


async def update_task_result(task_id: str, result: dict) -> None:
    await hub.emit(task_id, "status", TaskStatus.SUCCESS.value)
    await hub.emit(task_id, "result", json.dumps(result, ensure_ascii=False))


async def update_task_error(task_id: str, error: str) -> None:
    await hub.emit(task_id, "status", TaskStatus.ERROR.value)
    await hub.emit(task_id, "error", error)


async def cleanup_task(
    task_id: str,
    cleanup_fn: Callable[[], Awaitable[None]] | None = None,
) -> None:
    await hub.cleanup(task_id, cleanup_fn)
