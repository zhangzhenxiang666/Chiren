"""Parser Pydantic 模型。"""

from pydantic import BaseModel, ConfigDict, Field, model_validator


def _strip_title(schema: dict) -> None:
    """移除 JSON Schema 中的 title 字段。"""

    def strip_obj(obj: dict) -> None:
        obj.pop("title", None)
        if "properties" in obj:
            for prop in obj["properties"].values():
                prop.pop("title", None)
                if prop.get("type") == "array" and "items" in prop:
                    prop["items"].pop("title", None)
        if "$defs" in obj:
            for def_schema in obj["$defs"].values():
                strip_obj(def_schema)

    strip_obj(schema)


class BaseSchema(BaseModel):
    """Schema 基类，自动移除 JSON Schema 中的 title 字段。"""

    model_config = ConfigDict(json_schema_extra=_strip_title)


class TaskIdResponse(BaseSchema):
    """任务 ID 响应模型。"""

    task_id: str


class Work(BaseSchema):
    """工作任务模型。
    对应 Java 后端 /api/work/{id} 接口返回的 data 字段。
    """

    id: str = Field(default="", description="任务ID")
    file_name: str = Field(default="", alias="fileName", description="文件名称")
    src: str = Field(default="", description="文件绝对路径")
    status: str = Field(default="", description="任务状态")
    created_at: str = Field(default="", alias="createdAt", description="创建时间")
    updated_at: str = Field(default="", alias="updatedAt", description="修改时间")


class PersonalInfo(BaseSchema):
    """个人信息模型。"""

    full_name: str = Field(default="", description="Full name")
    job_title: str = Field(default="", description="Job title / target position")
    email: str = Field(default="", description="Email")
    phone: str = Field(default="", description="Phone number")
    location: str = Field(default="", description="City / location")
    salary: str = Field(default="", description="Expected salary")
    age: str = Field(default="", description="Age")
    gender: str = Field(default="", description="Gender")
    political_status: str = Field(default="", description="Political status")
    education_level: str = Field(default="", description="Education level")
    avatar: str = Field(default="", description="Avatar URL")


class EducationItem(BaseSchema):
    """教育背景条目模型。"""

    institution: str = Field(default="", description="School / institution name")
    degree: str = Field(default="", description="Degree")
    field: str = Field(default="", description="Major / field of study")
    location: str = Field(default="", description="Location")
    start_date: str = Field(default="", description="Start date")
    end_date: str = Field(default="", description="End date")
    gpa: str = Field(default="", description="GPA")
    highlights: list[str] = Field(
        default_factory=list, description="Honors / achievements"
    )


class SkillCategory(BaseSchema):
    """技能分类模型。"""

    name: str = Field(default="", description="Category name")
    skills: list[str] = Field(
        default_factory=list, description="Skills in this category"
    )


class ProjectItem(BaseSchema):
    """项目经历条目模型。"""

    name: str = Field(default="", description="Project name")
    description: str = Field(default="", description="Project description")
    technologies: list[str] = Field(default_factory=list, description="Tech stack")
    highlights: list[str] = Field(
        default_factory=list, description="Project highlights"
    )
    url: str = Field(default="", description="Project URL")
    start_date: str = Field(default="", description="Start date")
    end_date: str = Field(default="", description="End date")


class CertificationItem(BaseSchema):
    """资格证书条目模型。"""

    name: str = Field(default="", description="Certificate name")
    issuer: str = Field(default="", description="Issuing organization")
    date: str = Field(default="", description="Date obtained")


class WorkExperienceItem(BaseSchema):
    """工作经历条目模型。"""

    company: str = Field(default="", description="Company / organization name")
    position: str = Field(default="", description="Job title / role")
    location: str = Field(default="", description="Work location")
    start_date: str = Field(default="", description="Start date")
    end_date: str = Field(default="", description="End date")
    current: bool = Field(default=False, description="Is current position")
    description: str = Field(default="", description="Job description")
    highlights: list[str] = Field(
        default_factory=list, description="Achievements / highlights"
    )


class LanguageItem(BaseSchema):
    """语言能力条目模型。"""

    language: str = Field(default="", description="Language name")
    proficiency: str = Field(default="", description="Proficiency level")
    description: str = Field(default="", description="Additional description")


class ParserResult(BaseSchema):
    """解析结果模型。"""

    @model_validator(mode="before")
    @classmethod
    def handle_none(cls, v):
        """接受 None 输入并返回空字典。"""
        if v is None:
            return {}
        return v

    personal_info: PersonalInfo = Field(
        default_factory=PersonalInfo, description="Personal information"
    )
    summary: str = Field(default="", description="Personal summary")
    work_experiences: list[WorkExperienceItem] | None = Field(
        default=None, description="Work experience"
    )
    education: list[EducationItem] | None = Field(default=None, description="Education")
    skills: list[SkillCategory] | None = Field(default=None, description="Skills")
    projects: list[ProjectItem] | None = Field(default=None, description="Projects")
    certifications: list[CertificationItem] | None = Field(
        default=None, description="Certifications"
    )
    languages: list[LanguageItem] | None = Field(default=None, description="Languages")


if __name__ == "__main__":
    # 测试 1：空字典
    print("======== 空字典 ========")
    result = ParserResult.model_validate({})
    print(result.model_dump())

    # 测试 2：None 输入
    print("\n======== None 输入 ========")
    result = ParserResult.model_validate(None)
    print(result.model_dump())

    # 测试 3：列表字段为 None
    print("\n======== 列表字段为 None ========")
    result = ParserResult.model_validate({"education": None, "languages": None})
    print(result.model_dump())

    # 测试 4：完整输入
    print("\n======== 完整输入 ========")
    data = {
        "personal_info": {"full_name": "张三", "email": "zhang@example.com"},
        "summary": "我是开发者",
        "education": [{"institution": "清华大学", "degree": "本科", "field": "计算机"}],
        "skills": [{"name": "编程", "skills": ["Python", "Go"]}],
        "projects": [
            {"name": "项目A", "description": "一个项目", "technologies": ["FastAPI"]}
        ],
        "certifications": [{"name": "AWS认证", "issuer": "亚马逊"}],
        "work_experiences": [
            {
                "company": "某公司",
                "position": "开发工程师",
                "start_date": "2020-01",
                "end_date": "至今",
                "current": True,
                "highlights": ["独立完成模块开发"],
            }
        ],
        "languages": [{"language": "英语", "proficiency": "六级"}],
    }
    result = ParserResult.model_validate(data)
    print(result.model_dump())
