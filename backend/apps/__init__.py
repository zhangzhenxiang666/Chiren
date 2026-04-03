"""AI 能力模块包，按领域划分为 parser 等。"""

from apps.parser import router as parser_router

__all__ = ["parser_router"]
