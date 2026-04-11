"""SSE 事件生成器。"""

from shared.task_state import hub


async def sse_event_generator(task_id: str):
    """生成 SSE 事件流。

    订阅指定任务的实时解析状态，通过异步生成器yield事件。

    Args:
        task_id: 任务 ID。

    Yields:
        包含事件类型和数据的字典：
            - status: 任务状态变化 (pending/running/success/error)
            - result: 解析完成后的结果数据
            - error: 解析过程中的错误信息
            - heartbeat: 保持连接的心跳（每60秒一次）
    """
    async for event in hub.subscribe(task_id):
        yield event
