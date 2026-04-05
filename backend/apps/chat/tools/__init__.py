from pydantic import BaseModel, Field


class ToolDefinition(BaseModel):
    """
    A tool definition.
    """

    name: str = Field(description="工具名称")
    description: str = Field(description="工具描述")
    parameters: dict = Field(description="工具参数定义")

    @property
    def openai_tool(self):
        """返回openai格式的工具定义"""
        return {
            "type": "function",
            "function": {
                "name": self.name,
                "description": self.description,
                "parameters": self.parameters,
            },
        }
