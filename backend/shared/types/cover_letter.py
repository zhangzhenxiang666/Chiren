"""Cover letter related types."""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, alias_generators


class CoverLetterSchema(BaseModel):
    """求职信 API 类型。"""

    id: int = Field(description="求职信唯一 id")
    resume_id: str = Field(description="对应简历 id")
    content: str = Field(description="求职信内容")
    create_at: datetime = Field(description="创建时间")
    update_at: datetime = Field(description="修改时间")

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
