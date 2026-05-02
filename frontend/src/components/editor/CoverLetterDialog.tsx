import { useCallback, useEffect, useRef, useState } from 'react';
import { X, Copy, Download, Sparkles, Loader2, AlertCircle } from 'lucide-react';

interface CoverLetterDialogProps {
  resumeId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type GenerationStatus = 'idle' | 'generating' | 'done' | 'error';

type CoverLetterStyle = '正式' | '亲切' | '自信';
type CoverLetterLanguage = '中文' | 'English';

const STYLE_OPTIONS: {
  value: CoverLetterStyle;
  label: string;
  desc: string;
}[] = [
  { value: '正式', label: '正式', desc: '专业严谨' },
  { value: '亲切', label: '亲切', desc: '温暖友好' },
  { value: '自信', label: '自信', desc: '突出优势' },
];

const LANGUAGE_OPTIONS: { value: CoverLetterLanguage; label: string }[] = [
  { value: '中文', label: '中文' },
  { value: 'English', label: 'English' },
];

export function CoverLetterDialog({ resumeId, open, onOpenChange }: CoverLetterDialogProps) {
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [content, setContent] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [copied, setCopied] = useState(false);

  const [jdDescription, setJdDescription] = useState('');
  const [style, setStyle] = useState<CoverLetterStyle>('正式');
  const [language, setLanguage] = useState<CoverLetterLanguage>('中文');

  const contentRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (contentRef.current) {
      contentRef.current.scrollTop = contentRef.current.scrollHeight;
    }
  }, [content]);

  useEffect(() => {
    if (!open) {
      abortRef.current?.abort();
      abortRef.current = null;
    }
  }, [open]);

  useEffect(() => {
    if (!open || !resumeId) return;

    const fetchJdDescription = async () => {
      try {
        const resumeResponse = await fetch(`http://localhost:8000/resume/${resumeId}`);
        if (resumeResponse.ok) {
          const resumeData = await resumeResponse.json();
          const metaInfo = resumeData?.metaInfo;
          if (metaInfo?.job_description) {
            setJdDescription(metaInfo.job_description);
            return;
          }
        }

        const jdResponse = await fetch(`http://localhost:8000/jd-analysis/list/${resumeId}`);
        if (jdResponse.ok) {
          const jdData = await jdResponse.json();
          if (jdData && jdData.length > 0) {
            setJdDescription(jdData[0].job_description || '');
          }
        }
      } catch {
        // 忽略错误
      }
    };

    fetchJdDescription();
  }, [open, resumeId]);

  const handleGenerate = useCallback(async () => {
    if (!jdDescription.trim()) {
      setStatus('error');
      setErrorMessage('请输入岗位描述');
      return;
    }

    const abortController = new AbortController();
    abortRef.current = abortController;

    setStatus('generating');
    setContent('');
    setErrorMessage('');

    try {
      const response = await fetch('http://localhost:8000/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          resume_id: resumeId,
          jd_description: jdDescription,
          type: style,
          language: language,
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
  }, [jdDescription, style, language, resumeId]);

  const handleDownload = useCallback(() => {
    const cleanContent = content.replace(/\n{2,}/g, '\n\n').trim();
    const blob = new Blob([cleanContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `求职信_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [content]);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
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
    setJdDescription('');
    setStyle('正式');
    setLanguage('中文');
    onOpenChange(false);
  }, [onOpenChange]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="flex h-[580px] w-[700px] flex-col rounded-2xl bg-background shadow-2xl dark:bg-card dark:shadow-2xl dark:shadow-black/50">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border dark:border-border/50">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-pink-500 to-pink-600 shadow-lg shadow-pink-500/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground dark:text-foreground">
                AI 求职信生成
              </h2>
              <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                智能匹配岗位，彰显个人优势
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-xl p-2.5 text-muted-foreground transition-all hover:bg-muted hover:text-foreground active:scale-95 dark:text-muted-foreground dark:hover:bg-muted dark:hover:text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex min-h-0 flex-1 flex-col">
          {status === 'idle' && (
            <div className="flex h-full flex-col gap-3 p-6">
              {/* 岗位描述输入 */}
              <div className="flex flex-[4] flex-col gap-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground dark:text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-pink-500 dark:bg-pink-400" />
                  岗位描述
                </label>
                <textarea
                  value={jdDescription}
                  onChange={(e) => setJdDescription(e.target.value)}
                  placeholder="粘贴职位 JD 或描述岗位要求..."
                  className="flex-1 resize-none rounded-xl border border-border bg-muted px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground transition-all focus:border-pink-500/50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-pink-500/20 dark:border-border dark:bg-muted dark:text-foreground dark:placeholder:text-muted-foreground dark:focus:border-pink-500/50 dark:focus:bg-muted"
                />
              </div>

              {/* 风格选择 */}
              <div className="flex flex-1 flex-col gap-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground dark:text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-pink-500 dark:bg-pink-400" />
                  写作风格
                </label>
                <div className="grid h-full grid-cols-3 gap-2">
                  {STYLE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => setStyle(option.value)}
                      className={`relative overflow-hidden rounded-xl px-3 py-2 text-sm font-medium transition-all ${
                        style === option.value
                          ? 'bg-gradient-to-br from-pink-500 to-pink-600 text-white shadow-lg shadow-pink-500/25 dark:from-pink-500 dark:to-pink-600 dark:shadow-pink-500/25'
                          : 'border border-border bg-white text-foreground hover:border-pink-300 hover:bg-pink-500/10 dark:border-border dark:bg-muted dark:text-muted-foreground dark:hover:border-pink-400/60 dark:hover:bg-pink-500/5'
                      }`}
                    >
                      <span className="block">{option.label}</span>
                      <span
                        className={`block text-xs mt-0.5 ${
                          style === option.value
                            ? 'text-pink-100 dark:text-pink-200'
                            : 'text-muted-foreground dark:text-muted-foreground'
                        }`}
                      >
                        {option.desc}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 语言选择 */}
              <div className="flex flex-col gap-1.5">
                <label className="flex items-center gap-2 text-sm font-medium text-foreground dark:text-muted-foreground">
                  <span className="h-1.5 w-1.5 rounded-full bg-pink-500 dark:bg-pink-400" />
                  语言
                </label>
                <select
                  value={language}
                  onChange={(e) => setLanguage(e.target.value as CoverLetterLanguage)}
                  className="w-full cursor-pointer rounded-xl border border-border bg-white px-4 py-2.5 text-sm text-foreground transition-all focus:border-pink-500/50 focus:outline-none focus:ring-2 focus:ring-pink-500/20 dark:border-border dark:bg-muted dark:text-foreground dark:focus:border-pink-500/50"
                  style={{
                    appearance: 'none',
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%23666' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 16px center',
                  }}
                >
                  {LANGUAGE_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 生成按钮 */}
              <div className="flex justify-end pt-1">
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={!jdDescription.trim()}
                  className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 px-8 py-3 text-sm font-medium text-white shadow-lg shadow-pink-500/25 transition-all hover:from-pink-600 hover:to-pink-700 hover:shadow-xl hover:shadow-pink-500/25 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:shadow-lg dark:from-pink-500 dark:to-pink-600 dark:shadow-pink-500/25"
                >
                  <Sparkles className="h-4 w-4" />
                  开始生成
                </button>
              </div>
            </div>
          )}

          {status === 'generating' && (
            <div className="flex h-0 min-h-0 flex-1 flex-col p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/10 dark:bg-pink-500/10">
                  <Loader2 className="h-4 w-4 animate-spin text-pink-500 dark:text-pink-400" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground dark:text-foreground">
                    AI 正在生成求职信
                  </span>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                    基于您的简历和岗位要求量身定制...
                  </p>
                </div>
              </div>
              <div
                ref={contentRef}
                className="flex-1 overflow-y-auto rounded-xl border border-border bg-white p-6 text-foreground dark:border-border/50 dark:bg-muted dark:text-muted-foreground"
                style={{
                  fontFamily: "'Georgia', 'Times New Roman', '宋体', 'SimSun', serif",
                  fontSize: '14px',
                  lineHeight: '1.9',
                  letterSpacing: '0.02em',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                }}
              >
                {content.replace(/^\s+|\s+$/g, '').replace(/\n{3,}/g, '\n\n') || (
                  <span className="flex items-center gap-2 text-muted-foreground dark:text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    正在思考内容结构...
                  </span>
                )}
              </div>
            </div>
          )}

          {status === 'done' && (
            <div className="flex h-0 min-h-0 flex-1 flex-col p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-pink-500/10 dark:bg-pink-500/10">
                  <Sparkles className="h-4 w-4 text-pink-500 dark:text-pink-400" />
                </div>
                <div>
                  <span className="text-sm font-medium text-foreground dark:text-foreground">
                    生成完成
                  </span>
                  <p className="text-xs text-muted-foreground dark:text-muted-foreground">
                    内容已准备就绪，可复制或下载
                  </p>
                </div>
              </div>
              <div
                ref={contentRef}
                className="flex-1 overflow-y-auto rounded-xl border border-border bg-white p-6 text-foreground dark:border-border/50 dark:bg-muted dark:text-muted-foreground"
                style={{
                  fontFamily: "'Georgia', 'Times New Roman', '宋体', 'SimSun', serif",
                  fontSize: '14px',
                  lineHeight: '1.9',
                  letterSpacing: '0.02em',
                  whiteSpace: 'pre-wrap',
                  wordWrap: 'break-word',
                  textAlign: 'justify',
                }}
              >
                {content.replace(/\n{2,}/g, '\n\n').trimStart()}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStatus('idle')}
                  className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-all hover:border-pink-400 hover:text-pink-600 dark:border-border dark:text-muted-foreground dark:hover:border-pink-400 dark:hover:text-pink-400"
                >
                  <Sparkles className="h-4 w-4" />
                  重新生成
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleDownload}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-pink-400 hover:text-pink-600 dark:border-border dark:text-muted-foreground dark:hover:border-pink-400 dark:hover:text-pink-400"
                  >
                    <Download className="h-4 w-4" />
                    下载
                  </button>
                  <button
                    type="button"
                    onClick={handleClose}
                    className="flex items-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-foreground transition-all hover:border-border dark:border-border dark:text-muted-foreground dark:hover:border-border"
                  >
                    关闭
                  </button>
                  <button
                    type="button"
                    onClick={handleCopy}
                    className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 px-5 py-2.5 text-sm font-medium text-white shadow-lg shadow-pink-500/20 transition-all hover:from-pink-600 hover:to-pink-700 dark:from-pink-500 dark:to-pink-600 dark:shadow-pink-500/25"
                  >
                    {copied ? (
                      <span className="text-white">已复制</span>
                    ) : (
                      <>
                        <Copy className="h-4 w-4" />
                        复制
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          )}

          {status === 'error' && (
            <div className="flex flex-1 flex-col items-center justify-center gap-4 p-6">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
                <AlertCircle className="h-8 w-8 text-red-500 dark:text-red-400" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-red-600 dark:text-red-400">{errorMessage}</p>
                <p className="mt-1 text-xs text-muted-foreground dark:text-muted-foreground">
                  请检查输入后重试
                </p>
              </div>
              <button
                type="button"
                onClick={() => setStatus('idle')}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-pink-500 to-pink-600 px-6 py-2.5 text-sm font-medium text-white shadow-lg shadow-pink-500/25 transition-all hover:from-pink-600 hover:to-pink-700 dark:from-pink-500 dark:to-pink-600 dark:shadow-pink-500/25"
              >
                <Sparkles className="h-4 w-4" />
                重新配置
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
