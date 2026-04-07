import type { Resume, PersonalInfoContent, EducationItem, ProjectItem, SkillCategory } from '../../types/resume';

interface TemplateThumbnailProps {
  resume: Resume;
  className?: string;
}

function getPersonalInfo(resume: Resume): PersonalInfoContent | null {
  const section = resume.sections.find((s) => s.type === 'personal_info');
  return (section?.content as PersonalInfoContent) || null;
}

function getSummaryText(resume: Resume): string {
  const section = resume.sections.find((s) => s.type === 'summary');
  return ((section?.content as { text?: string })?.text) || '';
}

function getEducationItems(resume: Resume): EducationItem[] {
  const section = resume.sections.find((s) => s.type === 'education');
  return ((section?.content as { items?: EducationItem[] })?.items || []).slice(0, 2);
}

function getProjectItems(resume: Resume): ProjectItem[] {
  const section = resume.sections.find((s) => s.type === 'projects');
  return ((section?.content as { items?: ProjectItem[] })?.items || []).slice(0, 2);
}

function getSkillCategories(resume: Resume): SkillCategory[] {
  const section = resume.sections.find((s) => s.type === 'skills');
  return ((section?.content as { categories?: SkillCategory[] })?.categories || []).slice(0, 3);
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-semibold text-[4px] text-zinc-600 mb-[1px] uppercase tracking-wider">
      {children}
    </div>
  );
}

