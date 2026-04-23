import {
  ArrowLeft,
  Undo2,
  Redo2,
  Download,
  Upload,
  Settings,
  Palette,
  Save,
  FileSearch,
  Languages,
  FileText,
  SpellCheck,
  Share2,
} from 'lucide-react'
import { useResumeStore } from '@/stores/resume-store';

interface EditorToolbarProps {
  title?: string
  onBack?: () => void
  onCoverLetterOpen?: () => void
  onThemeToggle?: () => void
  onSettings?: () => void
  onExport?: () => void
  themeActive?: boolean
}

/**
 * Editor toolbar with action buttons.
 * Migrated from JadeAI editor. Button handlers are TODO placeholders.
 */
export default function EditorToolbar({ title = '未命名简历', onBack, onCoverLetterOpen, onThemeToggle, onSettings, onExport, themeActive }: EditorToolbarProps) {
  const { isSaving, isDirty } = useResumeStore();

  const saveLabel = isSaving ? '保存中...' : isDirty ? '未保存' : '已保存';

  return (
    <div className="flex h-12 items-center justify-between border-b border-[#2a2a2e] bg-[#18181a] px-3">
      <div className="flex items-center gap-2">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
        )}

        <div className="h-6 w-px bg-[#2a2a2e]" />

        <span className="max-w-48 truncate text-sm font-medium text-zinc-100">
          {title}
        </span>

        <span className="text-xs text-zinc-500">{saveLabel}</span>

        {false && (
          <button
            type="button"
            // TODO: wire to save handler
            className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-pink-400 transition-colors hover:bg-pink-500/10 hover:text-pink-300"
          >
            <Save className="h-3.5 w-3.5" />
            保存
          </button>
        )}
      </div>

      <div className="flex items-center gap-1">
        <button
          type="button"
          title="撤销 (Ctrl+Z)"
          disabled={true}
          className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
        >
          <Undo2 className="h-4 w-4" />
        </button>

        <button
          type="button"
          title="重做 (Ctrl+Shift+Z)"
          disabled={true}
          className="rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100 disabled:opacity-40"
        >
          <Redo2 className="h-4 w-4" />
        </button>

        <div className="h-6 w-px bg-[#2a2a2e]" />

        <button
          type="button"
          title="导出"
          onClick={onExport}
          className="flex items-center gap-1 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Download className="h-4 w-4" />
          <span className="ml-1 hidden text-xs sm:inline">导出</span>
        </button>

        <button
          type="button"
          title="导入"
          className="flex items-center gap-1 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Upload className="h-4 w-4" />
          <span className="ml-1 hidden text-xs sm:inline">导入</span>
        </button>

        <button
          type="button"
          title="分享"
          className="flex items-center gap-1 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Share2 className="h-4 w-4" />
          <span className="ml-1 hidden text-xs sm:inline">分享</span>
        </button>

        <div className="h-6 w-px bg-[#2a2a2e]" />

        <button
          type="button"
          title="JD 匹配分析"
          className="flex items-center gap-1 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <FileSearch className="h-4 w-4" />
          <span className="ml-1 hidden text-xs sm:inline">JD 分析</span>
        </button>

        <button
          type="button"
          title="翻译"
          className="flex items-center gap-1 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Languages className="h-4 w-4" />
          <span className="ml-1 hidden text-xs sm:inline">翻译</span>
        </button>

        <button
          type="button"
          title="求职信"
          onClick={onCoverLetterOpen}
          className="flex items-center gap-1 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <FileText className="h-4 w-4" />
          <span className="ml-1 hidden text-xs sm:inline">求职信</span>
        </button>

        <button
          type="button"
          title="语法检查"
          className="flex items-center gap-1 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <SpellCheck className="h-4 w-4" />
          <span className="ml-1 hidden text-xs sm:inline">语法</span>
        </button>

        <div className="h-6 w-px bg-[#2a2a2e]" />

        <button
          type="button"
          title="主题"
          onClick={onThemeToggle}
          className={`flex items-center gap-1 rounded-md p-1.5 transition-colors ${themeActive ? 'bg-pink-500/20 text-pink-400' : 'text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100'}`}
        >
          <Palette className="h-4 w-4" />
          <span className="ml-1 hidden text-xs sm:inline">主题</span>
        </button>

        <div className="h-6 w-px bg-[#2a2a2e]" />

        <button
          type="button"
          title="设置"
          onClick={onSettings}
          className="flex items-center gap-1 rounded-md p-1.5 text-zinc-400 transition-colors hover:bg-zinc-800 hover:text-zinc-100"
        >
          <Settings className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
