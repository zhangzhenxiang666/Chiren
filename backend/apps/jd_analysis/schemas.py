from typing import Literal

from pydantic import Field

from shared.types.strict_model import StrictBaseModel


class MatchRequest(StrictBaseModel):
    resume_id: str = Field(description="简历id")
    type: Literal["openai", "anthropic"] = Field(description="LLM 供应商类型")
    base_url: str = Field(description="AI API 地址")
    api_key: str = Field(description="AI API 密钥")
    model: str = Field(description="模型名称")


class SuggestionItem(StrictBaseModel):
    section_id: str = Field(description="Unique section identifier")
    current: str = Field(description="Current content/section text")
    suggested: str = Field(description="Suggested modification")


class MatchResult(StrictBaseModel):
    summary: str = Field(description="Job description analysis summary")
    overall_score: int = Field(description="Overall match score (0-100)")
    ats_score: int = Field(description="ATS compatibility score (0-100)")
    keyword_matches: list[str] = Field(
        default_factory=list, description="Matched keywords from job description"
    )
    missing_keywords: list[str] = Field(
        default_factory=list,
        description="Keywords from job description not found in resume",
    )
    suggestions: list[SuggestionItem] = Field(
        default_factory=list, description="Improvement suggestions for resume sections"
    )