function ClassicThumb({ resume }: { resume: Resume }) {
  const info = getPersonalInfo(resume);
  const summary = getSummaryText(resume);
  const eduItems = getEducationItems(resume);

  return (
    <div className="flex h-full flex-col p-[6px]">
      <div className="mb-[3px] border-b border-zinc-700 pb-[3px] text-center">
        {info && (
          <>
            <div className="text-[5px] font-bold text-zinc-800 truncate">
              {info.fullName || '姓名'}
            </div>
            {info.jobTitle && (
              <div className="text-[3.5px] text-zinc-500 mt-[1px] truncate">
                {info.jobTitle}
              </div>
            )}
            <div className="text-[3px] text-zinc-400 mt-[1px]">
              {[info.email, info.phone, info.location].filter(Boolean).join(' · ')}
            </div>
          </>
        )}
      </div>

      {summary && (
        <div className="mb-[3px]">
          <SectionTitle>个人简介</SectionTitle>
          <div className="text-[3px] text-zinc-500 leading-[5px] line-clamp-2">
            {summary}
          </div>
        </div>
      )}

      {eduItems.length > 0 && (
        <div>
          <SectionTitle>教育背景</SectionTitle>
          <div className="space-y-[2px]">
            {eduItems.map((item) => (
              <div key={item.id}>
                <div className="flex justify-between items-baseline">
                  <span className="text-[3.5px] font-medium text-zinc-700 truncate">
                    {item.institution}
                  </span>
                  <span className="text-[2.5px] text-zinc-400 shrink-0 ml-[2px] whitespace-nowrap">
                    {item.startDate} – {item.endDate}
                  </span>
                </div>
                <div className="text-[3px] text-zinc-500 truncate">
                  {item.degree} · {item.field}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ModernThumb({ resume }: { resume: Resume }) {
  const info = getPersonalInfo(resume);
  const eduItems = getEducationItems(resume);
  const projectItems = getProjectItems(resume);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="relative px-[6px] py-[5px]" style={{ background: 'linear-gradient(135deg, #1a1a2e, #0f3460)' }}>
        {info && (
          <>
            <div className="text-[5px] font-bold text-white/90 truncate">
              {info.fullName || '姓名'}
            </div>
            {info.jobTitle && (
              <div className="text-[3.5px] text-white/60 mt-[1px] truncate">
                {info.jobTitle}
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex-1 p-[6px] space-y-[3px] overflow-hidden">
        {eduItems.slice(0, 1).map((item) => (
          <div key={item.id}>
            <div className="text-[4px] font-semibold text-[#0f3460] truncate">
              {item.institution}
            </div>
            <div className="text-[3px] text-zinc-400 truncate">
              {item.degree} · {item.field}
            </div>
          </div>
        ))}
        {projectItems.slice(0, 1).map((item) => (
          <div key={item.id}>
            <div className="text-[3.5px] font-medium text-zinc-600 truncate">
              {item.name}
            </div>
            <div className="text-[2.5px] text-zinc-400 leading-[4px] line-clamp-2 mt-[1px]">
              {item.description}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function TwoColumnThumb({ resume }: { resume: Resume }) {
  const info = getPersonalInfo(resume);
  const eduItems = getEducationItems(resume);
  const skillCats = getSkillCategories(resume);

  return (
    <div className="flex h-full overflow-hidden">
      <div className="w-[35%] p-[5px]" style={{ background: 'linear-gradient(180deg, #1a1a2e, #16213e)' }}>
        {info && (
          <>
            <div className="text-[4px] font-bold text-white/80 text-center mb-[2px] truncate">
              {info.fullName}
            </div>
            <div className="space-y-[1px] mb-[3px]">
              {info.email && <div className="text-[2.5px] text-white/40 truncate">{info.email}</div>}
              {info.phone && <div className="text-[2.5px] text-white/40 truncate">{info.phone}</div>}
              {info.location && <div className="text-[2.5px] text-white/40 truncate">{info.location}</div>}
            </div>
          </>
        )}
        {skillCats.length > 0 && (
          <div>
            <div className="text-[3px] font-semibold text-white/60 mb-[1px]">技能</div>
            <div className="space-y-[1px]">
              {skillCats.map((cat) => (
                <div key={cat.id} className="text-[2.5px] text-white/30 truncate">
                  {cat.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      <div className="flex-1 p-[5px] overflow-hidden">
        {eduItems.slice(0, 1).map((item) => (
          <div key={item.id} className="mb-[2px]">
            <div className="text-[4px] font-semibold text-zinc-700 truncate">
              {item.institution}
            </div>
            <div className="text-[3px] text-zinc-500 truncate">
              {item.degree} · {item.field}
            </div>
          </div>
        ))}
        <div className="space-y-[1px]">
          <div className="h-[2px] w-full rounded-full bg-zinc-100" />
          <div className="h-[2px] w-4/5 rounded-full bg-zinc-100" />
          <div className="h-[2px] w-2/3 rounded-full bg-zinc-100" />
        </div>
      </div>
    </div>
  );
}

function CreativeThumb({ resume }: { resume: Resume }) {
  const info = getPersonalInfo(resume);
  const projectItems = getProjectItems(resume);

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <div className="relative px-[6px] py-[5px]" style={{ background: 'linear-gradient(135deg, #7c3aed, #f97316)' }}>
        {info && (
          <>
            <div className="text-[5px] font-bold text-white/90 truncate">
              {info.fullName || '姓名'}
            </div>
            {info.jobTitle && (
              <div className="text-[3.5px] text-white/60 mt-[1px] truncate">
                {info.jobTitle}
              </div>
            )}
          </>
        )}
      </div>
      <div className="flex-1 p-[5px] overflow-hidden space-y-[3px]">
        {projectItems.slice(0, 1).map((item) => (
          <div key={item.id}>
            <div className="text-[3.5px] font-semibold text-purple-600 truncate">
              {item.name}
            </div>
            <div className="text-[2.5px] text-zinc-400 mt-[1px] line-clamp-2 leading-[4px]">
              {item.description}
            </div>
          </div>
        ))}
        {projectItems[0]?.technologies && projectItems[0].technologies.length > 0 && (
          <div className="flex flex-wrap gap-[1px] mt-[2px]">
            {projectItems[0].technologies.slice(0, 4).map((tech, i) => (
              <span key={i} className="text-[2.5px] px-[2px] py-[0.5px] rounded-full bg-purple-50 text-purple-500 border border-purple-100">
                {tech}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

type ThumbComponent = React.FC<{ resume: Resume }>;

const thumbnailMap: Record<string, ThumbComponent> = {
  classic: ClassicThumb,
  modern: ModernThumb,
  'two-column': TwoColumnThumb,
  creative: CreativeThumb,
};

export function TemplateThumbnail({ resume, className = '' }: TemplateThumbnailProps) {
  const Thumb = thumbnailMap[resume.template] || ClassicThumb;
  return (
    <div className={`overflow-hidden rounded-lg bg-white ${className}`}>
      <Thumb resume={resume} />
    </div>
  );
}