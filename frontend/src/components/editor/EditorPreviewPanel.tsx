import { useMemo, useState } from 'react';
import { ZoomIn, ZoomOut } from 'lucide-react';
import ResumePreview from '@/components/preview/ResumePreview';
import { useResumeStore } from '@/stores/resume-store';
import type { Resume } from '@/types/resume';

const A4_WIDTH = 794;

interface EditorPreviewPanelProps {
  className?: string;
}

export function EditorPreviewPanel({ className }: EditorPreviewPanelProps = {}) {
  const { currentResume, sections } = useResumeStore();
  const [zoom, setZoom] = useState(80);

  const liveResume = useMemo<Resume | null>(() => {
    if (!currentResume) return null;
    return { ...currentResume, sections } as Resume;
  }, [currentResume, sections]);

  if (!liveResume) return null;

  const scale = zoom / 100;

  return (
    <div className={`flex min-w-0 flex-[6] flex-col border-l bg-zinc-50 dark:bg-zinc-900 dark:border-zinc-800 ${className ?? ''}`}>
      <div className="flex shrink-0 items-center justify-between border-b bg-white px-4 py-2 dark:bg-zinc-900 dark:border-zinc-800">
        <span className="text-xs font-medium text-zinc-500">预览</span>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(30, z - 10))}
            disabled={zoom <= 30}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
          >
            <ZoomOut className="h-3.5 w-3.5" />
          </button>
          <span className="w-10 text-center text-xs text-zinc-500">{zoom}%</span>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(150, z + 10))}
            disabled={zoom >= 150}
            className="flex h-7 w-7 cursor-pointer items-center justify-center rounded transition-colors hover:bg-zinc-100 disabled:opacity-40 dark:hover:bg-zinc-800"
          >
            <ZoomIn className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="flex justify-center p-4">
          <div
            className="bg-white shadow-md"
            style={{ width: '100%', maxWidth: A4_WIDTH, zoom: scale }}
          >
            <ResumePreview resume={liveResume} />
          </div>
        </div>
      </div>
    </div>
  );
}
