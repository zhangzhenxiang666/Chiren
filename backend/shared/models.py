from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from typing import TypeVar

# 上海时区 (UTC+8)
SHANGHAI_TZ = timezone(timedelta(hours=8))
utc_now = lambda: datetime.now(SHANGHAI_TZ)

from pydantic import BaseModel
from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship

from shared.types.messages import ConversationMessageSchema
from shared.types.resume import ResumeSchema, ResumeSectionSchema, section_adapter

S = TypeVar("S", bound=BaseModel)


class PydanticMixin[S: BaseModel]:
    def to_pydantic(self) -> S:
        raise NotImplementedError

    @classmethod
    def from_pydantic(cls, schema: S) -> PydanticMixin[S]:
        raise NotImplementedError


class Base(DeclarativeBase):
    __abstract__ = True


class Resume(PydanticMixin, Base):
    """简历数据库模型"""

    __tablename__ = "resumes"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        comment="简历唯一标识，主键",
    )
    workspace_id: Mapped[str | None] = mapped_column(
        String(36),
        ForeignKey("resumes.id"),
        nullable=True,
        index=True,
        comment="所属 Workspace（顶级简历）的 ID，为空表示本身就是 Workspace",
    )
    title: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        default="我的简历",
        comment="简历标题",
    )
    template: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        default="two-column",
        comment="模板名称，外键关联 templates.name，唯一标识一个模板",
    )
    theme_config: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="{}",
        comment="主题配置，JSON 字符串",
    )
    is_default: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="是否为用户的默认简历",
    )
    language: Mapped[str] = mapped_column(
        String(10),
        nullable=False,
        default="zh",
        comment="简历语言",
    )
    share_token: Mapped[str | None] = mapped_column(
        String(64),
        nullable=True,
        unique=True,
        comment="分享链接 Token，为空表示未开启分享",
    )
    is_public: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=False,
        comment="是否公开简历",
    )
    share_password: Mapped[str | None] = mapped_column(
        String(128),
        nullable=True,
        comment="分享密码（可选），为空表示无密码",
    )
    view_count: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="公开/分享页面的浏览次数",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        comment="创建时间",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
        comment="最后更新时间",
    )

    workspace = relationship("Resume", remote_side=[id], back_populates="versions")
    versions = relationship(
        "Resume", back_populates="workspace", foreign_keys=[workspace_id]
    )
    sections = relationship(
        "ResumeSection", back_populates="resume", cascade="all, delete-orphan"
    )

    def to_pydantic(self) -> ResumeSchema:
        return ResumeSchema(
            id=self.id,
            workspace_id=self.workspace_id,
            title=self.title,
            template=self.template,
            theme_config=json.loads(self.theme_config),
            is_default=self.is_default,
            language=self.language,
            share_token=self.share_token,
            is_public=self.is_public,
            share_password=self.share_password,
            view_count=self.view_count,
            created_at=self.created_at,
            updated_at=self.updated_at,
        )

    @classmethod
    def from_pydantic(cls, schema: ResumeSchema) -> Resume:
        return cls(
            id=schema.id,
            workspace_id=schema.workspace_id,
            title=schema.title,
            template=schema.template,
            theme_config=json.dumps(schema.theme_config, ensure_ascii=False),
            is_default=schema.is_default,
            language=schema.language,
            share_token=schema.share_token,
            is_public=schema.is_public,
            share_password=schema.share_password,
            view_count=schema.view_count,
            created_at=schema.created_at,
            updated_at=schema.updated_at,
        )


class ResumeSection(PydanticMixin, Base):
    """简历区块数据库模型"""

    __tablename__ = "resume_sections"

    id: Mapped[str] = mapped_column(
        String(36),
        primary_key=True,
        default=lambda: str(uuid.uuid4()),
        comment="区块唯一标识",
    )
    resume_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("resumes.id"),
        nullable=False,
        index=True,
        comment="所属简历ID",
    )
    type: Mapped[str] = mapped_column(
        String(50),
        nullable=False,
        comment="区块类型，如 personal_info、work_experience 等",
    )
    title: Mapped[str] = mapped_column(
        String(100),
        nullable=False,
        comment="区块显示标题",
    )
    sort_order: Mapped[int] = mapped_column(
        Integer,
        nullable=False,
        default=0,
        comment="排序序号，越小越靠前",
    )
    visible: Mapped[bool] = mapped_column(
        Boolean,
        nullable=False,
        default=True,
        comment="是否可见",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="{}",
        comment="区块内容，JSON 字符串",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        comment="创建时间",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
        comment="更新时间",
    )

    resume = relationship("Resume", back_populates="sections")

    def to_pydantic(self) -> ResumeSectionSchema:
        data = dict(
            id=self.id,
            resume_id=self.resume_id,
            title=self.title,
            type=self.type,
            sort_order=self.sort_order,
            visible=self.visible,
            content=json.loads(self.content),
            created_at=self.created_at,
            updated_at=self.updated_at,
        )
        return section_adapter.validate_python(data)

    @classmethod
    def from_pydantic(cls, schema: ResumeSectionSchema) -> ResumeSection:
        if schema.content is not None:
            content = json.dumps(schema.content, ensure_ascii=False)
        elif schema.type in {"personal_info", "summary"}:
            content = "{}"
        elif schema.type == "skills":
            content = '{"categories": []}'
        else:
            content = '{"items": []}'
        # 为 None 时使用当前时间，让 ORM 的 default/onupdate 生效
        created = schema.created_at or utc_now()
        updated = schema.updated_at or utc_now()
        return cls(
            id=schema.id,
            resume_id=schema.resume_id,
            title=schema.title,
            type=schema.type,
            sort_order=schema.sort_order,
            visible=schema.visible,
            content=content,
            created_at=created,
            updated_at=updated,
        )


