import { useCallback, useEffect } from 'react';
import { useResumeStore } from '@/stores/resume-store';
import { useEditorStore } from '@/stores/editor-store';
import type { ResumeSection } from '@/types/resume';
import { fetchResumeDetail, fetchResumeSections } from '@/lib/api';
import { generateId } from '@/lib/utils';

export function useEditor(resumeId: string) {
  const { setResume, sections, currentResume, updateSection, addSection, removeSection, reorderSections, reset: resetResume } = useResumeStore();
  const { pushSnapshot, reset: resetEditor } = useEditorStore();

  const loadResume = useCallback(async () => {
    try {
      const [resumeData, sectionList] = await Promise.all([
        fetchResumeDetail(resumeId),
        fetchResumeSections(resumeId),
      ]);
      const sections = (sectionList as any[]).map((s) => {
        const content = s.content as unknown as Record<string, unknown>;
        if (Array.isArray(content?.items)) {
          content.items = (content.items as any[]).map((item) =>
            typeof item === 'object' && item !== null && !item.id
              ? { ...item, id: generateId() }
              : item
          );
        }
        if (Array.isArray(content?.categories)) {
          content.categories = (content.categories as any[]).map((cat) =>
            typeof cat === 'object' && cat !== null && !cat.id
              ? { ...cat, id: generateId() }
              : cat
          );
        }
        return {
          id: s.id,
          resumeId: s.resumeId,
          type: s.type,
          title: s.title,
          sortOrder: s.sortOrder,
          visible: s.visible,
          content: content as unknown as typeof s.content,
          createdAt: new Date(s.createdAt || Date.now()),
          updatedAt: new Date(s.updatedAt || Date.now()),
        };
      });
      setResume({
        ...resumeData,
        sections,
        themeConfig: resumeData.themeConfig || {},
        createdAt: new Date(resumeData.createdAt),
        updatedAt: new Date(resumeData.updatedAt),
      });
    } catch (error) {
      console.error('Failed to load resume:', error);
    }
  }, [resumeId, setResume]);

  useEffect(() => {
    loadResume();
    return () => {
      resetResume();
      resetEditor();
    };
  }, [loadResume, resetResume, resetEditor]);

  const handleUpdateSection = useCallback(
    (sectionId: string, content: any) => {
      pushSnapshot(sections);
      updateSection(sectionId, content);
    },
    [sections, pushSnapshot, updateSection]
  );

  const handleAddSection = useCallback(
    (section: ResumeSection) => {
      pushSnapshot(sections);
      addSection(section);
    },
    [sections, pushSnapshot, addSection]
  );

  const handleRemoveSection = useCallback(
    (sectionId: string) => {
      pushSnapshot(sections);
      removeSection(sectionId);
    },
    [sections, pushSnapshot, removeSection]
  );

  const handleReorder = useCallback(
    (newSections: ResumeSection[]) => {
      pushSnapshot(sections);
      reorderSections(newSections);
    },
    [sections, pushSnapshot, reorderSections]
  );

  return {
    resume: currentResume,
    sections,
    updateSection: handleUpdateSection,
    addSection: handleAddSection,
    removeSection: handleRemoveSection,
    reorderSections: handleReorder,
    loadResume,
  };
}
