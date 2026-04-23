import { useCallback, useEffect, useState } from 'react';
import { X, Loader2, AlertCircle, FileJson, FileText, Code2, File } from 'lucide-react';
import { useResumeStore } from '@/stores/resume-store';
import { exportJson, exportTxt, exportPdf } from '@/lib/api';
import { extractPreviewHtml, downloadHtml, downloadBlob } from '@/lib/export-utils';

interface ExportDialogProps {
  resumeId: string;
  resumeTitle: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type ExportStatus = 'idle' | 'exporting' | 'done' | 'error';

const FORMAT_OPTIONS = [
  { key: 'json', label: 'JSON', description: '结构化数据格式，便于二次编辑', icon: FileJson },
  { key: 'txt', label: 'TXT', description: '纯文本格式，通用性强', icon: FileText },
  { key: 'html', label: 'HTML', description: '网页格式，保留排版样式', icon: Code2 },
  { key: 'pdf', label: 'PDF', description: '打印级文档，适合投递', icon: File },
] as const;

export function ExportDialog({
  resumeId,
  resumeTitle,
  open,
  onOpenChange,
}: ExportDialogProps) {
  const [status, setStatus] = useState<ExportStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [selectedFormat, setSelectedFormat] = useState<string | null>(null);

  useEffect(() => {
    if (status === 'done') {
      const timer = setTimeout(() => {
        setStatus('idle');
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  const handleExport = useCallback(async (format: string) => {
    setSelectedFormat(format);
    setStatus('exporting');
    setErrorMessage('');

    try {
      await useResumeStore.getState().save();

      const safeTitle = resumeTitle || 'resume';

      switch (format) {
        case 'json': {
          const blob = await exportJson(resumeId);
          downloadBlob(blob, `${safeTitle}.json`);
          break;
        }
        case 'txt': {
          const blob = await exportTxt(resumeId);
          downloadBlob(blob, `${safeTitle}.txt`);
          break;
        }
        case 'html': {
          const html = extractPreviewHtml();
          if (!html) {
            throw new Error('无法提取简历预览内容，请确认预览区域已加载');
          }
          downloadHtml(html, `${safeTitle}.html`);
          break;
        }
        case 'pdf': {
          const html = extractPreviewHtml();
          if (!html) {
            throw new Error('无法提取简历预览内容，请确认预览区域已加载');
          }
          const blob = await exportPdf(html);
          downloadBlob(blob, `${safeTitle}.pdf`);
          break;
        }
        default:
          throw new Error(`不支持的格式: ${format}`);
      }

      setStatus('done');
    } catch (err: unknown) {
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : '导出失败，请重试');
    }
  }, [resumeId, resumeTitle]);

  const handleClose = useCallback(() => {
    setStatus('idle');
    setErrorMessage('');
    setSelectedFormat(null);
    onOpenChange(false);
  }, [onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex w-[500px] max-h-[80vh] flex-col rounded-lg bg-white shadow-xl dark:bg-zinc-900">
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <File className="h-5 w-5 text-blue-500" />
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              导出简历
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-6">
          {status === 'idle' && (
            <div className="grid grid-cols-2 gap-4">
              {FORMAT_OPTIONS.map(({ key, label, description, icon: Icon }) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleExport(key)}
                  className="flex flex-col items-center gap-2 rounded-lg border border-zinc-200 p-6 transition-colors hover:bg-zinc-50 dark:border-zinc-700 dark:hover:bg-zinc-800"
                >
                  <Icon className="h-8 w-8 text-zinc-600 dark:text-zinc-400" />
                  <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                    {label}
                  </span>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">
                    {description}
                  </span>
                </button>
              ))}
            </div>
          )}

          {status === 'exporting' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8">
              <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                正在生成{selectedFormat ? ` ${FORMAT_OPTIONS.find(f => f.key === selectedFormat)?.label}` : ''}...
              </p>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 py-8">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={() => {
                  setStatus('idle');
                  setErrorMessage('');
                  setSelectedFormat(null);
                }}
                className="rounded-lg bg-blue-500 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-600"
              >
                重试
              </button>
            </div>
          )}

          {status === 'done' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-3 py-8">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
                <svg
                  className="h-6 w-6 text-green-600 dark:text-green-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <p className="text-sm font-medium text-green-600 dark:text-green-400">
                导出成功
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}