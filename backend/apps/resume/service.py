"""简历相关业务逻辑"""

import uuid

from sqlalchemy.ext.asyncio import AsyncSession

from shared.models import ResumeSection
from shared.types.resume import (
    EducationContent,
    EducationSection,
    PersonalInfo,
    PersonalInfoSection,
    ProjectsContent,
    ProjectsSection,
    SkillsContent,
    SkillsSection,
    Summary,
    SummarySection,
    WorkExperienceContent,
    WorkExperienceSection,
)


async def create_default_sections(resume_id: str, db: AsyncSession) -> None:
    """为新简历创建默认的 section 列表"""
    sections = [
        PersonalInfoSection(
            id=str(uuid.uuid4()),
            resume_id=resume_id,
            title="个人信息",
            sort_order=0,
            content=PersonalInfo(),
        ),
        SummarySection(
            id=str(uuid.uuid4()),
            resume_id=resume_id,
            title="个人简介",
            sort_order=1,
            content=Summary(),
        ),
        WorkExperienceSection(
            id=str(uuid.uuid4()),
            resume_id=resume_id,
            title="工作经历",
            sort_order=2,
            content=WorkExperienceContent(),
        ),
        EducationSection(
            id=str(uuid.uuid4()),
            resume_id=resume_id,
            title="教育背景",
            sort_order=3,
            content=EducationContent(),
        ),
        SkillsSection(
            id=str(uuid.uuid4()),
            resume_id=resume_id,
            title="技能特长",
            sort_order=4,
            content=SkillsContent(),
        ),
        ProjectsSection(
            id=str(uuid.uuid4()),
            resume_id=resume_id,
            title="项目经历",
            sort_order=5,
            content=ProjectsContent(),
        ),
    ]

    for section in sections:
        db.add(ResumeSection.from_pydantic(section))
