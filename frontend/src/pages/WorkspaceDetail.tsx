import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { Sparkles, Download, MoreVertical, Plus, ArrowLeft, FileText } from 'lucide-react'
import { toast } from 'sonner'
import type { Workspace, SubResume } from '../types/workspace'
import type { Resume, ResumeSection } from '../types/resume'
import ResumePreview from '../components/preview/ResumePreview'
import EditorToolbar from '../components/editor/EditorToolbar'
import { EditorSidebar } from '../components/editor/EditorSidebar'
import { EditorCanvas } from '../components/editor/EditorCanvas'
import { ThemeEditor } from '../components/editor/ThemeEditor'
import { EditorPreviewPanel } from '../components/editor/EditorPreviewPanel'
import { useResumeStore } from '../stores/resume-store'
import { useEditorStore } from '../stores/editor-store'
import { fetchResumeSections, fetchResumeDetail, fetchJdAnalysisList, createSubResume, createSubResumeWithAI, getProviderConfig } from '../lib/api'
import { markUnread, addNotificationTask } from '../lib/notification'
import GenerateForPositionModal from '../components/workspace/GenerateForPositionModal'

interface WorkspaceDetailProps {
  workspace: Workspace
  onBack: () => void
  onRefreshWs?: () => void
}

export default function WorkspaceDetail({ workspace, onBack, onRefreshWs }: WorkspaceDetailProps) {
  const [sections, setSections] = useState<ResumeSection[]>([])
  const [loading, setLoading] = useState(true)
  const [isEditing, setIsEditing] = useState(false)
  const [subResumes, setSubResumes] = useState<SubResume[]>([])
  const [subResumesLoading, setSubResumesLoading] = useState(true)
  const [showGenerateModal, setShowGenerateModal] = useState(false)

  const refreshSubResumes = useCallback(async () => {
    try {
      const data = await fetchResumeDetail(workspace.id)
      const subs: SubResume[] = (data.subResumes || []).map((sub: any) => ({
        id: sub.id,
        title: sub.title,
        jobTitle: sub.metaInfo?.job_title,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      }))
      await Promise.all(
        subs.map(async (sub) => {
          try {
            const analyses = await fetchJdAnalysisList(sub.id)
            if (analyses.length > 0) {
              sub.matchScore = analyses[0].overallScore
            }
          } catch {
          }
        }),
      )
      setSubResumes(subs)
      onRefreshWs?.()
    } catch {
    }
  }, [workspace.id, onRefreshWs])

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

  useEffect(() => {
    fetchResumeDetail(workspace.id)
      .then(async (data) => {
        const subs: SubResume[] = (data.subResumes || []).map((sub: any) => ({
          id: sub.id,
          title: sub.title,
          jobTitle: sub.metaInfo?.job_title,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
        }))

        // 获取每个子简历的评分数据
        await Promise.all(
          subs.map(async (sub) => {
            try {
              const analyses = await fetchJdAnalysisList(sub.id)
              if (analyses.length > 0) {
                // 取最新一条的 overallScore
                sub.matchScore = analyses[0].overallScore
              }
            } catch (err) {
              // 评分数据不存在或获取失败，保持 undefined
              console.warn(`Failed to fetch score for resume ${sub.id}:`, err)
            }
          }),
        )

        setSubResumes(subs)
      })
      .catch((err) => {
        console.error('Failed to fetch sub resumes:', err)
      })
      .finally(() => {
        setSubResumesLoading(false)
      })
  }, [workspace.id])

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { taskType: string }
      if (detail?.taskType !== 'ai_resume') return
      refreshSubResumes()
    }
    window.addEventListener('global-sse-complete', handler)
    return () => { window.removeEventListener('global-sse-complete', handler) }
  }, [refreshSubResumes])

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

  const editorReadyRef = useRef(false)

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
          onClick={() => setShowGenerateModal(true)}
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

             <div className="w-[420px] shrink-0 flex flex-col" style={{ height: '630px' }}>
             <div className="flex items-center justify-between mb-4">
               <div className="flex items-center gap-2">
                 <span className="w-2 h-2 rounded-full bg-blue-500" />
                 <span className="text-gray-300 text-xs font-medium tracking-wider uppercase">
                   已生成的子简历 (Tailored Versions)
                 </span>
               </div>
               <span className="text-gray-500 text-xs">共 {subResumes.length} 份</span>
             </div>

             <div className="space-y-3 overflow-y-auto pr-1" style={{ height: 'calc(100% - 48px)' }}>
              {subResumesLoading ? (
                <div className="flex items-center justify-center h-full text-gray-500 text-sm">
                  加载中...
                </div>
              ) : subResumes.length === 0 ? (
                <div className="flex items-center justify-center h-full">
                  <button
                    type="button"
                    onClick={() => setShowGenerateModal(true)}
                    className="w-full h-full rounded-xl border-2 border-dashed border-[#2a2a2e] hover:border-[#3a3a3c] transition-colors flex flex-col items-center justify-center gap-3 text-gray-500"
                  >
                    <FileText className="w-10 h-10 opacity-40" />
                    <div className="flex flex-col items-center gap-1">
                      <span className="text-sm font-medium">暂无子简历</span>
                      <span className="text-xs">创建新的针对性版本</span>
                    </div>
                    <div className="w-10 h-10 rounded-full bg-[#2a2a2e] flex items-center justify-center mt-2">
                      <Plus className="w-5 h-5" />
                    </div>
                  </button>
                </div>
              ) : (
                subResumes.map((resume) => (
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
                      <FileText className="w-6 h-6 text-gray-400" />
                    </div>

                    <div className="flex-1 min-w-0">
                      <p className="text-white font-semibold text-sm truncate">{resume.title}</p>
                      <p className="text-gray-400 text-xs mt-0.5 truncate">
                        {resume.jobTitle || '—'}
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        <span className="text-gray-500 text-xs">
                          {new Date(resume.createdAt).toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                          }).replace(/\//g, '.')}{' '}
                          生成
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-right">
                        {resume.matchScore !== undefined ? (
                          <>
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
                          </>
                        ) : (
                          <>
                            <p className="text-xl font-bold text-gray-500">--</p>
                            <p className="text-gray-500 text-xs">AI 匹配得分</p>
                          </>
                        )}
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
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      <GenerateForPositionModal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onSubmit={async (payload) => {
          try {
            const config = await getProviderConfig()
            const activeConfig = config.providers[config.active]
            if (!activeConfig?.apiKey || !activeConfig?.baseUrl || !activeConfig?.model) {
              toast.error('请先在设置中配置 AI 提供商')
              return
            }
            const { taskId } = await createSubResumeWithAI({
              workspaceId: workspace.id,
              jobDescription: payload.jdDescription,
              jobTitle: payload.jobTitle || undefined,
              title: payload.name || undefined,
              template: payload.template,
              type: config.active,
              baseUrl: activeConfig.baseUrl,
              apiKey: activeConfig.apiKey,
              model: activeConfig.model,
            })
            const title = payload.name || payload.jobTitle || ''
            setShowGenerateModal(false)
            markUnread()
            addNotificationTask({ id: taskId, taskType: 'ai_resume', status: 'running', workspaceId: workspace.id, metaInfo: { title }, errorMessage: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() })
            toast.success(
              <div className="flex flex-col gap-1">
                <span className="font-medium text-sm">AI 子简历生成任务已启动</span>
                {title && (
                  <span className="text-xs text-gray-400 truncate">
                    「{title}」正在生成中
                  </span>
                )}
              </div>,
            )
          } catch (err: any) {
            toast.error(err.message || 'AI 生成请求失败')
          }
        }}
        onCreateDirect={async (payload) => {
          try {
            await createSubResume({
              workspaceId: workspace.id,
              jobDescription: payload.jdDescription,
              title: payload.name || undefined,
              jobTitle: payload.jobTitle || undefined,
              template: payload.template,
            })
            toast.success('子简历创建成功')
            setShowGenerateModal(false)

            const data = await fetchResumeDetail(workspace.id)
            const subs: SubResume[] = (data.subResumes || []).map((sub: any) => ({
              id: sub.id,
              title: sub.title,
              jobTitle: sub.metaInfo?.job_title,
              createdAt: sub.createdAt,
              updatedAt: sub.updatedAt,
            }))
            await Promise.all(
              subs.map(async (sub) => {
                try {
                  const analyses = await fetchJdAnalysisList(sub.id)
                  if (analyses.length > 0) {
                    sub.matchScore = analyses[0].overallScore
                  }
                } catch {
                }
              }),
            )
            setSubResumes(subs)
            onRefreshWs?.()
          } catch {
            toast.error('创建子简历失败')
          }
        }}
      />
    </div>
  )
}
