"""统一异常定义。"""


class AppException(Exception):
    """应用层基础异常。"""

    def __init__(self, message: str, code: str | None = None):
        self.message = message
        self.code = code or "APP_ERROR"
        super().__init__(self.message)


class JavaClientError(AppException):
    """Java 后端通信异常。"""

    def __init__(self, message: str, status_code: int | None = None):
        self.status_code = status_code
        super().__init__(message, code="JAVA_CLIENT_ERROR")


class ParseError(AppException):
    """文档解析异常。"""

    def __init__(self, message: str):
        super().__init__(message, code="PARSE_ERROR")


class LLMError(AppException):
    """LLM 调用异常。"""

    def __init__(self, message: str):
        super().__init__(message, code="LLM_ERROR")


class ValidationError(AppException):
    """数据校验异常。"""

    def __init__(self, message: str):
        super().__init__(message, code="VALIDATION_ERROR")
