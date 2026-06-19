import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Inbox,
  ChevronRight,
  Pencil,
  Loader2,
  RotateCcw,
} from "lucide-react";
import { toast } from "sonner";
import type { Workspace, SubResume } from "../types/workspace";
import type { Resume, ResumeSection } from "../types/resume";
import EditorToolbar from "../components/editor/EditorToolbar";
import { EditorSidebar } from "../components/editor/EditorSidebar";
import { EditorCanvas } from "../components/editor/EditorCanvas";
import { ThemeEditor } from "../components/editor/ThemeEditor";
import { EditorPreviewPanel } from "../components/editor/EditorPreviewPanel";
import { CoverLetterDialog } from "../components/editor/CoverLetterDialog";
import { DraggableAIChatButton } from "../components/editor/DraggableAIChatButton";
import { useResumeStore } from "../stores/resume-store";
import { useEditorStore } from "../stores/editor-store";
import type { JdAnalysis } from "../lib/api";
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
} from "../lib/api";
import { markUnread, addNotificationTask } from "../lib/notification";
import GenerateForPositionModal from "../components/workspace/GenerateForPositionModal";
import ConfirmDialog from "../components/ui/ConfirmDialog";
import OverviewTab from "../components/workspace/OverviewTab";
import JDAnalysisTab from "../components/workspace/JDAnalysisTab";
import InterviewTab from "../components/workspace/InterviewTab";
import WorkspaceSidebar from "../components/workspace/WorkspaceSidebar";
import WorkspaceTabs, {
  type MainTab,
} from "../components/workspace/WorkspaceTabs";

const VALID_TABS = new Set<string>(["overview", "jd", "interview", "meta"]);
const DEFAULT_TAB: MainTab = "overview";

