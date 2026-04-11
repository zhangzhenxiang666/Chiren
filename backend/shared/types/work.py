"""Work 相关 API 类型。"""

from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field, alias_generators


class WorkSchema(BaseModel):
    """工作任务 API 类型。对应 Java 后端 /api/work/{id} 接口返回的 data 字段。"""

    id: str = Field(default="", description="任务ID")
    file_name: str = Field(default="", description="文件名称")
    src: str = Field(default="", description="文件绝对路径")
    status: str = Field(default="", description="任务状态")
    template: str = Field(default="", description="模板名称")
    title: str = Field(default="", description="简历标题")
    created_at: datetime | None = Field(default=None, description="创建时间")
    updated_at: datetime | None = Field(default=None, description="更新时间")

    model_config = ConfigDict(
        from_attributes=True,
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )
