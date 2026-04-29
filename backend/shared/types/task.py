"""Task 相关类型定义。"""

from enum import StrEnum


class TaskType(StrEnum):
    """任务类型枚举。"""

    PARSE = "parse"
    JD_GENERATE = "jd_generate"
    JD_SCORE = "jd_score"
    INTERVIEW_SUMMARY = "interview_summary"
    COLLECTION_SUMMARY = "collection_summary"


class TaskStatus(StrEnum):
    """任务状态枚举。"""

    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    ERROR = "error"
