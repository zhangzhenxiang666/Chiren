from typing import Literal

from pydantic import BaseModel, Field


class AiRequest(BaseModel):
    resume_id: str = Field(description="简历id")
    type: Literal["openai", "anthropic"] = Field(description="LLM 供应商类型")
    base_url: str = Field(description="AI API 地址")
    api_key: str = Field(description="AI API 密钥")
    model: str = Field(description="模型名称")
