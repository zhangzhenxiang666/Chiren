from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, alias_generators

from shared.types.resume import (
    CertificationItem,
    CustomItem,
    EducationItem,
    GitHubItem,
    LanguageItem,
    PersonalInfo,
    ProjectItem,
    SkillItem,
    Summary,
    WorkExperienceItem,
)


class ResumeAssistantRequest(BaseModel):
    """请求参数"""

    model_config = ConfigDict(
        alias_generator=alias_generators.to_camel,
        populate_by_name=True,
    )

    resume_id: str = Field(description="简历ID")
    type: Literal["openai", "anthropic"] = Field(description="LLM 供应商类型")
    base_url: str = Field(description="AI API 地址")
    api_key: str = Field(description="AI API 密钥")
    model: str = Field(description="模型名称")
    input: str = Field(description="用户输入")


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
