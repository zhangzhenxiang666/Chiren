import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Plus,
  ArrowLeft,
  Inbox,
  LayoutGrid,
  FileSearch,
  Users,
  ChevronRight,
  Pencil,
  Trash2,
  Loader2,
} from 'lucide-react';
import { toast } from 'sonner';
import type { Workspace, SubResume } from '../types/workspace';
import type { Resume, ResumeSection } from '../types/resume';
import ResumePreview from '../components/preview/ResumePreview';
import EditorToolbar from '../components/editor/EditorToolbar';
import { EditorSidebar } from '../components/editor/EditorSidebar';
import { EditorCanvas } from '../components/editor/EditorCanvas';
import { ThemeEditor } from '../components/editor/ThemeEditor';
import { EditorPreviewPanel } from '../components/editor/EditorPreviewPanel';
import { CoverLetterDialog } from '../components/editor/CoverLetterDialog';
import { DraggableAIChatButton } from '../components/editor/DraggableAIChatButton';
import { useResumeStore } from '../stores/resume-store';
import { useEditorStore } from '../stores/editor-store';
import type { JdAnalysis } from '../lib/api';
import {
  fetchWorkspaces,
  fetchResumeSections,
  fetchResumeDetail,
  fetchJdAnalysisList,
  createSubResume,
  createSubResumeWithAI,
  getProviderConfig,
  createMatchTask,
  checkRunningMatchTask,
  updateResume,
  deleteWorkspace,
} from '../lib/api';
import { markUnread, addNotificationTask } from '../lib/notification';
import GenerateForPositionModal from '../components/workspace/GenerateForPositionModal';
import ScoreDetailModal from '../components/workspace/ScoreDetailModal';
import EditSubResumeModal from '../components/workspace/EditSubResumeModal';
import ConfirmDialog from '../components/ui/ConfirmDialog';
import ResumeInsightsPanel from '../components/workspace/ResumeInsightsPanel';
import OverviewTab from '../components/workspace/OverviewTab';
import JDAnalysisTab from '../components/workspace/JDAnalysisTab';
import InterviewTab from '../components/workspace/InterviewTab';
import { getScoreColorClass } from '../lib/resume-insights';

type MainTab = 'overview' | 'jd' | 'interview' | 'meta';

const VALID_TABS = new Set<string>(['overview', 'jd', 'interview', 'meta']);
const DEFAULT_TAB: MainTab = 'overview';

