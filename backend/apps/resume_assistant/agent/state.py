from dataclasses import dataclass, field

from shared.types.messages import ConversationMessage


@dataclass
class IterationState:
    """IterationState - 循环中变化的状态快照管理

    该类封装了 agent 循环中所有需要维护的状态，包括：
    - 对话历史 messages
    - 简历缓存键 resume_info（用于判断是否需要重建 system/tools_schema）
    - 当前 system prompt
    - 当前工具 schema
    - 当前迭代次数
    - 待持久化的消息
    """

    messages: list[ConversationMessage] = field(default_factory=list)
    resume_info: str = ""
    system: str = ""
    tools_schema: list[dict] = field(default_factory=list)
    count: int = 0
    pending: list[ConversationMessage] = field(default_factory=list)
    _cached_resume_info: str | None = None
