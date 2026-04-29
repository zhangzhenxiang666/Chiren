import { useEffect, useState, useCallback } from "react";
import {
  CheckCircle2,
  Circle,
  Plus,
  Play,
  ChevronDown,
  ChevronRight,
  Pencil,
  Brain,
  Loader2,
  FileText,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useParams } from "react-router-dom";
import { useInterviewStore } from "@/stores/interview-store";
import type {
  InterviewCollectionDetail,
  InterviewRound,
  InterviewRoundDraft,
  UpdateInterviewRoundParams,
} from "@/types/interview";
import {
  getProviderConfig,
  regenerateCollectionSummary,
  checkRunningCollectionSummaryTask,
} from "@/lib/api";
import { addNotificationTask, markUnread } from "@/lib/notification";
import type { ProviderConfig } from "@/lib/api";
import CreateInterviewModal from "./interview/CreateInterviewModal";
import AddRoundModal from "./interview/AddRoundModal";
import { Timeline, TimelineItem } from "@/components/ui/Timeline";
import { getScoreColorClass } from "../../lib/resume-insights";

interface InterviewTabProps {
  subResumeId: string;
  subResumeTitle?: string;
  selectedCollectionId?: string;
  onSelectCollection?: (collectionId: string) => void;
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    completed:
      "text-green-700 dark:text-green-300 bg-green-100 dark:bg-green-500/15 border border-green-300 dark:border-green-500/30",
    in_progress: "text-blue-400 bg-blue-500/10 border border-blue-500/20",
    not_started: "text-muted-foreground bg-muted/30 border border-border",
  };
  return colors[status] || colors.not_started;
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: "已完成",
    in_progress: "进行中",
    not_started: "待开始",
  };
  return labels[status] || status;
}

function RoundStatusIcon({ status }: { status: string }) {
  if (status === "completed") {
    return <CheckCircle2 className="w-3 h-3 text-green-500" strokeWidth={3} />;
  }
  if (status === "in_progress") {
    return (
      <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-card" />
    );
  }
  return <Circle className="w-3 h-3 text-border" strokeWidth={3} />;
}

interface CollectionSummaryData {
  overall_score: number;
  overall_assessment: string;
  round_summaries: Array<{
    round_id: string;
    round_name: string;
    interviewer_name: string;
    interviewer_title: string;
    score: number;
    key_points: string[];
  }>;
  key_strengths: string[];
  key_weaknesses: string[];
  dimension_breakdown: Array<{
    dimension: string;
    score: number;
    comment: string;
  }>;
  recommendation: string;
  risk_flags: string[];
  generated_at: string;
}

