import { useState, useRef, useEffect } from 'react';
import { Eye, EyeOff, Trash2, GripVertical, Sparkles, Pencil } from 'lucide-react';
import { useResumeStore } from '@/stores/resume-store';
import { useEditorStore } from '@/stores/editor-store';
import { cn } from '@/lib/utils';
import { useDragHandle } from './dnd/sortable-section';
import { useAIChat } from './DraggableAIChatButton';
import { PersonalInfo } from './sections/PersonalInfo';
import { Summary } from './sections/Summary';
import {
  WorkExperience,
  Education,
  Skills,
  Projects,
  Certifications,
  Languages,
  GitHub,
  QrCodes,
  CustomSection,
} from './sections';
import type { ResumeSection, SectionContent } from '@/types/resume';

const sectionComponents: Record<string, React.ComponentType<{ section: ResumeSection; onUpdate: (content: Partial<SectionContent>) => void }>> = {
  personal_info: PersonalInfo,
  summary: Summary,
  work_experience: WorkExperience,
  education: Education,
  skills: Skills,
  projects: Projects,
  certifications: Certifications,
  languages: Languages,
  github: GitHub,
  qr_codes: QrCodes,
  custom: CustomSection,
};

interface SectionWrapperProps {
  section: ResumeSection;
  onUpdate: (content: Partial<SectionContent>) => void;
  onRemove: () => void;
}

export function SectionWrapper({ section, onUpdate, onRemove }: SectionWrapperProps) {
  const { toggleSectionVisibility } = useResumeStore();
  const { selectedSectionId, selectSection } = useEditorStore();
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState(section.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const { attributes, listeners } = useDragHandle();
  const { setIsOpen } = useAIChat();

  useEffect(() => {
    if (isRenaming) {
      inputRef.current?.focus();
      inputRef.current?.select();
    }
  }, [isRenaming]);

  const commitRename = () => {
    const trimmed = renameValue.trim();
    if (trimmed && trimmed !== section.title) {
      useResumeStore.getState().updateSectionTitle(section.id, trimmed);
    } else {
      setRenameValue(section.title);
    }
    setIsRenaming(false);
  };

  const isRenamable = section.type !== 'personal_info';
  const isVisibilityChangable = section.type !== 'personal_info';
  const isDeletable = section.type !== 'personal_info';
  const isSelected = selectedSectionId === section.id;
  const SectionComponent = sectionComponents[section.type] || (() => (
    <p className="text-sm text-zinc-500">未知段落类型: {section.type}</p>
  ));

  return (
    <div
      data-section-id={section.id}
      className={cn(
        'rounded-lg border bg-white p-4 shadow-sm transition-all duration-200 dark:bg-zinc-900 cursor-pointer',
        isSelected
          ? 'border-[#fda5d5] ring-2 ring-[#fda5d5]/50 dark:border-[#fda5d5] dark:ring-[#fda5d5]/30'
          : 'border-zinc-200 dark:border-zinc-800 hover:border-zinc-300 dark:hover:border-zinc-700',
      )}
      onClick={() => selectSection(section.id)}
    >
      <div className="mb-3 flex items-center gap-2 border-b pb-3">
        <div
          className="cursor-grab rounded p-1 text-zinc-300 hover:bg-zinc-100 hover:text-zinc-500 active:cursor-grabbing dark:hover:bg-zinc-800 dark:hover:text-zinc-400"
          {...attributes}
          {...(listeners || {})}
        >
          <GripVertical className="h-4 w-4" />
        </div>

        {isRenaming ? (
          <input
            ref={inputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename();
              if (e.key === 'Escape') { setRenameValue(section.title); setIsRenaming(false); }
            }}
            className="flex-1 rounded border border-pink-300 bg-transparent px-2 py-0.5 text-sm font-medium outline-none"
          />
        ) : (
          <h4 className="flex-1 text-sm font-medium text-zinc-700 dark:text-zinc-200" onDoubleClick={() => isRenamable && setIsRenaming(true)}>
            {section.title}
          </h4>
        )}

        {isRenamable && !isRenaming && (
          <button
            type="button"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            onClick={(e) => { e.stopPropagation(); setRenameValue(section.title); setIsRenaming(true); }}
          >
            <Pencil className="h-3.5 w-3.5" />
          </button>
        )}

        <button
          type="button"
          className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-pink-500 dark:hover:bg-zinc-800"
          title="AI 润色"
          onClick={(e) => { e.stopPropagation(); setIsOpen(true); }}
        >
          <Sparkles className="h-4 w-4" />
        </button>

        {isVisibilityChangable && (
          <button
            type="button"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title={section.visible ? '隐藏' : '显示'}
            onClick={(e) => { e.stopPropagation(); toggleSectionVisibility(section.id); }}
          >
            {section.visible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          </button>
        )}

        {isDeletable && (
          <button
            type="button"
            className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-red-500 dark:hover:bg-zinc-800"
            title="删除"
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
      </div>

      <div className={cn(
        'transition-all duration-200',
        !section.visible && 'opacity-50 pointer-events-none select-none'
      )}>
        <SectionComponent section={section} onUpdate={onUpdate} />
      </div>
    </div>
  );
}
