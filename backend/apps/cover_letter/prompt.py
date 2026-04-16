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
    ethnicity=True,
    hometown=True,
    marital_status=True,
    years_of_experience=True,
    wechat=False,
    website=True,
    linkedin=True,
)

JD_ANALYSIS_ITEM_FIELDS = ItemFields(location=False)

JD_ANALYSIS_SECTION_HEADER = SectionHeaderConfig(include_section_id=True)

JD_ANALYSIS_BUILDER = ResumePromptBuilder(
    personal_info_fields=JD_ANALYSIS_PERSONAL_INFO_FIELDS,
    item_fields=JD_ANALYSIS_ITEM_FIELDS,
    section_header=JD_ANALYSIS_SECTION_HEADER,
)

SYSTEM = """\
Role: You are a professional career coach and expert cover letter writer.
Task: Write a persuasive cover letter tailored to a specific job application.
Inputs:
The candidate's Resume.
The Target Job Description (JD).
Goal: Create a highly customized cover letter that aligns the candidate's strengths with the job requirements, 
thereby significantly increasing the likelihood of securing an interview.
Output only the generated cover letter content, without including your own reasoning logic.
Please output the language in Simplified Chinese,
---"""


def build_user_prompt(
    sections, job_description: str, job_title: str | None = None
) -> str:
    return JD_ANALYSIS_BUILDER.build_user_prompt(sections, job_description, job_title)
