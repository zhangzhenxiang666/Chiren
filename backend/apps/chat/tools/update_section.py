from . import ToolDefinition

# 各 section 类型的字段结构和示例
SECTION_CONTENT_SCHEMAS = {
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
        if section_type in SECTION_CONTENT_SCHEMAS:
            schema = SECTION_CONTENT_SCHEMAS[section_type]
            lines.append(f"- {section_type}: {schema['fields']}")
            lines.append(f"  → e.g. {schema['example']}")
    return "\n".join(lines)


def make_update_section_tool(sections: list[dict]) -> ToolDefinition:
    """根据激活的 sections 动态生成 update_section 工具定义"""
    content_structures = build_tool_description(sections)

    description = f"""
Update the content of a specific resume section using a partial update object.

Pass only the fields you want to update. Unmentioned fields remain unchanged.

Section content structures and update examples:
{content_structures}

For all array sections, pass the COMPLETE items/categories array.

Item ID rules:
- Existing items: preserve their id field exactly as-is
- New items: omit the id field entirely — it will be generated automatically
"""

    return ToolDefinition(
        name="update_section",
        description=description.strip(),
        parameters={
            "type": "object",
            "properties": {
                "section_id": {
                    "description": "The ID of the section to update",
                    "type": "string",
                },
                "value": {
                    "description": "Partial update object. For scalar sections (personal_info, summary), include only the fields to change. For array sections, pass the complete items/categories array.",
                    "type": "object",
                },
            },
            "required": ["section_id", "value"],
        },
    )


# 静态默认工具定义（向后兼容）
_tool_description = """
Update the content of a specific resume section using a partial update object.

Pass only the fields you want to update. Unmentioned fields remain unchanged.

Section content structures and update examples:
- personal_info: { full_name, job_title, email, phone, location, salary, age, gender, political_status, education_level, avatar }
  → e.g. { "full_name": "John", "email": "john@example.com" }
- summary: { text }
  → e.g. { "text": "Experienced engineer..." }
- work_experience: { items: [{ id, company, position, location, start_date, end_date, current, description, highlights: string[] }] }
- education:       { items: [{ id, institution, degree, field, location, start_date, end_date, gpa, highlights: string[] }] }
- projects:        { items: [{ id, name, url, description, technologies: string[], highlights: string[], start_date, end_date }] }
- certifications:  { items: [{ id, name, issuer, date }] }
- languages:       { items: [{ id, language, proficiency, description }] }
- github:          { items: [{ id, repo_url, name, stars, language, description }] } — repo_url/name/stars/language are READ-ONLY, only modify description
- custom:          { items: [{ id, title, date, description }] }
- skills:          { categories: [{ id, name, skills: string[] }] }

For all array sections, pass the COMPLETE items/categories array.

Item ID rules:
- Existing items: preserve their id field exactly as-is
- New items: omit the id field entirely — it will be generated automatically
"""

tool_definition = ToolDefinition(
    name="update_section",
    description=_tool_description.strip(),
    parameters={
        "type": "object",
        "properties": {
            "section_id": {
                "description": "The ID of the section to update",
                "type": "string",
            },
            "value": {
                "description": "Partial update object. For scalar sections (personal_info, summary), include only the fields to change. For array sections, pass the complete items/categories array.",
                "type": "object",
            },
        },
        "required": ["section_id", "value"],
    },
)


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

    # 动态生成工具
    tool = make_update_section_tool(sections)
    print("=== 动态生成的工具定义 ===")
    print(f"工具名称: {tool.name}")
    print(f"工具描述:\n{tool.description}")
    print(f"\nOpenAI 格式:\n{tool.openai_tool}")
