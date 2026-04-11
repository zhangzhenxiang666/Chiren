from datetime import datetime

from pydantic import Field

from shared.types.strict_model import StrictBaseModel


class SuggestionItem(StrictBaseModel):
    section_id: str = Field(description="区块唯一标识")
    current: str = Field(description="当前的描述")
    suggested: str = Field(description="修改的建议")


class JobDescriptionAnalysisSchema(StrictBaseModel):
    id: str = Field(description="职位描述分析唯一标识")
    resume_id: str = Field(description="职位描述分析所属简历 ID")
    overall_score: int = Field(description="职位描述分析总分(0-100)")
    ats_score: int = Field(description="职位描述分析ATS得分(0-100)")
    summary: str = Field(description="职位描述分析总结")
    keyword_matches: list[str] = Field(description="职位描述分析关键词匹配结果")
    missing_keywords: list[str] = Field(description="职位描述分析缺少的关键词")
    suggestions: list[SuggestionItem] = Field(description="职位描述分析建议")
    created_at: datetime | None = Field(default=None, description="创建时间")
