"""Template 相关 API 类型。"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, alias_generators


class TemplateSchema(BaseModel):
    """简历模板 API 类型。"""

    id: str = Field(default="", description="模板id")
    name: str = Field(default="", description="模板名称")
    display_name: str = Field(default="", description="模板显示名称")
    preview_image_url: str = Field(default="", description="模板图片地址")
    is_active: bool | None = Field(default=False, description="是否启用")
    description: str = Field(default="", description="模板描述")
    created_at: datetime | None = Field(default=None, description="创建时间")
    updated_at: datetime | None = Field(default=None, description="修改时间")

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
