import { useParams, useNavigate } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { useEditorStore } from '@/stores/editor-store';
import { useResumeStore } from '@/stores/resume-store';
import { useEditor } from '@/hooks/use-editor';
import EditorToolbar from '@/components/editor/EditorToolbar';
import { EditorSidebar } from '@/components/editor/EditorSidebar';
import { EditorCanvas } from '@/components/editor/EditorCanvas';
import { ThemeEditor } from '@/components/editor/ThemeEditor';
import { EditorPreviewPanel } from '@/components/editor/EditorPreviewPanel';
import { CoverLetterDialog } from '@/components/editor/CoverLetterDialog';
import { DraggableAIChatButton } from '@/components/editor/DraggableAIChatButton';
import { mockResume } from '@/data/mockResume';

export default function EditorPage() {
  const { id, resumeId } = useParams<{ id: string; resumeId?: string }>();
  const effectiveResumeId = resumeId || id;
  const navigate = useNavigate();
  const { showThemeEditor } = useEditorStore();
  const { updateSection, addSection, removeSection, reorderSections, loadResume } = useEditor(effectiveResumeId || 'mock-1');
  const { sections, setResume, currentResume } = useResumeStore();
  const [loading, setLoading] = useState(true);
  const [coverLetterOpen, setCoverLetterOpen] = useState(false);

  useEffect(() => {
    if (!effectiveResumeId) return;
    loadResume().finally(() => {
      if (!useResumeStore.getState().currentResume) {
        setResume(mockResume);
      }
      setLoading(false);
    });
  }, [effectiveResumeId, loadResume, setResume]);

  if (loading || !currentResume) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="space-y-4 text-zinc-500">加载中...</div>
      </div>
    );
  }

  const backUrl = id ? `/workspace/${id}` : '/';

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <EditorToolbar
        title={currentResume.title}
        onBack={() => navigate(backUrl)}
        onCoverLetterOpen={() => setCoverLetterOpen(true)}
      />
      <div className="flex flex-1 overflow-hidden">
        <EditorSidebar
          sections={sections}
          onAddSection={addSection}
          onReorderSections={reorderSections}
        />
        <EditorCanvas
          sections={sections}
          onUpdateSection={updateSection}
          onRemoveSection={removeSection}
          onReorderSections={reorderSections}
        />
        {showThemeEditor && <ThemeEditor />}
        <EditorPreviewPanel />
      </div>
      <CoverLetterDialog
        resumeId={currentResume.id}
        hasJobDescription={!!currentResume.metaInfo?.job_description}
        open={coverLetterOpen}
        onOpenChange={setCoverLetterOpen}
      />
      <DraggableAIChatButton />
    </div>
  );
}
