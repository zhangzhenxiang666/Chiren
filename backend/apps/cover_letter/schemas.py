from typing import Literal

from pydantic import BaseModel, Field


class CoverLetterRequest(BaseModel):
    resume_id: str = Field(description="简历id")
    jd_description: str = Field(description="岗位详情")
    type: Literal["正式", "亲切", "自信"]
    language: Literal["中文", "English"]