function CollectionCard({
  collection,
  workspaceId,
  subResumeId,
  isSelected,
  isExpanded,
  onSelect,
  onToggleExpand,
}: {
  collection: InterviewCollectionDetail;
  workspaceId: string;
  subResumeId: string;
  isSelected: boolean;
  isExpanded: boolean;
  onSelect: (collectionId: string) => void;
  onToggleExpand: (collectionId: string) => void;
}) {
  const navigate = useNavigate();
  const createRound = useInterviewStore((s) => s.createRound);
  const updateRound = useInterviewStore((s) => s.updateRound);

  const [showAddRound, setShowAddRound] = useState(false);
  const [editingRound, setEditingRound] = useState<InterviewRound | null>(null);
  const [isGeneratingCollectionSummary, setIsGeneratingCollectionSummary] =
    useState(false);
  const [collectionSummaryTaskId, setCollectionSummaryTaskId] = useState<
    string | null
  >(null);
  const [showCollectionSummaryModal, setShowCollectionSummaryModal] =
    useState(false);
  const [providerConfig, setProviderConfig] = useState<ProviderConfig | null>(
    null,
  );

  useEffect(() => {
    getProviderConfig()
      .then(setProviderConfig)
      .catch(() => {});
  }, []);

  const collectionSummary = (
    collection.metaInfo as Record<string, unknown> | undefined
  )?.collection_summary as CollectionSummaryData | undefined;

  const handleGenerateCollectionSummary = async () => {
    if (!providerConfig) return;

    const existing = await checkRunningCollectionSummaryTask(collection.id);
    if (existing) {
      setCollectionSummaryTaskId(existing.taskId);
      toast.error("该集合已有正在进行的总结生成任务");
      return;
    }

    setIsGeneratingCollectionSummary(true);
    try {
      const active = providerConfig.active;
      const cfg = providerConfig.providers[active];
      const { taskId } = await regenerateCollectionSummary({
        collectionId: collection.id,
        type: active,
        apiKey: cfg.apiKey,
        baseUrl: cfg.baseUrl,
        model: cfg.model,
      });

      markUnread();
      addNotificationTask({
        id: taskId,
        taskType: "collection_summary",
        status: "running",
        metaInfo: {
          title: collection.name || "",
          fileName: collection.id,
        },
        errorMessage: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });

      setCollectionSummaryTaskId(taskId);
      toast.success("集合总结生成已开始");
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "生成集合总结失败");
    } finally {
      setIsGeneratingCollectionSummary(false);
    }
  };

  const sortedRounds = [...collection.rounds].sort(
    (a, b) => a.sortOrder - b.sortOrder,
  );
  const completedCount = sortedRounds.filter(
    (r) => r.status === "completed",
  ).length;
  const progressPercent =
    sortedRounds.length > 0 ? (completedCount / sortedRounds.length) * 100 : 0;

  const canStartRound = (round: InterviewRound, index: number): boolean => {
    if (round.status !== "not_started") return false;
    for (let i = 0; i < index; i++) {
      if (sortedRounds[i].status !== "completed") return false;
    }
    const hasInProgress = sortedRounds.some((r) => r.status === "in_progress");
    return !hasInProgress;
  };

  const handleStartRound = (e: React.MouseEvent, round: InterviewRound) => {
    e.stopPropagation();
    navigate(
      `/workspace/${workspaceId}/resumes/${subResumeId}/interview/${collection.id}/${round.id}`,
    );
  };

  const handleEnterInterview = (e: React.MouseEvent, round: InterviewRound) => {
    e.stopPropagation();
    navigate(
      `/workspace/${workspaceId}/resumes/${subResumeId}/interview/${collection.id}/${round.id}`,
    );
  };

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation();
    onToggleExpand(collection.id);
  };

  const handleHeaderClick = () => {
    onSelect(collection.id);
  };

  const nextSortOrder =
    sortedRounds.length > 0
      ? Math.max(...sortedRounds.map((r) => r.sortOrder)) + 1
      : 0;

  const canAddRound = collection.status !== "completed";

  return (
    <div
      className={`rounded-xl border border-border bg-card overflow-hidden transition-all ${
        isSelected
          ? "border-pink-400 bg-pink-50/50 dark:bg-pink-500/[0.08] shadow-sm"
          : "hover:border-foreground/30 hover:bg-muted/50"
      }`}
    >
      <div
        onClick={handleHeaderClick}
        className={`p-3 cursor-pointer ${isExpanded ? "border-b border-border" : ""}`}
      >
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={handleToggleExpand}
              className="p-0.5 rounded hover:bg-muted transition-colors text-muted-foreground"
            >
              {isExpanded ? (
                <ChevronDown className="w-3 h-3" />
              ) : (
                <ChevronRight className="w-3 h-3" />
              )}
            </button>
            <h3 className="text-xs font-semibold">{collection.name}</h3>
            <span
              className={`px-1.5 py-0.5 rounded text-[9px] ${getStatusColor(collection.status)}`}
            >
              {getStatusLabel(collection.status)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex-1 h-1 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-pink-500 to-pink-400 rounded-full transition-all"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {completedCount}/{sortedRounds.length}
          </span>
        </div>
      </div>

      {isExpanded && (
        <div className="p-3">
          {sortedRounds.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">
              暂无面试轮次
            </p>
          ) : (
            <Timeline>
              {sortedRounds.map((round, index) => (
                <TimelineItem
                  key={round.id}
                  icon={<RoundStatusIcon status={round.status} />}
                >
                  <div className="flex items-center justify-between mb-1">
                    <div>
                      <span className="text-xs font-medium">{round.name}</span>
                      {round.interviewerTitle && (
                        <span className="text-[10px] text-muted-foreground ml-2">
                          {round.interviewerName} · {round.interviewerTitle}
                        </span>
                      )}
                      {!round.interviewerTitle && round.interviewerName && (
                        <span className="text-[10px] text-muted-foreground ml-2">
                          {round.interviewerName}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {round.status === "not_started" && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setEditingRound(round);
                          }}
                          className="p-1 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                          title="编辑轮次"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      <span
                        className={`text-[9px] px-1.5 py-0.5 rounded ${getStatusColor(round.status)}`}
                      >
                        {getStatusLabel(round.status)}
                      </span>
                    </div>
                  </div>

                  {round.interviewerBio && (
                    <div className="text-[10px] text-muted-foreground mb-1 line-clamp-1">
                      {round.interviewerBio}
                    </div>
                  )}

                  <div className="flex items-center gap-2 mt-2">
                    {canStartRound(round, index) && (
                      <button
                        type="button"
                        onClick={(e) => handleStartRound(e, round)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-green-100 dark:bg-green-500/15 text-green-700 dark:text-green-300 border border-green-300 dark:border-green-500/30 hover:bg-green-200 dark:hover:bg-green-500/25 transition-colors"
                      >
                        <Play className="w-2.5 h-2.5" />
                        开始面试
                      </button>
                    )}
                    {round.status === "completed" && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(
                            `/workspace/${workspaceId}/resumes/${subResumeId}/interview/${collection.id}/${round.id}`,
                          );
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-muted/50 border border-border text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                      >
                        查看详情
                      </button>
                    )}
                    {round.status === "in_progress" && (
                      <button
                        type="button"
                        onClick={(e) => handleEnterInterview(e, round)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-500/30 hover:bg-blue-200 dark:hover:bg-blue-500/25 transition-colors"
                      >
                        <Play className="w-2.5 h-2.5" />
                        进入面试
                      </button>
                    )}
                  </div>
                </TimelineItem>
              ))}
            </Timeline>
          )}

          {canAddRound && (
            <button
              type="button"
              onClick={() => setShowAddRound(true)}
              className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-dashed border-border text-[10px] bg-muted/70 text-foreground hover:bg-muted hover:border-foreground/20 transition-colors w-full justify-center"
            >
              <Plus className="w-3 h-3" />
              添加轮次
            </button>
          )}

          {collection.status === "completed" && (
            <div className="mt-3 pt-3 border-t border-border">
              {collectionSummary ? (
                <button
                  type="button"
                  onClick={() => setShowCollectionSummaryModal(true)}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border text-[11px] bg-muted/70 text-foreground hover:bg-muted transition-colors"
                >
                  <FileText className="w-3 h-3" />
                  查看集合总结
                </button>
              ) : collectionSummaryTaskId ? (
                <div className="flex flex-col items-center justify-center gap-2 py-4">
                  <Loader2 className="w-4 h-4 text-pink-400 animate-spin" />
                  <span className="text-[10px] text-muted-foreground">
                    集合总结生成中...
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={handleGenerateCollectionSummary}
                  disabled={isGeneratingCollectionSummary}
                  className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg border border-border text-[11px] bg-muted/70 text-foreground hover:bg-muted transition-colors disabled:opacity-50"
                >
                  {isGeneratingCollectionSummary ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Brain className="w-3.5 h-3.5" />
                  )}
                  {isGeneratingCollectionSummary ? "创建中..." : "生成集合总结"}
                </button>
              )}
            </div>
          )}
        </div>
      )}

      <AddRoundModal
        open={showAddRound}
        onClose={() => setShowAddRound(false)}
        interviewCollectionId={collection.id}
        nextSortOrder={nextSortOrder}
        existingRounds={collection.rounds}
        onSubmit={async (params) => {
          await createRound(params);
          toast.success("轮次添加成功");
        }}
      />

      <AddRoundModal
        open={!!editingRound}
        onClose={() => setEditingRound(null)}
        interviewCollectionId={collection.id}
        nextSortOrder={nextSortOrder}
        initialData={editingRound}
        existingRounds={collection.rounds}
        onSubmit={async (params) => {
          if (params.id) {
            const { interviewCollectionId: _, ...updateData } = params as any;
            await updateRound(updateData as UpdateInterviewRoundParams);
            toast.success("轮次更新成功");
            setEditingRound(null);
          }
        }}
      />

      {showCollectionSummaryModal && collectionSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setShowCollectionSummaryModal(false)}
          />
          <div className="relative w-full max-w-4xl max-h-[90vh] bg-card border border-border rounded-xl overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-border">
              <div>
                <h2 className="text-sm font-semibold">{collection.name}</h2>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  面试集合总结
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCollectionSummaryModal(false)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto max-h-[calc(90vh-57px)] p-5 space-y-4">

              <div className="flex items-center gap-5 pb-4 border-b border-border">
                <div className="shrink-0 text-center">
                  <div className="text-3xl font-bold text-foreground">
                    {collectionSummary.overall_score}
                  </div>
                  <div className="text-[9px] text-muted-foreground mt-0.5">
                    综合评分 / 100
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-[10px] text-muted-foreground">
                      录用建议
                    </span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        collectionSummary.recommendation === "strong_hire" ||
                        collectionSummary.recommendation === "hire"
                          ? "text-green-600 dark:text-green-400 border border-green-300 dark:border-green-500/30"
                          : collectionSummary.recommendation === "neutral"
                            ? "text-yellow-600 dark:text-yellow-400 border border-yellow-300 dark:border-yellow-500/30"
                            : "text-red-600 dark:text-red-400 border border-red-300 dark:border-red-500/30"
                      }`}
                    >
                      {collectionSummary.recommendation === "strong_hire"
                        ? "强烈推荐"
                        : collectionSummary.recommendation === "hire"
                          ? "推荐录用"
                          : collectionSummary.recommendation === "neutral"
                            ? "中立"
                            : collectionSummary.recommendation === "no_hire"
                              ? "不推荐"
                              : collectionSummary.recommendation ===
                                  "strong_no_hire"
                                ? "强烈不推荐"
                                : collectionSummary.recommendation}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-3">
                    {collectionSummary.overall_assessment}
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                {collectionSummary.key_strengths.length > 0 && (
                  <div className="border border-border rounded-lg p-3 border-l-2 border-l-green-500">
                    <span className="text-[10px] font-semibold text-green-600 dark:text-green-400">
                      核心优势
                    </span>
                    <ul className="mt-2 space-y-1">
                      {collectionSummary.key_strengths.map((s, i) => (
                        <li key={i} className="text-[10px] text-muted-foreground">
                          {s}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {collectionSummary.key_weaknesses.length > 0 && (
                  <div className="border border-border rounded-lg p-3 border-l-2 border-l-yellow-500">
                    <span className="text-[10px] font-semibold text-yellow-600 dark:text-yellow-400">
                      核心短板
                    </span>
                    <ul className="mt-2 space-y-1">
                      {collectionSummary.key_weaknesses.map((w, i) => (
                        <li key={i} className="text-[10px] text-muted-foreground">
                          {w}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              {collectionSummary.dimension_breakdown.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    能力维度评分
                  </span>
                  <div className="mt-2 space-y-2">
                    {collectionSummary.dimension_breakdown.map((d, i) => {
                      const dc = getScoreColorClass(d.score);
                      return (
                      <div key={i} className="flex items-center gap-3">
                        <span className="text-[10px] text-muted-foreground w-24 shrink-0 truncate">
                          {d.dimension}
                        </span>
                        <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all bg-gradient-to-r ${dc.barFrom} ${dc.barTo}`}
                            style={{ width: `${d.score}%` }}
                          />
                        </div>
                        <span className={`text-[10px] font-medium w-6 text-right tabular-nums ${dc.text}`}>
                          {d.score}
                        </span>
                      </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {collectionSummary.risk_flags.length > 0 && (
                <div className="border border-border rounded-lg p-3 border-l-2 border-l-red-500">
                  <span className="text-[10px] font-semibold text-red-600 dark:text-red-400">
                    风险提示
                  </span>
                  <ul className="mt-2 space-y-1">
                    {collectionSummary.risk_flags.map((r, i) => (
                      <li key={i} className="text-[10px] text-muted-foreground flex items-start gap-1.5">
                        <span className="w-1 h-1 rounded-full bg-red-400 mt-1.5 shrink-0" />
                        {r}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {collectionSummary.round_summaries.length > 0 && (
                <div>
                  <span className="text-[10px] font-semibold text-muted-foreground">
                    各轮次参引
                  </span>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    {collectionSummary.round_summaries.map((rs, i) => (
                      <div
                        key={i}
                        className="border border-border rounded-lg p-3"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-[10px] font-medium">
                            {rs.round_name}
                          </span>
                          <span className="text-[10px] font-semibold tabular-nums">
                            {rs.score}
                          </span>
                        </div>
                        <div className="text-[9px] text-muted-foreground">
                          {rs.interviewer_name} · {rs.interviewer_title}
                        </div>
                        {rs.key_points.length > 0 && (
                          <ul className="mt-1.5 space-y-0.5">
                            {rs.key_points.map((p, j) => (
                              <li
                                key={j}
                                className="text-[9px] text-muted-foreground"
                              >
                                · {p}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function InterviewTab({
  subResumeId,
  subResumeTitle: _subResumeTitle,
  selectedCollectionId,
  onSelectCollection,
}: InterviewTabProps) {
  const { id: workspaceId } = useParams<{ id: string }>();
  const collections = useInterviewStore((s) => s.collections);
  const loading = useInterviewStore((s) => s.loading);
  const error = useInterviewStore((s) => s.error);
  const fetchCollections = useInterviewStore((s) => s.fetchCollections);
  const createCollectionWithRounds = useInterviewStore(
    (s) => s.createCollectionWithRounds,
  );
  const clearError = useInterviewStore((s) => s.clearError);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const handleToggleExpand = useCallback((collectionId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(collectionId)) {
        next.delete(collectionId);
      } else {
        next.add(collectionId);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    fetchCollections(subResumeId);
  }, [subResumeId, fetchCollections]);

  useEffect(() => {
    if (error) {
      toast.error(error);
      clearError();
    }
  }, [error, clearError]);

  useEffect(() => {
    if (selectedCollectionId) {
      setExpandedIds((prev) => {
        const next = new Set(prev);
        next.add(selectedCollectionId);
        return next;
      });
    }
  }, [selectedCollectionId]);

  if (loading && collections.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        加载中...
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold">面试方案</span>
          <span className="text-[10px] text-muted-foreground">
            {collections.length} 个方案
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-muted/70 text-foreground border border-border text-xs hover:bg-muted transition-colors"
        >
          <Plus className="w-3 h-3" />
          创建方案
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
          <p className="text-xs">暂无面试方案</p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-3 py-1.5 rounded-lg bg-muted/70 text-foreground border border-border text-xs hover:bg-muted transition-colors"
          >
            创建第一个面试方案
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-2 pr-1">
          {collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              workspaceId={workspaceId || ""}
              subResumeId={subResumeId}
              isSelected={collection.id === selectedCollectionId}
              isExpanded={expandedIds.has(collection.id)}
              onSelect={(id) => onSelectCollection?.(id)}
              onToggleExpand={handleToggleExpand}
            />
          ))}
        </div>
      )}

      <CreateInterviewModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={async (name, rounds: InterviewRoundDraft[]) => {
          await createCollectionWithRounds({
            name,
            subResumeId,
            rounds,
          });
          toast.success("面试方案创建成功");
        }}
      />
    </div>
  );
}
