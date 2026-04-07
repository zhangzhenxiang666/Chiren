"""对话缓存存储工具。"""

import json
from pathlib import Path

from shared.types.messages import ConversationMessage


class ConversationStore:
    """对话缓存存储工具类。

    操作 .conversation_store 目录下的 JSON 缓存文件。
    """

    def __init__(self, base_dir: str = ".conversation_store"):
        self.base_dir = Path(base_dir)
        self.base_dir.mkdir(parents=True, exist_ok=True)

    def _get_cache_file(self, resume_id: str) -> Path:
        """获取指定 resume_id 对应的缓存文件路径。"""
        return self.base_dir / f"{resume_id}.json"

    def exists(self, resume_id: str) -> bool:
        """检查指定 resume_id 的缓存是否存在。"""
        return self._get_cache_file(resume_id).exists()

    def read(self, resume_id: str) -> list[ConversationMessage]:
        """读取指定 resume_id 的缓存 messages。"""
        cache_file = self._get_cache_file(resume_id)
        if not cache_file.exists():
            return []
        data = json.loads(cache_file.read_text(encoding="utf-8"))
        return [ConversationMessage.model_validate(msg) for msg in data]

    def write(self, resume_id: str, messages: list[ConversationMessage]) -> None:
        """写入 messages 到指定 resume_id 的缓存文件。"""
        cache_file = self._get_cache_file(resume_id)
        data = [msg.model_dump(mode="json") for msg in messages]
        with open(cache_file, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
