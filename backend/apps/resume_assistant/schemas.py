from typing import Literal

from pydantic import BaseModel, Field

from shared.types.messages import ConversationMessage
from shared.types.strict_model import StrictBaseModel


class ResumeAssistantRequest(BaseModel):
    """请求参数"""

    resume_id: str = Field(description="简历ID")
    type: Literal["openai", "anthropic"] = Field(description="LLM 供应商类型")
    base_url: str = Field(description="AI API 地址")
    api_key: str = Field(description="AI API 密钥")
    model: str = Field(description="模型名称")
    messages: list[ConversationMessage] = Field(description="消息列表")


class ResumeSection(BaseModel):
    """简历的各个区域的数据库实体"""

    id: str = Field(description="id")
    resume_id: str = Field(description="简历ID")
    type: Literal[
        "personal_info",
        "summary",
        "work_experience",
        "projects",
        "education",
        "skills",
        "languages",
        "certifications",
        "qr_codes",
        "github",
        "custom",
    ] = Field(description="区域类型")
    title: str = Field(description="区域标题")
    content: str = Field(description="内容json字符串")
    sort_order: int = Field(description="排序序号")
    visible: bool = Field(description="是否可见")
    created_at: str = Field(description="创建时间")
    updated_at: str = Field(description="更新时间")


class PersonalInfo(StrictBaseModel):
    """个人信息"""

    full_name: str | None = Field(default=None, description="姓名")
    job_title: str | None = Field(default=None, description="预期岗位")
    phone: str | None = Field(default=None, description="手机号")
    email: str | None = Field(default=None, description="邮箱")
    salary: str | None = Field(default=None, description="期望薪资")
    location: str | None = Field(default=None, description="城市")
    age: str | None = Field(default=None, description="年龄")
    gender: str | None = Field(default=None, description="性别")
    political_status: str | None = Field(default=None, description="政治面貌")
    education_level: str | None = Field(default=None, description="学历")


class Summary(StrictBaseModel):
    """个人简介"""

    text: str | None = Field(default=None, description="简介")


class WorkExperienceItem(StrictBaseModel):
    """工作经历"""

    id: str | None = Field(default=None, description="工作经历ID")
    company: str | None = Field(default=None, description="公司名称")
    position: str | None = Field(default=None, description="职位名称")
    location: str | None = Field(default=None, description="工作地点")
    start_date: str | None = Field(default=None, description="开始时间")
    end_date: str | None = Field(default=None, description="结束时间")
    current: bool | None = Field(default=None, description="是否至今")
    description: str | None = Field(default=None, description="工作描述")
    highlights: list[str] | None = Field(default=None, description="工作 highlights")


class EducationItem(StrictBaseModel):
    """教育经历"""

    id: str | None = Field(default=None, description="教育经历ID")
    institution: str | None = Field(default=None, description="学校名称")
    degree: str | None = Field(default=None, description="学位")
    field: str | None = Field(default=None, description="专业")
    location: str | None = Field(default=None, description="地点")
    start_date: str | None = Field(default=None, description="开始时间")
    end_date: str | None = Field(default=None, description="结束时间")
    gpa: str | None = Field(default=None, description="GPA")
    highlights: list[str] | None = Field(default=None, description="亮点")


class ProjectItem(StrictBaseModel):
    """项目经历"""

    id: str | None = Field(default=None, description="项目ID")
    name: str | None = Field(default=None, description="项目名称")
    url: str | None = Field(default=None, description="项目链接")
    description: str | None = Field(default=None, description="项目描述")
    technologies: list[str] | None = Field(default=None, description="技术栈")
    highlights: list[str] | None = Field(default=None, description="亮点")
    start_date: str | None = Field(default=None, description="开始时间")
    end_date: str | None = Field(default=None, description="结束时间")


class CertificationItem(StrictBaseModel):
    """证书"""

    id: str | None = Field(default=None, description="证书ID")
    name: str | None = Field(default=None, description="证书名称")
    issuer: str | None = Field(default=None, description="颁发机构")
    date: str | None = Field(default=None, description="获得日期")


class LanguageItem(StrictBaseModel):
    """语言能力"""

    id: str | None = Field(default=None, description="语言ID")
    language: str | None = Field(default=None, description="语言")
    proficiency: str | None = Field(default=None, description="熟练程度")
    description: str | None = Field(default=None, description="描述")


class GitHubItem(StrictBaseModel):
    """GitHub 仓库"""

    id: str | None = Field(default=None, description="仓库ID")
    repo_url: str | None = Field(default=None, description="仓库链接")
    name: str | None = Field(default=None, description="仓库名")
    stars: int | None = Field(default=None, description="星标数")
    language: str | None = Field(default=None, description="编程语言")
    description: str | None = Field(default=None, description="仓库描述")


class CustomItem(StrictBaseModel):
    """自定义项"""

    id: str | None = Field(default=None, description="自定义项ID")
    title: str | None = Field(default=None, description="标题")
    date: str | None = Field(default=None, description="日期")
    description: str | None = Field(default=None, description="描述")


class SkillItem(StrictBaseModel):
    """技能项"""

    id: str | None = Field(default=None, description="技能ID")
    name: str | None = Field(default=None, description="技能名称")
    skills: list[str] | None = Field(default=None, description="技能列表")


SECTION_TYPE_TO_MODEL: dict[str, type[BaseModel]] = {
    "personal_info": PersonalInfo,
    "summary": Summary,
    "work_experience": WorkExperienceItem,
    "education": EducationItem,
    "projects": ProjectItem,
    "certifications": CertificationItem,
    "languages": LanguageItem,
    "github": GitHubItem,
    "custom": CustomItem,
    "skills": SkillItem,
}