export default function WorkspaceDetail() {
  const navigate = useNavigate();
  const {
    id,
    resumeId: urlResumeId,
    tab: urlTab,
  } = useParams<{ id: string; resumeId?: string; tab?: string }>();
  const [searchParams, setSearchParams] = useSearchParams();
  const activateParam = searchParams.get("activate");
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [wsLoading, setWsLoading] = useState(true);
  const [sections, setSections] = useState<ResumeSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [subResumes, setSubResumes] = useState<SubResume[]>([]);
  const [subResumesLoading, setSubResumesLoading] = useState(true);
  const [showGenerateModal, setShowGenerateModal] = useState(false);
  const [resumeAnalyses, setResumeAnalyses] = useState<
    Map<string, JdAnalysis[]>
  >(new Map());
  const [coverLetterOpen, setCoverLetterOpen] = useState(false);
  const [confirmDeleteResumeId, setConfirmDeleteResumeId] = useState<
    string | null
  >(null);
  const [editTitle, setEditTitle] = useState("");
  const [editJobTitle, setEditJobTitle] = useState("");
  const [editJobDescription, setEditJobDescription] = useState("");
  const [isSubmittingMeta, setIsSubmittingMeta] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  const activeTab: MainTab = VALID_TABS.has(urlTab || "")
    ? (urlTab as MainTab)
    : DEFAULT_TAB;

  const selectedAnalysisId =
    activeTab === "jd" && activateParam ? Number(activateParam) : undefined;
  const selectedCollectionId =
    activeTab === "interview" ? activateParam || undefined : undefined;

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

  const handleTabChange = useCallback(
    (tab: MainTab) => {
      if (selectedSubResumeId) {
        navigate(`/workspace/${id}/resumes/${selectedSubResumeId}/${tab}`, {
          replace: true,
        });
      }
    },
    [selectedSubResumeId, id, navigate],
  );

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
      toast.error("缺少工作空间 ID");
      return;
    }
    fetchWorkspaces()
      .then((data) => {
        const ws = data.find((w) => w.id === id);
        if (ws) {
          setWorkspace(ws);
        } else {
          toast.error("未找到该工作空间");
          setWorkspace(null);
        }
      })
      .catch((err) => {
        console.error("Failed to fetch workspace:", err);
        toast.error("加载工作空间失败");
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

  useEffect(() => {
    if (!workspace) return;
    fetchResumeSections(workspace.id)
      .then((data) => {
        setSections(data.sort((a, b) => a.sortOrder - b.sortOrder));
      })
      .catch((err) => {
        console.error("Failed to fetch resume sections:", err);
        toast.error("加载简历数据失败");
      })
      .finally(() => {
        setLoading(false);
      });
  }, [workspace, urlResumeId, navigate, id]);

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
        console.error("Failed to fetch sub resumes:", err);
      })
      .finally(() => {
        setSubResumesLoading(false);
      });
  }, [workspace, urlResumeId, navigate, id]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { taskType: string };
      if (detail?.taskType !== "jd_generate") return;
      refreshSubResumes();
    };
    window.addEventListener("global-sse-complete", handler);
    return () => {
      window.removeEventListener("global-sse-complete", handler);
    };
  }, [refreshSubResumes]);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail as { taskType: string };
      if (detail?.taskType !== "jd_score") return;
      refreshSubResumes();
    };
    window.addEventListener("global-sse-complete", handler);
    return () => {
      window.removeEventListener("global-sse-complete", handler);
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
  }, [
    id,
    subResumes,
    subResumesLoading,
    workspace,
    urlResumeId,
    urlTab,
    navigate,
  ]);

  const resumeData: Resume | null = useMemo(() => {
    if (!workspace) return null;
    return {
      id: workspace.id,
      userId: "",
      title: workspace.title,
      template: workspace.template,
      themeConfig: workspace.themeConfig as unknown as Resume["themeConfig"],
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
    if (activeTab === "meta" && selectedSubResume) {
      setEditTitle(selectedSubResume.title || "");
      setEditJobTitle(selectedSubResume.jobTitle || "");
      setEditJobDescription(selectedSubResume.jobDescription || "");
    }
  }, [activeTab, selectedSubResume]);

  const isMetaDirty = useMemo(() => {
    if (!selectedSubResume) return false;
    return (
      editTitle !== (selectedSubResume.title || "") ||
      editJobTitle !== (selectedSubResume.jobTitle || "") ||
      editJobDescription !== (selectedSubResume.jobDescription || "")
    );
  }, [editTitle, editJobDescription, editJobTitle, selectedSubResume]);

  const selectedAnalyses = useMemo(
    () =>
      selectedSubResumeId ? resumeAnalyses.get(selectedSubResumeId) || [] : [],
    [resumeAnalyses, selectedSubResumeId],
  );

  const handleScoreJD = useCallback(async () => {
    if (!selectedSubResume || !workspace) return;
    try {
      const config = await getProviderConfig();
      const activeConfig = config.providers[config.active];
      if (
        !activeConfig?.apiKey ||
        !activeConfig?.baseUrl ||
        !activeConfig?.model
      ) {
        toast.error("请先在设置中配置 AI 提供商");
        return;
      }
      const existingTask = await checkRunningMatchTask(selectedSubResume.id);
      if (existingTask) {
        toast.error("该简历已有正在进行的评分任务");
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
        taskType: "jd_score",
        status: "running",
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
      toast.error(err instanceof Error ? err.message : "评分请求失败");
    }
  }, [selectedSubResume, workspace]);

  if (wsLoading) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        加载中...
      </div>
    );
  }

  if (!workspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-4">
        <Inbox
          className="w-16 h-16 text-muted-foreground/40"
          strokeWidth={1.5}
        />
        <div className="text-center">
          <p className="text-lg text-foreground mb-1">工作空间不存在</p>
          <p className="text-sm text-muted-foreground">
            访问的工作空间可能已被删除或不存在
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate("/workspace")}
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
      <div className="flex items-center justify-center h-full text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex flex-col absolute inset-0">
      {/* Top: Breadcrumb Navigation */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-border shrink-0 bg-background">
        <nav className="flex items-center gap-2 text-xs">
          <button
            type="button"
            onClick={() => navigate("/workspace")}
            className="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-3 h-3" />
            工作空间
          </button>
          <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
          <span className="text-muted-foreground">{workspace!.title}</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
          <span className="text-foreground font-medium">
            {selectedSubResume?.jobTitle ||
              selectedSubResume?.title ||
              "未选择"}
          </span>
          {selectedSubResume?.matchScore != null && (
            <span
              className={`${selectedSubResume.matchScore >= 85 ? "text-green-600" : "text-muted-foreground"} font-medium`}
            >
              {selectedSubResume.matchScore}%
            </span>
          )}
        </nav>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Integrated Sub-resume Navigation Panel */}
        <WorkspaceSidebar
          workspace={workspace!}
          sections={sections}
          subResumes={subResumes}
          selectedSubResumeId={selectedSubResumeId}
          onSelectSubResume={(subResumeId) => {
            navigate(`/workspace/${id}/resumes/${subResumeId}/${activeTab}`, {
              replace: true,
            });
          }}
          onCreateNew={() => setShowGenerateModal(true)}
          onViewDetails={() =>
            navigate(`/workspace/${workspace!.id}/template/edit`)
          }
          collapsed={sidebarCollapsed}
          onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
          loading={subResumesLoading}
        />

        {/* Right: Tabs + Content */}
        <div className="flex-1 min-w-0 flex flex-col h-full bg-background">
          {/* Tabs with action buttons */}
          <WorkspaceTabs
            activeTab={activeTab}
            onTabChange={handleTabChange}
            onEdit={() => {
              if (!selectedSubResume || !workspace) return;
              navigate(
                `/workspace/${workspace.id}/resumes/${selectedSubResume.id}/edit`,
              );
            }}
            onDelete={() => {
              if (!selectedSubResume) return;
              setConfirmDeleteResumeId(selectedSubResume.id);
            }}
          />

          {/* Tab Content */}
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 py-4 min-h-0">
            {activeTab === "overview" && (
              <OverviewTab
                analyses={selectedAnalyses}
                subResumeId={selectedSubResumeId || ""}
                onViewInterview={(collectionId) => {
                  if (selectedSubResumeId) {
                    navigate(
                      `/workspace/${id}/resumes/${selectedSubResumeId}/interview${collectionId ? `?activate=${collectionId}` : ""}`,
                      { replace: true },
                    );
                  }
                }}
              />
            )}
            {activeTab === "jd" && (
              <JDAnalysisTab
                analyses={selectedAnalyses}
                selectedId={selectedAnalysisId}
                onSelectAnalysis={handleSelectAnalysis}
                onStartScoring={handleScoreJD}
              />
            )}
            {activeTab === "interview" && selectedSubResumeId && (
              <InterviewTab
                subResumeId={selectedSubResumeId}
                subResumeTitle={selectedSubResume?.title}
                selectedCollectionId={selectedCollectionId}
                onSelectCollection={handleSelectCollection}
              />
            )}
            {activeTab === "meta" && selectedSubResume && (
              <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card">
                <div className="flex items-center justify-between gap-4 border-b border-border px-5 py-4">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold text-foreground">
                      元数据
                    </h2>
                    <p className="mt-1 text-xs text-muted-foreground">
                      编辑子简历名称、目标岗位和 JD
                      原文；保存后仅更新当前子简历信息。
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    {isMetaDirty && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditTitle(selectedSubResume.title || "");
                          setEditJobTitle(selectedSubResume.jobTitle || "");
                          setEditJobDescription(
                            selectedSubResume.jobDescription || "",
                          );
                        }}
                        className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-2 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        还原
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={async () => {
                        if (!editJobDescription.trim() || !selectedSubResume)
                          return;
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
                          toast.success("子简历信息已更新");
                          refreshSubResumes();
                        } catch (err: any) {
                          toast.error(err.message || "更新子简历失败");
                        } finally {
                          setIsSubmittingMeta(false);
                        }
                      }}
                      disabled={
                        !editJobDescription.trim() ||
                        isSubmittingMeta ||
                        !isMetaDirty
                      }
                      className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
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

                <div className="grid gap-4 border-b border-border px-5 py-4 lg:grid-cols-[minmax(220px,1fr)_minmax(220px,1fr)_220px]">
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      简历名称
                    </label>
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div>
                    <label className="mb-1.5 block text-xs font-medium text-muted-foreground">
                      岗位名称{" "}
                      <span className="font-normal text-muted-foreground/60">
                        (选填)
                      </span>
                    </label>
                    <input
                      type="text"
                      value={editJobTitle}
                      onChange={(e) => setEditJobTitle(e.target.value)}
                      className="w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    />
                  </div>
                  <div className="rounded-lg border border-border bg-background px-3 py-2">
                    <div className="text-[10px] text-muted-foreground">
                      编辑状态
                    </div>
                    <div className="mt-1 text-xs font-medium text-foreground">
                      {isMetaDirty ? "有未保存修改" : "已同步"}
                    </div>
                  </div>
                </div>

                <div className="flex min-h-0 flex-1 flex-col px-5 py-4">
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-medium text-muted-foreground">
                      JD 描述 <span className="text-red-400">*</span>
                    </label>
                    <span className="text-[11px] text-muted-foreground">
                      {editJobDescription.length > 0
                        ? `${editJobDescription.length} 字 · 用于 JD 分析、匹配评分和子简历生成`
                        : "必填 · 用于 JD 分析、匹配评分和子简历生成"}
                    </span>
                  </div>
                  <textarea
                    value={editJobDescription}
                    onChange={(e) => setEditJobDescription(e.target.value)}
                    className="min-h-[360px] flex-1 resize-none rounded-lg border border-input bg-background px-3 py-3 text-sm leading-relaxed text-foreground focus:border-primary/50 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <GenerateForPositionModal
        open={showGenerateModal}
        onClose={() => setShowGenerateModal(false)}
        onSubmit={async (payload) => {
          try {
            const config = await getProviderConfig();
            const activeConfig = config.providers[config.active];
            if (
              !activeConfig?.apiKey ||
              !activeConfig?.baseUrl ||
              !activeConfig?.model
            ) {
              toast.error("请先在设置中配置 AI 提供商");
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
            const title = payload.name || payload.jobTitle || "";
            setShowGenerateModal(false);
            markUnread();
            addNotificationTask({
              id: taskId,
              taskType: "jd_generate",
              status: "running",
              workspaceId: workspace!.id,
              metaInfo: { title },
              errorMessage: null,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
            });
            toast.success(
              <div className="flex flex-col gap-1">
                <span className="font-medium text-sm">
                  AI 子简历生成任务已启动
                </span>
                {title && (
                  <span className="text-xs text-muted-foreground truncate">
                    「{title}」正在生成中
                  </span>
                )}
              </div>,
            );
          } catch (err: any) {
            toast.error(err.message || "AI 生成请求失败");
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
            toast.success("子简历创建成功");
            setShowGenerateModal(false);

            const data = await fetchResumeDetail(workspace!.id);
            const subs: SubResume[] = (data.subResumes || []).map(
              (sub: any) => ({
                id: sub.id,
                title: sub.title,
                jobTitle: sub.metaInfo?.job_title,
                jobDescription: sub.metaInfo?.job_description,
                createdAt: sub.createdAt,
                updatedAt: sub.updatedAt,
              }),
            );
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
              navigate(
                `/workspace/${id}/resumes/${subs[0].id}/${DEFAULT_TAB}`,
                { replace: true },
              );
            }
            refreshWorkspaces();
          } catch {
            toast.error("创建子简历失败");
          }
        }}
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
            toast.success("子简历已删除");
            setConfirmDeleteResumeId(null);
            refreshSubResumes();
          } catch (err: any) {
            toast.error(err.message || "删除失败");
          }
        }}
        onCancel={() => setConfirmDeleteResumeId(null)}
      />
    </div>
  );
}
