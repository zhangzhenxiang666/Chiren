import secrets

from pydantic import BaseModel, Field, ValidationError

from apps.chat.schemas import (
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
from shared.types.base_tool import BaseTool, ToolExecutionContext, ToolResult

# 各 section 类型的字段结构和示例
_SECTION_CONTENT_SCHEMAS = {
    "personal_info": {
        "fields": "full_name, job_title, email, phone, location, salary, age, gender, political_status, education_level",
        "example": '{ "full_name": "John", "email": "john@example.com" }',
    },
    "summary": {
        "fields": "text",
        "example": '{ "text": "Experienced engineer..." }',
    },
    "work_experience": {
        "fields": "items: [{ id, company, position, location, start_date, end_date, current, description, highlights: string[] }]",
        "example": '{ "items": [{ "company": "Google", "position": "Engineer", "start_date": "2020.01", "end_date": "2023.12", "description": "..." }] }',
    },
    "education": {
        "fields": "items: [{ id, institution, degree, field, location, start_date, end_date, gpa, highlights: string[] }]",
        "example": '{ "items": [{ "institution": "MIT", "degree": "Master", "field": "CS", "start_date": "2018", "end_date": "2020" }] }',
    },
    "projects": {
        "fields": "items: [{ id, name, url, description, technologies: string[], highlights: string[], start_date, end_date }]",
        "example": '{ "items": [{ "name": "AI Project", "description": "...", "technologies": ["Python", "PyTorch"] }] }',
    },
    "certifications": {
        "fields": "items: [{ id, name, issuer, date }]",
        "example": '{ "items": [{ "name": "AWS Solutions Architect", "issuer": "Amazon", "date": "2023.01" }] }',
    },
    "languages": {
        "fields": "items: [{ id, language, proficiency, description }]",
        "example": '{ "items": [{ "language": "English", "proficiency": "CET-6" }] }',
    },
    "github": {
        "fields": "items: [{ id, repo_url, name, stars, language, description }] — repo_url/name/stars/language are READ-ONLY, only modify description",
        "example": '{ "items": [{ "name": "my-repo", "description": "A cool project" }] }',
    },
    "custom": {
        "fields": "items: [{ id, title, date, description }]",
        "example": '{ "items": [{ "title": "Awards", "description": "..." }] }',
    },
    "skills": {
        "fields": "categories: [{ id, name, skills: string[] }]",
        "example": '{ "categories": [{ "name": "Programming", "skills": ["Python", "Java"] }] }',
    },
}


def build_tool_description(sections: list[dict]) -> str:
    """
    根据激活的 sections 构建工具描述中的 'Section content structures' 部分。

    Args:
        sections: 已排序的可见 section 列表，每个元素包含 type 和其他字段的 dict

    Returns:
        动态生成的字段结构说明字符串
    """
    lines = []
    for section in sections:
        section_type = section.get("type")
        if section_type in _SECTION_CONTENT_SCHEMAS:
            schema = _SECTION_CONTENT_SCHEMAS[section_type]
            lines.append(f"- {section_type}: {schema['fields']}")
            lines.append(f"  → e.g. {schema['example']}")
    return "\n".join(lines)


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


def _generate_prefix() -> str:
    return secrets.token_hex(4)


def _generate_id(prefix: str, index: int) -> str:
    return f"{prefix}-{index:04d}"


def _assign_ids(submitted_items: list, existing_items: list) -> list:
    if existing_items:
        last_id = (
            existing_items[-1].get("id", "")
            if isinstance(existing_items[-1], dict)
            else existing_items[-1].get("id", "")
        )
        prefix = last_id.split("-")[0]
        last_index = int(last_id.split("-")[1])
    else:
        prefix = _generate_prefix()
        last_index = 0

    next_index = last_index + 1
    result = []
    for item in submitted_items:
        if isinstance(item, dict):
            if "id" not in item or not item["id"]:
                item["id"] = _generate_id(prefix, next_index)
                next_index += 1
            result.append(item)
        else:
            result.append(item)
    return result


class UpdateSectionToolInput(BaseModel):
    section_id: str = Field(description="The ID of the section to update")
    value: dict = Field(
        description="Partial update object. For scalar sections (personal_info, summary), include only the fields to change. For array sections, pass the complete items/categories array."
    )


class UpdateSectionTool(BaseTool):
    name = "update_section"
    description = (
        "Update the content of a specific resume section using a partial update object.\n\n"
        "Pass only the fields you want to update. Unmentioned fields remain unchanged.\n\n"
        "Section content structures and update examples:\n"
        "{content_structures}\n\n"
        "For all array sections, pass the COMPLETE items/categories array.\n\n"
        "Item ID rules:\n"
        "- Existing items: preserve their id field exactly as-is\n"
        "- New items: omit the id field entirely — it will be generated automatically"
    )
    input_model = UpdateSectionToolInput

    # TODO: 这里更新sections时要同步数据库, 以及更改里面的update_at字段
    async def execute(
        self, arguments: UpdateSectionToolInput, context: ToolExecutionContext
    ) -> ToolResult:
        id_to_type: dict[str, str] = context.metadata.get("id_to_type", {})
        section_type = id_to_type.get(arguments.section_id)

        # 验证section_id
        if section_type is None:
            return ToolResult(
                is_error=True, output=f"Unknown Section ID: {arguments.section_id}"
            )

        model = SECTION_TYPE_TO_MODEL.get(section_type)

        # 验证value
        try:
            if section_type in ("personal_info", "summary"):
                model.model_validate(arguments.value)
            elif section_type in (
                "work_experience",
                "education",
                "projects",
                "certifications",
                "languages",
                "github",
                "custom",
            ):
                for item_data in arguments.value.get("items", []):
                    model.model_validate(item_data)
            elif section_type == "skills":
                for category_data in arguments.value.get("categories", []):
                    model.model_validate(category_data)
        except ValidationError as e:
            errors = []
            for err in e.errors():
                field = ".".join(str(loc) for loc in err["loc"])
                errors.append(f"  - {field}: {err['msg']}")
            error_msg = f"[{section_type}] Validation failed:\n" + "\n".join(errors)

            return ToolResult(
                is_error=True,
                output=error_msg,
            )

        # 所有验证均通过, 执行更新
        for section in context.sections:
            if section["id"] != arguments.section_id:
                continue

            content = section.get("content", {})

            if section_type in ("personal_info", "summary"):
                content.update(arguments.value)
            elif section_type in (
                "work_experience",
                "education",
                "projects",
                "certifications",
                "languages",
                "github",
                "custom",
            ):
                content["items"] = _assign_ids(
                    arguments.value.get("items", []), content.get("items", [])
                )
            elif section_type == "skills":
                content["categories"] = _assign_ids(
                    arguments.value.get("categories", []), content.get("categories", [])
                )
            break

        return ToolResult(
            output=f"Successfully updated section {arguments.section_id}."
        )

    def to_api_schema(self, setions: list[dict[str, any]]):
        return {
            "name": self.name,
            "description": self.description.format(
                content_structures=build_tool_description(setions)
            ),
            "input_schema": self.input_model.model_json_schema(),
        }


if __name__ == "__main__":
    # 示例：模拟已激活的 sections
    sections = [
        {
            "id": "ae6b2c85-a093-415a-8a47-47ac5dba5fee",
            "type": "personal_info",
            "title": "个人信息",
        },
        {
            "id": "5a79c9c4-e8ad-494e-a471-76d3ada55ec1",
            "type": "summary",
            "title": "个人简介",
        },
        {
            "id": "4f4eb8be-7bff-4fbb-bc5e-69217fd87838",
            "type": "work_experience",
            "title": "工作经历",
        },
        {
            "id": "fdd57768-1fa2-4ff0-9bff-8c237b25dded",
            "type": "education",
            "title": "教育背景",
        },
        {
            "id": "e279a487-2825-486c-97cc-2a2d3e9a1fcf",
            "type": "skills",
            "title": "技能特长",
        },
    ]

    import pprint

    tool = UpdateSectionTool()
    print(f"工具名称: {tool.name}")
    print("工具schema:")
    pprint.pp(tool.to_api_schema(sections))
