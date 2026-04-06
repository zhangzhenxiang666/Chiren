from datetime import datetime
from enum import StrEnum
from typing import Any

from pydantic import BaseModel, Field


class ResumeSectionType(StrEnum):
    """简历区块类型枚举"""

    PERSONAL_INFO = "personal_info"
    SUMMARY = "summary"
    WORK_EXPERIENCE = "work_experience"
    PROJECTS = "projects"
    EDUCATION = "education"
    SKILLS = "skills"
    LANGUAGES = "languages"
    CERTIFICATIONS = "certifications"
    QR_CODES = "qr_codes"
    GITHUB = "github"
    CUSTOM = "custom"


class Resume(BaseModel):
    """简历模型"""

    id: str | None = Field(default=None, description="简历唯一标识")
    workspace_id: str | None = Field(
        default=None, description="所属 Workspace ID，为空表示本身就是 Workspace"
    )
    title: str = Field(default="我的简历", description="简历标题")
    template: str = Field(default="two-column", description="模板名称")
    theme_config: dict[str, Any] = Field(default_factory=dict, description="主题配置")
    is_default: bool = Field(default=False, description="是否为用户的默认简历")
    language: str = Field(default="zh", description="简历语言")
    share_token: str | None = Field(
        default=None, description="分享链接 Token，为空表示未开启分享"
    )
    is_public: bool = Field(default=False, description="是否公开简历")
    share_password: str | None = Field(
        default=None, description="分享密码，为空表示无密码"
    )
    view_count: int = Field(default=0, description="公开/分享页面的浏览次数")
    created_at: datetime | None = Field(default=None, description="创建时间")
    updated_at: datetime | None = Field(default=None, description="最后更新时间")


class ResumeSection(BaseModel):
    """简历区块模型"""

    id: str = Field(description="区块唯一标识")
    resume_id: str = Field(description="所属简历 ID")
    type: ResumeSectionType = Field(description="区块类型")
    title: str = Field(description="区块显示标题")
    sort_order: int = Field(default=0, description="排序序号，越小越靠前")
    visible: bool = Field(default=True, description="是否可见")
    content: str = Field(default="{}", description="区块内容，JSON 字符串")
    created_at: datetime = Field(description="创建时间")
    updated_at: datetime = Field(description="更新时间")
