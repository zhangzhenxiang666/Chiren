import { useState, useEffect, useRef, useMemo, type JSX } from 'react'
import { Sparkles, Download, MoreVertical, Plus, ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'
import type { Workspace } from '../types/workspace'
import type { Resume, ResumeSection } from '../types/resume'
import ResumePreview from '../components/preview/ResumePreview'
import EditorToolbar from '../components/editor/EditorToolbar'
import { EditorSidebar } from '../components/editor/EditorSidebar'
import { EditorCanvas } from '../components/editor/EditorCanvas'
import { ThemeEditor } from '../components/editor/ThemeEditor'
import { EditorPreviewPanel } from '../components/editor/EditorPreviewPanel'
import { useResumeStore } from '../stores/resume-store'
import { useEditorStore } from '../stores/editor-store'
import { fetchResumeSections } from '../lib/api'

interface TaggedResume {
  id: string
  title: string
  company: string
  matchScore: number
  format: 'PDF' | 'WORD'
  generateDate: string
  icon: string
}

const mockTaggedResumes: TaggedResume[] = [
  {
    id: '1',
    title: '高级解决方案架构师',
    company: '阿里巴巴 (Cloud Native Division)',
    matchScore: 98,
    format: 'PDF',
    generateDate: '2023.11.20',
    icon: 'architecture',
  },
  {
    id: '2',
    title: '技术专家 (P7) - 前端工程化',
    company: '字节跳动 (抖音基础架构组)',
    matchScore: 92,
    format: 'WORD',
    generateDate: '2023.11.15',
    icon: 'frontend',
  },
  {
    id: '3',
    title: 'AI 算法架构师',
    company: '腾讯 (AI Lab)',
    matchScore: 85,
    format: 'PDF',
    generateDate: '2023.11.02',
    icon: 'ai',
  },
]

function getIconComponent(icon: string) {
  const icons: Record<string, JSX.Element> = {
    architecture: (
      <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
        <rect x="4" y="8" width="24" height="16" rx="2" stroke="#f472b6" strokeWidth="2" />
        <path d="M12 8V4M20 8V4M8 24h16" stroke="#f472b6" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
    frontend: (
      <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
        <rect x="4" y="6" width="24" height="16" rx="2" stroke="#60a5fa" strokeWidth="2" />
        <path d="M12 28h8M16 22v6" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
        <path d="M10 12l3 3 3-3" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    ),
    ai: (
      <svg viewBox="0 0 32 32" className="w-8 h-8" fill="none">
        <circle cx="16" cy="16" r="10" stroke="#a78bfa" strokeWidth="2" />
        <circle cx="12" cy="13" r="2" fill="#a78bfa" />
        <circle cx="20" cy="13" r="2" fill="#a78bfa" />
        <path d="M12 20c1 1.5 2 2 4 2s3-.5 4-2" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  }
  return icons[icon] || icons.architecture
}

interface WorkspaceDetailProps {
  workspace: Workspace
  onBack: () => void
}

export default function WorkspaceDetail({ workspace, onBack }: WorkspaceDetailProps) {
  const [sections, setSections] = useState<ResumeSection[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)

  // Track if we've populated the store for editor mode
  const editorReadyRef = useRef(false)

  useEffect(() => {
    fetchResumeSections(workspace.id)
      .then((data) => {
        setSections(data.sort((a, b) => a.sortOrder - b.sortOrder))
      })
      .catch((err) => {
        console.error('Failed to fetch resume sections:', err)
        toast.error('加载简历数据失败')
      })
      .finally(() => {
        setLoading(false)
      })
  }, [workspace.id])

  const resumeData: Resume = useMemo(() => ({
    id: workspace.id,
    userId: '',
    title: workspace.title,
    template: workspace.template,
    themeConfig: workspace.themeConfig as unknown as Resume['themeConfig'],
    isDefault: workspace.isDefault,
    language: workspace.language,
    sections,
    createdAt: new Date(workspace.createdAt),
    updatedAt: new Date(workspace.updatedAt),
  }), [workspace.id, workspace.title, workspace.template, workspace.themeConfig, workspace.isDefault, workspace.language, workspace.createdAt, workspace.updatedAt, sections])

  const { currentResume, sections: storeSections, updateSection, addSection, removeSection, reorderSections } = useResumeStore()
  const { showThemeEditor } = useEditorStore()

  // When entering edit mode: populate Zustand stores
  useEffect(() => {
    if (!isEditing) {
      editorReadyRef.current = false
      return
    }
    if (!sections.length) return

    useResumeStore.getState().setResume(resumeData)
    editorReadyRef.current = true
  }, [isEditing, resumeData, sections])

  // Cleanup stores when leaving edit mode
  const handleExitEdit = () => {
    useResumeStore.getState().reset()
    useEditorStore.getState().reset()
    setIsEditing(false)
    // Refresh workspace data
    fetchResumeSections(workspace.id)
      .then((data) => {
        setSections(data.sort((a, b) => a.sortOrder - b.sortOrder))
      })
      .catch(console.error)
  }

  if (isEditing) {
    if (!editorReadyRef.current || !currentResume) {
      return (
        <div className="flex flex-col h-full">
          <EditorToolbar title={workspace.title} onBack={handleExitEdit} />
          <div className="flex flex-1 items-center justify-center text-gray-400 text-sm">
            加载编辑器...
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col h-screen -m-6">
        <EditorToolbar title={currentResume.title} onBack={handleExitEdit} />
        <div className="flex flex-1 overflow-hidden">
          <EditorSidebar
            sections={storeSections}
            onAddSection={addSection}
            onReorderSections={reorderSections}
          />
          <EditorCanvas
            sections={storeSections}
            onUpdateSection={updateSection}
            onRemoveSection={removeSection}
            onReorderSections={reorderSections}
          />
          {showThemeEditor && <ThemeEditor />}
          <EditorPreviewPanel />
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-gray-400">
        加载中...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <nav className="flex items-center gap-2 text-sm mb-4 shrink-0" aria-label="breadcrumb">
        <button type="button" onClick={onBack} className="flex items-center gap-1 text-gray-400 hover:text-white transition-colors">
          <ArrowLeft className="w-3.5 h-3.5" />
          工作空间
        </button>
        <span className="text-gray-600">›</span>
        <span className="text-pink-400">{workspace.title}</span>
      </nav>

      <div className="flex items-start justify-between mb-8 shrink-0">
        <div>
          <h1 className="text-4xl font-bold text-white mb-3">个人履历管理空间</h1>
          <p className="text-gray-400 text-sm max-w-xl leading-relaxed">
            基于核心资产管理您的职业经历。通过 AI 驱动的精准匹配，为每个心仪职位生成完美简历。
          </p>
        </div>
        <button
          type="button"
          onClick={() => toast.info('即将上线：针对新职位生成功能')}
          className="flex items-center gap-2 px-5 py-3 rounded-lg bg-gradient-to-r from-pink-500 to-pink-600 text-white hover:from-pink-600 hover:to-pink-700 transition-all text-sm font-medium shrink-0"
        >
          <Sparkles className="w-4 h-4" />
          针对新职位生成
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="flex gap-6 h-full">
          <div className="flex-1 flex flex-col min-w-0">
            <div className="flex items-center gap-2 mb-4">
              <span className="w-2 h-2 rounded-full bg-pink-500" />
              <span className="text-gray-300 text-xs font-medium tracking-wider uppercase">
                主简历核心资产 (Master Resume)
              </span>
            </div>

              <div className="h-[566px] overflow-hidden" style={{ maxWidth: 'calc(100% - 2rem)' }}>
                <div style={{ transform: 'scale(0.48)', transformOrigin: 'top left', width: '595px' }}>
                  <ResumePreview resume={{ ...resumeData, template: workspace.template }} onClick={() => setIsEditing(true)} />
                </div>
              </div>
          </div>

          <div className="w-[420px] shrink-0 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-gray-300 text-xs font-medium tracking-wider uppercase">
                  已生成的子简历 (Tailored Versions)
                </span>
              </div>
              <span className="text-gray-500 text-xs">共 {mockTaggedResumes.length} 份</span>
            </div>

            <div className="space-y-3 overflow-y-auto">
              {mockTaggedResumes.map((resume) => (
                <div
                  key={resume.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => toast.info(`即将打开：${resume.title}`)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault()
                      toast.info(`即将打开：${resume.title}`)
                    }
                  }}
                  className="w-full text-left bg-[#1e1e20] rounded-xl border border-[#2a2a2e] hover:border-[#3a3a3c] transition-colors p-4 flex items-center gap-3 cursor-pointer"
                >
                  <div className="w-12 h-12 rounded-lg bg-[#2a2a2e] flex items-center justify-center shrink-0">
                    {getIconComponent(resume.icon)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <p className="text-white font-semibold text-sm truncate">{resume.title}</p>
                    <p className="text-gray-400 text-xs mt-0.5 truncate">{resume.company}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <span className="text-gray-500 text-xs">{resume.generateDate} 生成</span>
                      <span className="px-2 py-0.5 rounded-full bg-indigo-500/20 text-indigo-400 text-xs">
                        {resume.format} 格式
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <p
                        className={`text-xl font-bold ${
                          resume.matchScore >= 95
                            ? 'text-pink-400'
                            : resume.matchScore >= 85
                              ? 'text-indigo-400'
                              : 'text-yellow-400'
                        }`}
                      >
                        {resume.matchScore}%
                      </p>
                      <p className="text-gray-500 text-xs">AI 匹配得分</p>
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toast.info('即将下载')
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#2a2a2e] transition-colors"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        toast.info('更多操作')
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#2a2a2e] transition-colors"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={() => toast.info('即将上线：创建新的针对性版本')}
                className="w-full py-8 rounded-xl border-2 border-dashed border-[#2a2a2e] hover:border-[#3a3a3c] transition-colors flex flex-col items-center gap-2 text-gray-500 hover:text-gray-300"
              >
                <div className="w-8 h-8 rounded-full bg-[#2a2a2e] flex items-center justify-center">
                  <Plus className="w-5 h-5" />
                </div>
                <span className="text-sm">创建新的针对性版本</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
