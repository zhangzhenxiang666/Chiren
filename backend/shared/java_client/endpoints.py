"""Java 后端 API 端点定义（只含相对路径）。"""

from dataclasses import dataclass


@dataclass
class JavaEndpoints:
    """Java 后端 API 端点配置。"""

    task_create: str = "/tasks/create"
    task_update_status: str = "/tasks/{task_id}/status"
    work_create: str = "/api/work/create"
    work_update_status: str = "/api/work/updateStatus"
    work_get: str = "/api/work/{id}"
    resume_create: str = "/api/resume/create"
    resume_section_create: str = "/api/resume/section/create"

    def get_task_update_url(self, task_id: str) -> str:
        """
        获取任务状态更新 URL。

        Args:
            task_id: 任务 ID。

        Returns:
            相对路径。
        """
        return f"/tasks/{task_id}/status"

    def get_work_url(self, work_id: str) -> str:
        """
        获取工作任务查询 URL。

        Args:
            work_id: 工作任务 ID。

        Returns:
            相对路径。
        """
        return f"/api/work/{work_id}"


# 全局端点实例
endpoints = JavaEndpoints()
