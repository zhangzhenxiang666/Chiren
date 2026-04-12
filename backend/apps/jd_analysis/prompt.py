from shared.resume_prompt import (
    ItemFields,
    PersonalInfoFields,
    ResumePromptBuilder,
    SectionHeaderConfig,
)

JD_ANALYSIS_PERSONAL_INFO_FIELDS = PersonalInfoFields(
    full_name=True,
    age=True,
    gender=True,
    email=False,
    phone=False,
    education_level=True,
    job_title=True,
    salary=True,
    location=True,
    political_status=True,
)

JD_ANALYSIS_ITEM_FIELDS = ItemFields(location=False)

JD_ANALYSIS_SECTION_HEADER = SectionHeaderConfig(include_section_id=True)

JD_ANALYSIS_BUILDER = ResumePromptBuilder(
    personal_info_fields=JD_ANALYSIS_PERSONAL_INFO_FIELDS,
    item_fields=JD_ANALYSIS_ITEM_FIELDS,
    section_header=JD_ANALYSIS_SECTION_HEADER,
)

SYSTEM = """\
You are a professional job description analyst. Analyze the match between the provided resume and the job description (JD).

# Core Rules:
- Return ONLY valid JSON content, no additional descriptions or explanations
- Your analysis should be accurate and provide practical suggestions

Below is the JSON schema definition you must follow:
---
{json_schema}
---"""


def build_user_prompt(
    sections, job_description: str, job_title: str | None = None
) -> str:
    return JD_ANALYSIS_BUILDER.build_user_prompt(sections, job_description, job_title)
