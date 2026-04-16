import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Copy, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { getProviderConfig } from '@/lib/api';

interface CoverLetterDialogProps {
  resumeId: string;
  hasJobDescription: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GenerationStatus = 'idle' | 'generating' | 'done' | 'error';

export function CoverLetterDialog({
  resumeId,
  hasJobDescription,
  open,
  onOpenChange,
}: CoverLetterDialogProps) {
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [content, setContent] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [coverLetterId, setCoverLetterId] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);
  const [aiConfig, setAiConfig] = useState<{
    type: 'openai' | 'anthropic';
    baseUrl: string;
    apiKey: string;
    model: string;
  } | null>(null);

  const contentRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  // 从 API 加载 AI 配置
  useEffect(() => {
    if (open) {
      getProviderConfig()
        .then((config) => {
          const activeProvider = config.providers[config.active];
          if (activeProvider) {
            setAiConfig({
              type: config.active,
              baseUrl: activeProvider.baseUrl || '',
              apiKey: activeProvider.apiKey || '',
              model: activeProvider.model || '',
            });
          }
        })
        .catch(console.error);
    }
  }, [open]);

  // Auto-scroll content
  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);

  // Cleanup on close
  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open]);

  const handleGenerate = useCallback(async () => {
    if (!aiConfig || !aiConfig.type || !aiConfig.apiKey) {
      setStatus('error');
      setErrorMessage('请先在设置中配置 AI 供应商和 API Key');
      return;
    }

    const abortController = new AbortController();
    abortRef.current = abortController;

    setStatus('generating');
    setContent('');
    setErrorMessage('');
    setCoverLetterId(null);

    try {
      const response = await fetch('http://localhost:8000/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_id: resumeId,
          type: aiConfig.type,
          base_url: aiConfig.baseUrl,
          api_key: aiConfig.apiKey,
          model: aiConfig.model,
        }),
        signal: abortController.signal,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || `请求失败: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('不支持的响应格式');
      }

      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop() || '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            const eventType = line.slice(6).trim();
            const nextLine = lines[lines.indexOf(line) + 1];
            if (nextLine?.startsWith('data:')) {
              const dataStr = nextLine.slice(5).trim();
              try {
                const data = JSON.parse(dataStr);

                switch (eventType) {
                  case 'text_start':
                    break;
                  case 'text_delta':
                    setContent((prev) => prev + (data.text || ''));
                    break;
                  case 'done':
                    setStatus('done');
                    if (data.coverLetterId) {
                      setCoverLetterId(data.coverLetterId);
                    }
                    break;
                  case 'error':
                    setStatus('error');
                    setErrorMessage(data.message || '生成失败');
                    break;
                }
              } catch {
                // Ignore JSON parse errors
              }
            }
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        return;
      }
      setStatus('error');
      setErrorMessage(err instanceof Error ? err.message : '未知错误');
    }
  }, [aiConfig, resumeId]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = content;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, [content]);

  const handleClose = useCallback(() => {
    abortRef.current?.abort();
    setStatus('idle');
    setContent('');
    setErrorMessage('');
    setCoverLetterId(null);
    onOpenChange(false);
  }, [onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="flex h-[80vh] w-[700px] flex-col rounded-lg bg-white shadow-xl dark:bg-zinc-900">
        {/* Header */}
        <div className="flex items-center justify-between border-b px-6 py-4 dark:border-zinc-700">
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-pink-500" />
            <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200">
              AI 求职信生成
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

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col">
          {status === 'idle' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
              {hasJobDescription ? (
                <>
                  <p className="text-center text-sm text-zinc-500 dark:text-zinc-400">
                    将根据简历信息和岗位描述，AI 生成个性化求职信
                  </p>
                  <button
                    type="button"
                    onClick={handleGenerate}
                    className="flex items-center gap-2 rounded-lg bg-pink-500 px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-pink-600"
                  >
                    <Sparkles className="h-4 w-4" />
                    开始生成
                  </button>
                </>
              ) : (
                <div className="flex flex-col items-center gap-3 text-center">
                  <AlertCircle className="h-8 w-8 text-amber-500" />
                  <p className="text-sm text-zinc-500 dark:text-zinc-400">
                    当前简历缺少岗位描述（job_description），无法生成求职信。
                    <br />
                    请先在简历中设置目标岗位描述。
                  </p>
                </div>
              )}
            </div>
          )}

          {status === 'generating' && (
            <div className="flex flex-1 flex-col p-6">
              <div className="mb-4 flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-pink-500" />
                <span className="text-sm text-zinc-500 dark:text-zinc-400">
                  AI 正在生成求职信...
                </span>
              </div>
              <div
                ref={contentRef}
                className="flex-1 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm leading-relaxed text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {content || (
                  <span className="text-zinc-400">等待响应...</span>
                )}
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="flex flex-1 flex-col p-6">
              <div className="mb-4 flex items-center justify-between">
                <span className="text-sm font-medium text-green-600 dark:text-green-400">
                  生成完成
                </span>
                <div className="flex items-center gap-2">
                  {copied && (
                    <span className="text-sm text-green-500">已复制</span>
                  )}
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-1.5 rounded-md border border-zinc-300 px-3 py-1 text-sm text-zinc-600 transition-colors hover:bg-zinc-100 dark:border-zinc-600 dark:text-zinc-400 dark:hover:bg-zinc-800"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    复制
                  </button>
                </div>
              </div>
              <div
                ref={contentRef}
                className="flex-1 overflow-y-auto rounded-md border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm leading-relaxed text-zinc-800 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-200"
              >
                {content}
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-8">
              <AlertCircle className="h-10 w-10 text-red-500" />
              <p className="text-sm text-red-600 dark:text-red-400">
                {errorMessage}
              </p>
              <button
                type="button"
                onClick={handleGenerate}
                className="rounded-lg bg-pink-500 px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-pink-600"
              >
                重试
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
