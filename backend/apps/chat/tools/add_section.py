import uuid
from typing import Any

from pydantic import BaseModel, Field

from shared.types.base_tool import BaseTool, ToolExecutionContext, ToolResult

_ALL_TYPES = [
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
]


class AddSectionToolInput(BaseModel):
    type: str = Field(description="The type of section to add.")
    title: str = Field(description="The display title for the section.")


class AddSectionTool(BaseTool):
    name = "add_section"
    description = "Add a new section to the resume. Use this when the user wants to add a new section type. Available types: {type_examples}"
    input_model = AddSectionToolInput

    # TODO: 这里更新sections时要同步数据库, 以及更改里面的update_at字段
    async def execute(
        self, arguments: AddSectionToolInput, context: ToolExecutionContext
    ) -> ToolResult:

        # 验证type的合法性
        existing_types = {s.get("type") for s in context.sections}
        if arguments.type in existing_types and arguments.type != "custom":
            error_msg = f"Section of type '{arguments.type}' already exists"
            return ToolResult(
                is_error=True,
                output=error_msg,
            )

        # TODO: 创建新的section需要请求数据库, 现在先手动实现一个
        section = {
            "id": str(uuid.uuid4()),
            "resume_id": context.sections[0]["resume_id"],
            "type": arguments.type,
            "title": arguments.title,
            "content": {},
        }

        if arguments.type in (
            "work_experience",
            "education",
            "projects",
            "certifications",
            "languages",
            "github",
            "custom",
        ):
            section["content"]["items"] = []
        elif arguments.type == "skills":
            section["content"]["categories"] = []

        context.sections.append(section)
        context.metadata["id_to_type"][section["id"]] = arguments.type

        return ToolResult(output=f"Successfully added section {section['id']}.")

    def to_api_schema(self, sections: list[dict[str, Any]]):
        existing_types = {s.get("type") for s in sections if s.get("type")}
        # 可添加的类型：排除已存在的，custom 必然出现
        available_types = [t for t in _ALL_TYPES if t not in existing_types]
        if "custom" not in available_types:
            available_types.append("custom")
        type_examples = '", "'.join(available_types)

        return {
            "name": self.name,
            "description": self.description.format(type_examples=type_examples),
            "input_schema": self.input_model.model_json_schema(),
        }
