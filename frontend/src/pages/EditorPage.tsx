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
import { mockResume } from '@/data/mockResume';

export default function EditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showThemeEditor } = useEditorStore();
  const { updateSection, addSection, removeSection, reorderSections, loadResume } = useEditor(id || 'mock-1');
  const { sections, setResume, currentResume } = useResumeStore();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    loadResume().finally(() => {
      if (!useResumeStore.getState().currentResume) {
        setResume(mockResume);
      }
      setLoading(false);
    });
  }, [id, loadResume, setResume]);

  if (loading || !currentResume) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-50 dark:bg-zinc-950">
        <div className="space-y-4 text-zinc-500">加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-zinc-50 dark:bg-zinc-950">
      <EditorToolbar title={currentResume.title} onBack={() => navigate('/')} />
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
    </div>
  );
}