class BaseWork(Base):
    """任务流数据库模型"""

    __tablename__ = "work"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, comment="工作流唯一id"
    )

    file_name: Mapped[str] = mapped_column(
        String(100), nullable=False, comment="文件名称"
    )

    src: Mapped[str] = mapped_column(
        String(255), nullable=False, comment="文件绝对路径"
    )

    status: Mapped[str] = mapped_column(
        String(20), nullable=True, default="start", comment="当前状态"
    )

    template: Mapped[str] = mapped_column(
        String(50), nullable=False, comment="模板名称"
    )

    title: Mapped[str] = mapped_column(String(100), nullable=True, comment="简历标题")

    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        comment="创建时间",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
        comment="更新时间",
    )


class ConversationMessageRecord(PydanticMixin, Base):
    """会话消息数据库模型"""

    __tablename__ = "conversation_messages"

    id: Mapped[int] = mapped_column(
        Integer,
        primary_key=True,
        autoincrement=True,
        comment="消息唯一标识",
    )
    conversation_id: Mapped[str] = mapped_column(
        String(36),
        nullable=False,
        index=True,
        comment="所属会话 ID",
    )
    role: Mapped[str] = mapped_column(
        String(20),
        nullable=False,
        comment="消息角色，user 或 assistant",
    )
    content: Mapped[str] = mapped_column(
        Text,
        nullable=False,
        default="[]",
        comment="消息内容，JSON 字符串",
    )
    reasoning: Mapped[str | None] = mapped_column(
        Text,
        nullable=True,
        default=None,
        comment="AI 思考过程（可选）",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        comment="创建时间",
    )

    def to_pydantic(self) -> ConversationMessageSchema:
        """转换为 Pydantic DTO"""
        return ConversationMessageSchema.model_validate(
            {
                "id": self.id,
                "conversation_id": self.conversation_id,
                "role": self.role,
                "content": json.loads(self.content) if self.content else [],
                "reasoning": self.reasoning,
                "created_at": self.created_at,
            }
        )

    @classmethod
    def from_pydantic(
        cls, schema: ConversationMessageSchema
    ) -> ConversationMessageRecord:
        """从 Pydantic DTO 创建数据库模型"""
        return cls(
            id=schema.id,
            conversation_id=schema.conversation_id,
            role=schema.role,
            content=json.dumps(schema.content, ensure_ascii=False),
            reasoning=schema.reasoning,
            created_at=schema.created_at,
        )


class Template(Base):
    """模板类数据库模型"""

    __tablename__ = "template"

    id: Mapped[str] = mapped_column(
        String(100), nullable=False, primary_key=True, comment="模板id"
    )
    name: Mapped[str] = mapped_column(
        String(100),
        default="该用户很懒，什么也没有留下",
        nullable=False,
        comment="模板名称",
    )
    display_name: Mapped[str] = mapped_column(
        String(100),
        default="该用户很懒，什么也没有留下",
        nullable=False,
        comment="模板显示名称",
    )
    preview_image_url: Mapped[str] = mapped_column(
        String(100),
        default="该用户很懒，什么也没有留下",
        nullable=False,
        comment="模板图片地址",
    )
    is_active: Mapped[bool] = mapped_column(
        default=False, nullable=True, comment="模板是否启用"
    )
    description: Mapped[str] = mapped_column(
        String(100),
        default="该用户很懒，什么也没有留下",
        nullable=True,
        comment="模板id",
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
        comment="创建时间",
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=utc_now,
        onupdate=utc_now,
        comment="修改时间",
    )