export default function WorkspaceDetail() {
  const navigate = useNavigate();
  const {
    id,
    resumeId: urlResumeId,
    tab: urlTab,
  } = useParams<{ id: string; resumeId?: string; tab?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activateParam = searchParams.get('activate');
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [wsLoading, setWsLoading] = useState(true);
  const [sections, setSections] = useState<ResumeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [subResumes, setSubResumes] = useState<SubResume[]>([]);
  const [subResumesLoading, setSubResumesLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [showScoreDetail, setShowScoreDetail] = useState(false);
  const [currentScoreResumeId] = useState<string | null>(null);
  const [resumeAnalyses, setResumeAnalyses] = useState<Map<string, JdAnalysis[]>>(new Map());
  const [coverLetterOpen, setCoverLetterOpen] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingResume, setEditingResume] = useState<SubResume | null>(null);
  const [confirmDeleteResumeId, setConfirmDeleteResumeId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editJobTitle, setEditJobTitle] = useState('');
  const [editJobDescription, setEditJobDescription] = useState('');
  const [isSubmittingMeta, setIsSubmittingMeta] = useState(false);

  const activeTab: MainTab = VALID_TABS.has(urlTab || '') ? (urlTab as MainTab) : DEFAULT_TAB;

  const selectedAnalysisId =
    activeTab === 'jd' && activateParam ? Number(activateParam) : undefined;
  const selectedCollectionId = activeTab === 'interview' ? activateParam || undefined : undefined;

  const handleSelectAnalysis = useCallback(
    (analysisId: number) => {
      setSearchParams({ activate: String(analysisId) }, { replace: true });
    },
    [setSearchParams],
  );

  const handleSelectCollection = useCallback(
    (collectionId: string) => {
      setSearchParams({ activate: collectionId }, { replace: true });
    },
    [setSearchParams],
  );

  const selectedSubResumeId = urlResumeId
    ? subResumes.find((s) => s.id === urlResumeId)
      ? urlResumeId
      : null
    : null;

  const refreshWorkspaces = useCallback(async () => {
    try {
      const data = await fetchWorkspaces();
      if (id) {
        const ws = data.find((w) => w.id === id);
        if (ws) setWorkspace(ws);
      }
    } catch {}
  }, [id]);

  useEffect(() => {
    if (!id) {
      toast.error('缺少工作空间 ID');
      return;
    }
    fetchWorkspaces()
      .then((data) => {
        const ws = data.find((w) => w.id === id);
        if (ws) {
          setWorkspace(ws);
        } else {
          toast.error('未找到该工作空间');
          setWorkspace(null);
        }
      })
      .catch((err) => {
        console.error('Failed to fetch workspace:', err);
        toast.error('加载工作空间失败');
      })
      .finally(() => {
        setWsLoading(false);
      });
  }, [id]);

  const refreshSubResumes = useCallback(async () => {
    if (!workspace) return;
    try {
      const data = await fetchResumeDetail(workspace.id);
      const subs: SubResume[] = (data.subResumes || []).map((sub: any) => ({
        id: sub.id,
        title: sub.title,
        jobTitle: sub.metaInfo?.job_title,
        jobDescription: sub.metaInfo?.job_description,
        createdAt: sub.createdAt,
        updatedAt: sub.updatedAt,
      }));
      await Promise.all(
        subs.map(async (sub) => {
          try {
            const analyses = await fetchJdAnalysisList(sub.id);
            if (analyses.length > 0) {
              sub.matchScore = analyses[0].overallScore;
              sub.latestAnalysis = analyses[0];
              setResumeAnalyses((prev) => {
                const newMap = new Map(prev);
                newMap.set(sub.id, analyses);
                return newMap;
              });
            }
          } catch {}
        }),
      );
      setSubResumes(subs);
      if (subs.length > 0 && !urlResumeId) {
        navigate(`/workspace/${id}/resumes/${subs[0].id}/${DEFAULT_TAB}`, {
          replace: true,
        });
      }
      refreshWorkspaces();
    } catch {}
  }, [workspace, refreshWorkspaces, urlResumeId, id, navigate]);

  const handleEditSubmit = useCallback(
    async (payload: { title: string; jobTitle: string; jobDescription: string }) => {
      if (!editingResume) return;
      try {
        await updateResume({
          id: editingResume.id,
          title: payload.title,
          metaInfo: {
            job_title: payload.jobTitle,
            job_description: payload.jobDescription,
          },
        });
        toast.success('子简历信息已更新');
        setShowEditModal(false);
        setEditingResume(null);
        refreshSubResumes();
      } catch (err: any) {
        toast.error(err.message || '更新子简历失败');
      }
    },
    [editingResume, refreshSubResumes],
  );

  useEffect(() => {
    if (!workspace) return;
    fetchResumeSections(workspace.id)
      .then((data) => {
        setSections(data.sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch((err) => {
        console.error('Failed to fetch resume sections:', err);
        toast.error('加载简历数据失败');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspace]);

  useEffect(() => {
    if (!workspace) return;
    fetchResumeDetail(workspace.id)
      .then(async (data) => {
        const subs: SubResume[] = (data.subResumes || []).map((sub: any) => ({
          id: sub.id,
          title: sub.title,
          jobTitle: sub.metaInfo?.job_title,
          jobDescription: sub.metaInfo?.job_description,
          createdAt: sub.createdAt,
          updatedAt: sub.updatedAt,
        }));

        await Promise.all(
          subs.map(async (sub) => {
            try {
              const analyses = await fetchJdAnalysisList(sub.id);
              if (analyses.length > 0) {
                sub.matchScore = analyses[0].overallScore;
                sub.latestAnalysis = analyses[0];
                setResumeAnalyses((prev) => {
                  const newMap = new Map(prev);
                  newMap.set(sub.id, analyses);
                  return newMap;
                });
              }
            } catch (err) {
              console.warn(`Failed to fetch score for resume ${sub.id}:`, err);
            }
          }),
        );

        setSubResumes(subs);
        if (subs.length > 0 && !urlResumeId) {
          navigate(`/workspace/${id}/resumes/${subs[0].id}/${DEFAULT_TAB}`, {
            replace: true,
          });
        }
      })
      .catch((err) => {
        console.error('Failed to fetch sub resumes:', err);
      })
      .finally(() => {
        setSubResumesLoading(false);
      });
  }, [workspace]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { taskType: string };
      if (detail?.taskType !== 'jd_generate') return;
      refreshSubResumes();
    };
    window.addEventListener('global-sse-complete', handler);
    return () => {
      window.removeEventListener('global-sse-complete', handler);
    };
  }, [refreshSubResumes]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { taskType: string };
      if (detail?.taskType !== 'jd_score') return;
      refreshSubResumes();
    };
    window.addEventListener('global-sse-complete', handler);
    return () => {
      window.removeEventListener('global-sse-complete', handler);
    };
  }, [refreshSubResumes]);

  // URL sync: redirect when resumeId/tab is missing or invalid
  useEffect(() => {
    if (!id || subResumesLoading || !workspace) return;
    if (subResumes.length === 0) return; // empty state, stay on /workspace/:id

    if (!urlResumeId || !subResumes.find((s) => s.id === urlResumeId)) {
      navigate(`/workspace/${id}/resumes/${subResumes[0].id}/${DEFAULT_TAB}`, {
        replace: true,
      });
    } else if (urlTab && !VALID_TABS.has(urlTab)) {
      navigate(`/workspace/${id}/resumes/${urlResumeId}/${DEFAULT_TAB}`, {
        replace: true,
      });
    }
  }, [id, subResumes, subResumesLoading, workspace, urlResumeId, urlTab, navigate]);

  const resumeData: Resume | null = useMemo(() => {
    if (!workspace) return null;
    return {
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
    };
  }, [workspace, sections]);

  const {
    currentResume,
    sections: storeSections,
    updateSection,
    addSection,
    removeSection,
    reorderSections,
  } = useResumeStore();
  const { showThemeEditor } = useEditorStore();

  const editorReadyRef = useRef(false);

  useEffect(() => {
    if (!isEditing) {
      editorReadyRef.current = false;
      return;
    }
    if (!sections.length) return;
    if (!resumeData) return;

    useResumeStore.getState().setResume(resumeData!);

    editorReadyRef.current = true;
  }, [isEditing, resumeData, sections]);

  const handleExitEdit = () => {
    useResumeStore.getState().reset();
    useEditorStore.getState().reset();
    setIsEditing(false);
    if (!workspace) return;
    fetchResumeSections(workspace.id)
      .then((data) => {
        setSections(data.sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch(console.error);
  };

  const selectedSubResume = useMemo(
    () => subResumes.find((s) => s.id === selectedSubResumeId) || null,
    [subResumes, selectedSubResumeId],
  );

  useEffect(() => {
    if (activeTab === 'meta' && selectedSubResume) {
      setEditTitle(selectedSubResume.title || '');
      setEditJobTitle(selectedSubResume.jobTitle || '');
      setEditJobDescription(selectedSubResume.jobDescription || '');
    }
  }, [activeTab, selectedSubResume]);

  const selectedAnalyses = useMemo(
    () => (selectedSubResumeId ? resumeAnalyses.get(selectedSubResumeId) || [] : []),
    [resumeAnalyses, selectedSubResumeId],
  );

  const handleScoreJD = useCallback(async () => {
    if (!selectedSubResume || !workspace) return;
    try {
      const config = await getProviderConfig();
      const activeConfig = config.providers[config.active];
      if (!activeConfig?.apiKey || !activeConfig?.baseUrl || !activeConfig?.model) {
        toast.error('请先在设置中配置 AI 提供商');
        return;
      }
      const existingTask = await checkRunningMatchTask(selectedSubResume.id);
      if (existingTask) {
        toast.error('该简历已有正在进行的评分任务');
        return;
      }
      const { taskId } = await createMatchTask({
        resume_id: selectedSubResume.id,
        type: config.active,
        base_url: activeConfig.baseUrl,
        api_key: activeConfig.apiKey,
        model: activeConfig.model,
      });
      markUnread();
      addNotificationTask({
        id: taskId,
        taskType: 'jd_score',
        status: 'running',
        workspaceId: workspace.id,
        metaInfo: { title: selectedSubResume.title },
        errorMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      toast.success(
        <div className="flex flex-col gap-1">
          <span className="font-medium text-sm">JD 匹配评分任务已启动</span>
          <span className="text-xs text-muted-foreground truncate">
            「{selectedSubResume.title}」正在评分中
          </span>
        </div>,
      );
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : '评分请求失败');
    }
  }, [selectedSubResume, workspace]);

  const tabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    {
      id: 'overview',
      label: '概览',
      icon: <LayoutGrid className="w-3.5 h-3.5" />,
    },
    {
      id: 'jd',
      label: 'JD 分析',
      icon: <FileSearch className="w-3.5 h-3.5" />,
    },
    {
      id: 'interview',
      label: '面试管理',
      icon: <Users className="w-3.5 h-3.5" />,
    },
    { id: 'meta', label: '元数据', icon: <Pencil className="w-3.5 h-3.5" /> },
  ];

  if (wsLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">加载中...</div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
        <Inbox className="w-16 h-16 text-muted-foreground/40" strokeWidth={1.5} />
        <div className="text-center">
          <p className="text-lg text-foreground mb-1">工作空间不存在</p>
          <p className="text-sm text-muted-foreground">访问的工作空间可能已被删除或不存在</p>
        </div>
        <button
          type="button"
          onClick={() => navigate('/workspace')}
          className="mt-2 px-4 py-2 rounded-lg border border-border text-sm text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          返回工作空间列表
        </button>
      </div>
    );
  }

  if (isEditing) {
    if (!editorReadyRef.current || !currentResume) {
      return (
        <div className="flex flex-col h-full">
          <EditorToolbar
            title={workspace!.title}
            onBack={handleExitEdit}
            onCoverLetterOpen={() => setCoverLetterOpen(true)}
          />
          <div className="flex flex-1 items-center justify-center text-muted-foreground text-sm">
            加载编辑器...
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col h-screen -m-6">
        <EditorToolbar
          title={currentResume.title}
          onBack={handleExitEdit}
          onCoverLetterOpen={() => setCoverLetterOpen(true)}
        />
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
        <CoverLetterDialog
          resumeId={currentResume.id}
          open={coverLetterOpen}
          onOpenChange={setCoverLetterOpen}
        />
        <DraggableAIChatButton />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">加载中...</div>
    );
  }

  return (
    <div className="flex flex-col h-full -m-6 pt-[9px] px-6">
      <div className="flex items-center justify-between mb-3.5 shrink-0">
        <div className="flex items-center gap-4">
          <nav className="flex items-center gap-2 text-xs">
            <button
              type="button"
              onClick={() => navigate('/workspace')}
              className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-3 h-3" />
              工作空间
            </button>
            <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
            <span className="text-muted-foreground">{workspace!.title}</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
            <span className="text-foreground font-medium">
              {selectedSubResume?.jobTitle || selectedSubResume?.title || '未选择'}
            </span>
          </nav>

          <div className="h-4 w-px bg-border" />

          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            {selectedSubResume?.matchScore !== undefined && (
              <span
                className={`flex items-center gap-1 ${getScoreColorClass(selectedSubResume.matchScore).text}`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${getScoreColorClass(selectedSubResume.matchScore).text.replace('text-', 'bg-')}`}
                />
                匹配度 {selectedSubResume.matchScore}%
              </span>
            )}
            <span>{selectedAnalyses.length} 次分析</span>
            <span>2 个面试方案</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowGenerateModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
          >
            <Plus className="w-3 h-3" />
            新建子简历
          </button>
        </div>
      </div>

      <div className="flex gap-3 flex-1 min-h-0 items-stretch -mb-[18px]">
        <div className="w-[260px] shrink-0 flex flex-col h-full">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-3 h-3 rounded-full bg-pink-500" />
            <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
              主简历 (Master)
            </span>
          </div>

          <div
            className="overflow-hidden border border-foreground/10 rounded-xl relative flex-shrink-0"
            style={{ width: 'calc(595px * 0.44)', height: '540px' }}
          >
            <div
              className="bg-white text-black"
              style={{
                transform: 'scale(0.44)',
                transformOrigin: 'top left',
                width: '595px',
              }}
            >
              <div id="resume-preview-container">
                {resumeData && (
                  <ResumePreview
                    resume={{ ...resumeData, template: workspace!.template }}
                    onClick={() => navigate(`/workspace/${workspace!.id}/template/edit`)}
                  />
                )}
              </div>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/80 to-transparent pointer-events-none" />
          </div>

          <div className="mt-3 flex-1 min-h-0 overflow-y-auto">
            <ResumeInsightsPanel sections={sections} />
          </div>
        </div>

        <div className="flex-1 min-w-0 flex flex-col h-full bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-3 border-b border-border shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-0.5">
                    <h2 className="text-base font-bold">
                      {selectedSubResume?.jobTitle || selectedSubResume?.title || '未选择子简历'}
                    </h2>
                    {selectedSubResume?.matchScore !== undefined &&
                      selectedSubResume.matchScore >= 85 && (
                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-500/30">
                          推荐
                        </span>
                      )}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>
                      创建:{' '}
                      {selectedSubResume
                        ? new Date(selectedSubResume.createdAt)
                            .toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                            .replace(/\//g, '-')
                        : '--'}
                    </span>
                    <span>
                      更新:{' '}
                      {selectedSubResume
                        ? new Date(selectedSubResume.updatedAt)
                            .toLocaleString('zh-CN', {
                              year: 'numeric',
                              month: '2-digit',
                              day: '2-digit',
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                            .replace(/\//g, '-')
                        : '--'}
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => {
                    if (!selectedSubResume || !workspace) return;
                    navigate(`/workspace/${workspace.id}/resumes/${selectedSubResume.id}/edit`);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted transition-all"
                >
                  <Pencil className="w-3 h-3" />
                  编辑
                </button>
                <button
                  onClick={() => {
                    if (!selectedSubResume) return;
                    setConfirmDeleteResumeId(selectedSubResume.id);
                  }}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border text-[10px] text-muted-foreground hover:text-red-400 hover:border-red-500/30 hover:bg-red-500/10 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                  删除
                </button>
              </div>
            </div>
          </div>

          <div className="flex border-b border-border px-4 shrink-0">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => {
                  if (selectedSubResumeId) {
                    navigate(`/workspace/${id}/resumes/${selectedSubResumeId}/${tab.id}`, {
                      replace: true,
                    });
                  }
                }}
                className={`py-2.5 px-3 text-xs font-medium flex items-center gap-1.5 transition-all relative ${
                  activeTab === tab.id
                    ? 'text-pink-400'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.icon}
                {tab.label}
                {activeTab === tab.id && (
                  <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-pink-400 rounded-full" />
                )}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto overflow-x-hidden p-4 min-h-0">
            {activeTab === 'overview' && (
              <OverviewTab
                analyses={selectedAnalyses}
                subResumeId={selectedSubResumeId || ''}
                onViewInterview={(collectionId) => {
                  if (selectedSubResumeId) {
                    navigate(
                      `/workspace/${id}/resumes/${selectedSubResumeId}/interview${collectionId ? `?activate=${collectionId}` : ''}`,
                      { replace: true },
                    );
                  }
                }}
              />
            )}
            {activeTab === 'jd' && (
              <JDAnalysisTab
                analyses={selectedAnalyses}
                selectedId={selectedAnalysisId}
                onSelectAnalysis={handleSelectAnalysis}
                onStartScoring={handleScoreJD}
              />
            )}
            {activeTab === 'interview' && selectedSubResumeId && (
              <InterviewTab
                subResumeId={selectedSubResumeId}
                subResumeTitle={selectedSubResume?.title}
                selectedCollectionId={selectedCollectionId}
                onSelectCollection={handleSelectCollection}
              />
            )}
            {activeTab === 'meta' && selectedSubResume && (
              <div className="h-full flex flex-col">
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">简历名称</label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-1.5 block">
                      岗位名称 <span className="text-muted-foreground/60">(选填)</span>
                    </label>
                    <input
                      type="text"
                      value={editJobTitle}
                      onChange={(e) => setEditJobTitle(e.target.value)}
                      className="w-full px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50"
                    />
                  </div>
                </div>
                <div className="flex-1 flex flex-col min-h-0">
                  <label className="text-xs text-muted-foreground mb-1.5 block">
                    JD 描述 <span className="text-red-400">*</span>
                  </label>
                  <textarea
                    value={editJobDescription}
                    onChange={(e) => setEditJobDescription(e.target.value)}
                    className="w-full flex-1 resize-none px-3 py-2 bg-background border border-foreground/10 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-pink-500/50 focus:border-pink-500/50 min-h-[300px]"
                  />
                  <div className="flex justify-between mt-1">
                    <span className="text-muted-foreground/60 text-[11px]">
                      请尽量填写完整的岗位要求和职责描述
                    </span>
                    <span
                      className={`text-[11px] ${editJobDescription.trim() ? 'text-pink-400' : 'text-muted-foreground/60'}`}
                    >
                      {editJobDescription.length > 0 ? `${editJobDescription.length} 字` : '必填'}
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-end gap-2 mt-4 pt-4 border-t border-border">
                  <button
                    type="button"
                    onClick={() => {
                      if (selectedSubResumeId) {
                        navigate(`/workspace/${id}/resumes/${selectedSubResumeId}/overview`, {
                          replace: true,
                        });
                      }
                    }}
                    className="px-4 py-2 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors text-sm font-medium"
                  >
                    取消
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      if (!editJobDescription.trim() || !selectedSubResume) return;
                      setIsSubmittingMeta(true);
                      try {
                        await updateResume({
                          id: selectedSubResume.id,
                          title: editTitle.trim() || selectedSubResume.title,
                          metaInfo: {
                            job_title: editJobTitle.trim(),
                            job_description: editJobDescription.trim(),
                          },
                        });
                        toast.success('子简历信息已更新');
                        if (selectedSubResumeId) {
                          navigate(`/workspace/${id}/resumes/${selectedSubResumeId}/overview`, {
                            replace: true,
                          });
                        }
                        refreshSubResumes();
                      } catch (err: any) {
                        toast.error(err.message || '更新子简历失败');
                      } finally {
                        setIsSubmittingMeta(false);
                      }
                    }}
                    disabled={!editJobDescription.trim() || isSubmittingMeta}
                    className="px-4 py-2 rounded-lg border border-border bg-muted/70 text-foreground hover:bg-muted transition-all text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                  >
                    {isSubmittingMeta ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        保存中...
                      </>
                    ) : (
                      <>
                        <Pencil className="h-4 w-4" />
                        保存修改
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="w-[240px] shrink-0 flex flex-col h-full">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500" />
              <span className="text-muted-foreground text-[10px] font-medium tracking-wider uppercase">
                子简历
              </span>
            </div>
            <span className="text-muted-foreground text-[10px]">{subResumes.length} 份</span>
          </div>

          <div className="space-y-2 overflow-y-auto pr-1 flex-1 min-h-0">
            {subResumesLoading ? (
              <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
                加载中...
              </div>
            ) : subResumes.length === 0 ? (
              <button
                type="button"
                onClick={() => setShowGenerateModal(true)}
                className="w-full h-24 rounded-lg border-2 border-dashed border-border hover:border-pink-400 hover:bg-pink-50/50 transition-all flex flex-col items-center justify-center gap-0.5 text-muted-foreground group"
              >
                <Plus className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:text-pink-400 transition-all" />
                <span className="text-xs font-medium group-hover:text-pink-400 transition-colors">
                  新建
                </span>
              </button>
            ) : (
              subResumes.map((resume) => {
                const isActive = resume.id === selectedSubResumeId;
                const scoreColor =
                  resume.matchScore !== undefined ? getScoreColorClass(resume.matchScore) : null;
                return (
                  <div
                    key={resume.id}
                    onClick={() =>
                      navigate(`/workspace/${id}/resumes/${resume.id}/${activeTab}`, {
                        replace: true,
                      })
                    }
                    className={`rounded-lg border p-3 cursor-pointer transition-all group ${
                      isActive ? 'border-pink-400' : 'border-border hover:border-foreground/30'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-1.5 min-w-0 flex-1">
                        <h3 className="text-xs font-semibold truncate text-foreground">
                          {resume.title}
                        </h3>
                        {resume.matchScore !== undefined && resume.matchScore >= 85 && (
                          <span className="px-1 py-0.5 rounded text-[9px] bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 shrink-0 font-medium">
                            推荐
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center justify-between mb-2">
                      <div className="text-[10px] text-muted-foreground">
                        创建时间:{' '}
                        {new Date(resume.createdAt)
                          .toLocaleDateString('zh-CN', {
                            year: 'numeric',
                            month: '2-digit',
                            day: '2-digit',
                            hour: '2-digit',
                            minute: '2-digit',
                          })
                          .replace(/\//g, '-')}
                      </div>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <span className="text-[10px] text-muted-foreground">匹配度:</span>
                        {resume.matchScore !== undefined ? (
                          <span className={`text-[10px] font-bold ${scoreColor?.text}`}>
                            {resume.matchScore}%
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-muted-foreground">--</span>
                        )}
                      </div>
                    </div>

                    <div className="border-t border-border/50 pt-2">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <FileSearch className="w-3 h-3" />
                          <span>JD分析: {(resumeAnalyses.get(resume.id) || []).length}个记录</span>
                        </div>
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Users className="w-3 h-3" />
                          <span>面试方案: 2个</span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {!subResumesLoading && subResumes.length > 0 && (
              <button
                type="button"
                onClick={() => setShowGenerateModal(true)}
                className="w-full h-16 rounded-lg border-2 border-dashed border-muted-foreground/15 hover:border-pink-400 hover:bg-pink-50/50 transition-all flex flex-col items-center justify-center gap-0.5 text-muted-foreground group"
              >
                <Plus className="w-4 h-4 opacity-40 group-hover:opacity-100 group-hover:text-pink-400 transition-all" />
                <span className="text-xs font-medium group-hover:text-pink-400 transition-colors">
                  新建
                </span>
              </button>
            )}
          </div>
        </div>
      </div>

      <GenerateForPositionModal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onSubmit={async (payload) => {
          try {
            const config = await getProviderConfig();
            const activeConfig = config.providers[config.active];
            if (!activeConfig?.apiKey || !activeConfig?.baseUrl || !activeConfig?.model) {
              toast.error('请先在设置中配置 AI 提供商');
              return;
            }
            const { taskId } = await createSubResumeWithAI({
              workspaceId: workspace!.id,
              jobDescription: payload.jdDescription,
              jobTitle: payload.jobTitle || undefined,
              title: payload.name || undefined,
              template: payload.template,
              type: config.active,
              baseUrl: activeConfig.baseUrl,
              apiKey: activeConfig.apiKey,
              model: activeConfig.model,
            });
            const title = payload.name || payload.jobTitle || '';
            setShowGenerateModal(false);
            markUnread();
            addNotificationTask({
              id: taskId,
              taskType: 'jd_generate',
              status: 'running',
              workspaceId: workspace!.id,
              metaInfo: { title },
              errorMessage: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            toast.success(
              <div className="flex flex-col gap-1">
                <span className="font-medium text-sm">AI 子简历生成任务已启动</span>
                {title && (
                  <span className="text-xs text-muted-foreground truncate">
                    「{title}」正在生成中
                  </span>
                )}
              </div>,
            );
          } catch (err: any) {
            toast.error(err.message || 'AI 生成请求失败');
          }
        }}
        onCreateDirect={async (payload) => {
          try {
            await createSubResume({
              workspaceId: workspace!.id,
              jobDescription: payload.jdDescription,
              title: payload.name || undefined,
              jobTitle: payload.jobTitle || undefined,
              template: payload.template,
            });
            toast.success('子简历创建成功');
            setShowGenerateModal(false);

            const data = await fetchResumeDetail(workspace!.id);
            const subs: SubResume[] = (data.subResumes || []).map((sub: any) => ({
              id: sub.id,
              title: sub.title,
              jobTitle: sub.metaInfo?.job_title,
              jobDescription: sub.metaInfo?.job_description,
              createdAt: sub.createdAt,
              updatedAt: sub.updatedAt,
            }));
            await Promise.all(
              subs.map(async (sub) => {
                try {
                  const analyses = await fetchJdAnalysisList(sub.id);
                  if (analyses.length > 0) {
                    sub.matchScore = analyses[0].overallScore;
                    sub.latestAnalysis = analyses[0];
                    setResumeAnalyses((prev) => {
                      const newMap = new Map(prev);
                      newMap.set(sub.id, analyses);
                      return newMap;
                    });
                  }
                } catch {}
              }),
            );
            setSubResumes(subs);
            if (subs.length > 0 && !urlResumeId) {
              navigate(`/workspace/${id}/resumes/${subs[0].id}/${DEFAULT_TAB}`, { replace: true });
            }
            refreshWorkspaces();
          } catch {
            toast.error('创建子简历失败');
          }
        }}
      />

      <ScoreDetailModal
        open={showScoreDetail}
        onClose={() => setShowScoreDetail(false)}
        resumeId={currentScoreResumeId || ''}
        resumeTitle={subResumes.find((r) => r.id === currentScoreResumeId)?.title || ''}
        analyses={currentScoreResumeId ? resumeAnalyses.get(currentScoreResumeId) || [] : []}
        workspaceId={workspace?.id || ''}
      />

      <EditSubResumeModal
        open={showEditModal}
        onClose={() => {
          setShowEditModal(false);
          setEditingResume(null);
        }}
        onSubmit={handleEditSubmit}
        initialData={
          editingResume
            ? {
                title: editingResume.title,
                jobTitle: editingResume.jobTitle,
                jobDescription: editingResume.jobDescription,
              }
            : undefined
        }
      />

      <ConfirmDialog
        open={!!confirmDeleteResumeId}
        title="删除子简历"
        description="确定要删除该子简历吗？此操作不可撤销。"
        confirmText="删除"
        cancelText="取消"
        confirmVariant="danger"
        onConfirm={async () => {
          if (!confirmDeleteResumeId) return;
          try {
            await deleteWorkspace(confirmDeleteResumeId);
            toast.success('子简历已删除');
            setConfirmDeleteResumeId(null);
            refreshSubResumes();
          } catch (err: any) {
            toast.error(err.message || '删除失败');
          }
        }}
        onCancel={() => setConfirmDeleteResumeId(null)}
      />
    </div>
  );
}
