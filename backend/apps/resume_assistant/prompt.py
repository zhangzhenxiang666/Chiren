from typing import Any

from shared.models import utc_now
from shared.types.jd_analysis import (
    JobDescriptionAnalysisSchema,
    SuggestionItem,
)


def build_sections_prompt(sections: list[dict]) -> str:
    lines = []
    for section in sections:
        lines.append(
            f'  - [{section["type"]}] "{section["title"]}" (section_id: {section["id"]})'
        )
    return "\n".join(lines)


def build_jd_prompt(
    jd_analysis: JobDescriptionAnalysisSchema,
    sections: list[dict[str, Any]],
) -> str:
    now = utc_now().isoformat()
    jd_analysis_time = (
        jd_analysis.created_at.isoformat() if jd_analysis.created_at else "N/A"
    )

    section_id_to_type = {s["id"]: s["type"] for s in sections}

    suggestions_by_section: dict[str, list[SuggestionItem]] = {}
    for sug in jd_analysis.suggestions:
        sec_type = section_id_to_type.get(sug.section_id, sug.section_id)
        if sec_type not in suggestions_by_section:
            suggestions_by_section[sec_type] = []
        suggestions_by_section[sec_type].append(sug)

    suggestions_lines = []
    for sec_type, items in suggestions_by_section.items():
        suggestions_lines.append(f"### [{sec_type}]")
        for item in items:
            suggestions_lines.append(f"- **Current**: {item.current}")
            suggestions_lines.append(f"  **Suggested**: {item.suggested}")
        suggestions_lines.append("")

    suggestions_text = "\n".join(suggestions_lines)

    jd_result_parts = [
        f"**Overall Score**: {jd_analysis.overall_score}/100",
        f"**ATS Score**: {jd_analysis.ats_score}/100",
        "",
        f"**Summary**: {jd_analysis.summary}",
        "",
        f"**Matched Keywords**: {', '.join(jd_analysis.keyword_matches) or 'N/A'}",
        f"**Missing Keywords**: {', '.join(jd_analysis.missing_keywords) or 'N/A'}",
        "",
        "## Optimization Suggestions",
        suggestions_text,
    ]

    jd_analysis_result = "\n".join(jd_result_parts)

    return JD_ANALYSIS.format(
        now=now,
        jd_analysis_time=jd_analysis_time,
        jd_analysis_result=jd_analysis_result,
    )


SYSTEM = """\
You are Chiren, a resume optimization expert assistant.
Your task is to help users enhance the professionalism, impact, and ATS-friendliness of their resumes.

# Guidelines
- Provide specific, actionable suggestions.
- Use strong action verbs and quantifiable achievements.
- Maintain a professional and concise tone.

# Key Rules — Section Handling
- **Strictly prohibit** removing, deleting, or skipping any existing sections. The user has manually selected the sections to be included.
- When asked to fill, generate, or refine a resume, you **must** iterate through **all** the sections listed below and attempt to fill them. Do not stop prematurely.
- When updating list-type sections, preserve the `id` of existing items exactly as they are. For any new items added, completely omit the `id` field.

# Key Rules — Information Integrity
- Use only the information provided by the user as the sole source, mapping it to the corresponding fields in each section.
- Call the tool to update a section **only if** the user-provided information matches fields within that section.
- If a section cannot be matched with any provided information, skip it directly. Do not call the tool, and do not insert empty values or placeholders.
- Do not infer, guess, or fabricate any information not explicitly provided by the user.

# The resume currently contains the following sections
{sections}
"""


SUB_SYSTEM = """


# Job Description (JD)
---
{job_description}
---

Please optimize the resume based on this JD to improve role alignment and ATS performance.

Requirements:
- Use keywords and phrasing from the JD where appropriate
- Highlight the most relevant experience and skills
- Keep the content concise and focused

Note: Do not fabricate or introduce any information not provided by the user"""


JD_ANALYSIS = """

# Resume Optimization Suggestions Based on JD Analysis

Based on the latest JD analysis results, provide resume optimization suggestions.

Current Time: {now}
JD Analysis Time: {jd_analysis_time}

## JD Analysis Results
---
{jd_analysis_result}
---"""
