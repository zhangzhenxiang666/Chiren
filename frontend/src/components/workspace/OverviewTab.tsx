import { useMemo, useEffect } from "react";
import {
  FileText,
  Users,
  CheckCircle2,
  AlertCircle,
  Star,
  ChevronRight,
  Clock,
  Key,
  Pencil,
  Lightbulb,
} from "lucide-react";
import type { JdAnalysis } from "../../types/workspace";
import { getScoreColorClass, fmtDateTime } from "../../lib/resume-insights";
import { enrichJdAnalysis } from "../../lib/jd-analysis-adapter";
import { useInterviewStore } from "@/stores/interview-store";
import type { InterviewStatus } from "@/types/interview";

interface OverviewTabProps {
  analyses: JdAnalysis[];
  subResumeId: string;
  onViewInterview: () => void;
}

// Helper to render lucide icons for suggestions based on type
const getSuggestionIcon = (type: string): any => {
  switch (type) {
    case "keyword_add":
      return <Key className="w-3 h-3 text-muted-foreground" />;
    case "wording":
      return <Pencil className="w-3 h-3 text-muted-foreground" />;
    default:
      return <Lightbulb className="w-3 h-3 text-muted-foreground" />;
  }
};

export default function OverviewTab({
  analyses,
  subResumeId,
  onViewInterview,
}: OverviewTabProps) {
  const currentAnalysis = useMemo(() => {
    if (!analyses.length) return null;
    const latest = analyses[0];
    return enrichJdAnalysis(latest);
  }, [analyses]);

  const keywordMatchesArr = useMemo(() => {
    if (!currentAnalysis?.keywordMatches) return [];
    return Array.isArray(currentAnalysis.keywordMatches) &&
      typeof currentAnalysis.keywordMatches[0] === "object"
      ? (currentAnalysis.keywordMatches as any[])
      : [];
  }, [currentAnalysis]);

  const partialMatchesArr = useMemo(() => {
    return currentAnalysis?.partialMatches || [];
  }, [currentAnalysis]);

  const missingKeywordsArr = useMemo(() => {
    if (!currentAnalysis?.missingKeywords) return [];
    return Array.isArray(currentAnalysis.missingKeywords) &&
      typeof currentAnalysis.missingKeywords[0] === "object"
      ? (currentAnalysis.missingKeywords as any[])
      : [];
  }, [currentAnalysis]);

  const skillMatchesArr = useMemo(() => {
    return currentAnalysis?.skillMatches || [];
  }, [currentAnalysis]);

  const strengthsArr = useMemo(() => {
    return currentAnalysis?.strengths || [];
  }, [currentAnalysis]);

  const suggestionsArr = useMemo(() => {
    return (currentAnalysis?.suggestions as any[]) || [];
  }, [currentAnalysis]);

  const historyAnalyses = useMemo(() => {
    return analyses.map((a, idx) => ({
      ...a,
      version: a.version || analyses.length - idx,
      isLatest: idx === 0,
    }));
  }, [analyses]);

  const scoreColor = currentAnalysis
    ? getScoreColorClass(currentAnalysis.overallScore)
    : null;

  const interviewCollections = useInterviewStore((s) => s.collections);
  const fetchCollections = useInterviewStore((s) => s.fetchCollections);

  useEffect(() => {
    if (subResumeId) {
      fetchCollections(subResumeId);
    }
  }, [subResumeId, fetchCollections]);

  const getStatusColor = (status: InterviewStatus): string => {
    const colors: Record<InterviewStatus, string> = {
      completed: "text-green-400 bg-green-500/10 border border-green-500/20",
      in_progress: "text-blue-400 bg-blue-500/10 border border-blue-500/20",
      not_started: "text-muted-foreground bg-muted/30 border border-border",
    };
    return colors[status] || colors.not_started;
  };

  const getStatusLabel = (status: InterviewStatus): string => {
    const labels: Record<InterviewStatus, string> = {
      completed: "已完成",
      in_progress: "进行中",
      not_started: "待开始",
    };
    return labels[status] || status;
  };

  return (
    <div className="flex gap-3 fade-in min-w-0">
      <div className="flex-1 space-y-3 min-w-0">
        <div className="rounded-lg border border-border p-4 bg-card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xs font-semibold flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-muted-foreground" />
              JD 匹配概览
              {currentAnalysis && (
                <span className="text-muted-foreground font-normal">
                  (v{currentAnalysis.version})
                </span>
              )}
            </h3>
            {currentAnalysis && (
              <span className="text-[10px] text-muted-foreground">
                {fmtDateTime(currentAnalysis.createdAt)}
              </span>
            )}
          </div>

          {currentAnalysis ? (
            <div className="flex items-center gap-5">
              <div className="relative w-20 h-20 shrink-0">
                <svg className="w-20 h-20" viewBox="0 0 100 100">
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="rgba(255,255,255,0.06)"
                    strokeWidth="8"
                  />
                  <circle
                    cx="50"
                    cy="50"
                    r="42"
                    fill="none"
                    stroke="url(#ovGrad)"
                    strokeWidth="8"
                    strokeDasharray="264"
                    strokeDashoffset={
                      264 * (1 - currentAnalysis.overallScore / 100)
                    }
                    strokeLinecap="round"
                    style={{
                      transform: "rotate(-90deg)",
                      transformOrigin: "50% 50%",
                      transition: "stroke-dashoffset 1s ease",
                    }}
                  />
                  <defs>
                    <linearGradient
                      id="ovGrad"
                      x1="0%"
                      y1="0%"
                      x2="100%"
                      y2="100%"
                    >
                      <stop offset="0%" stopColor="#ec4899" />
                      <stop offset="100%" stopColor="#f472b6" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className={`text-lg font-bold ${scoreColor?.text}`}>
                    {currentAnalysis.overallScore}
                  </span>
                  <span className="text-[9px] text-muted-foreground">匹配</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    匹配项
                  </span>
                  <span className="text-xs font-bold text-green-400">
                    {keywordMatchesArr.length}
                    <span className="text-[10px] text-muted-foreground font-normal">
                      /{currentAnalysis.totalRequirements || 20}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    部分匹配
                  </span>
                  <span className="text-xs font-bold text-yellow-400">
                    {partialMatchesArr.length}
                    <span className="text-[10px] text-muted-foreground font-normal">
                      /{currentAnalysis.totalRequirements || 20}
                    </span>
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-muted-foreground">
                    缺失
                  </span>
                  <span className="text-xs font-bold text-red-400">
                    {missingKeywordsArr.length}
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
              <Star className="w-8 h-8 opacity-20" />
              <p className="text-xs">暂无评分数据</p>
              <p className="text-[10px] opacity-60">请先对子简历进行 JD 评分</p>
            </div>
          )}
        </div>

        <div className="rounded-lg border border-border p-4 bg-card">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <CheckCircle2 className="w-3.5 h-3.5 text-green-400" />
            核心优势
          </h3>
          {strengthsArr.length > 0 ? (
            <div className="space-y-2">
              {strengthsArr.map((s, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-400 shrink-0 mt-0.5" />
                  <span className="text-[10px] text-foreground break-all">
                    {s.description}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground opacity-60">
              暂无优势分析
            </p>
          )}
        </div>

        <div className="rounded-lg border border-border p-4 bg-card">
          <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5 text-yellow-400" />
            关键技能匹配
          </h3>
          {skillMatchesArr.length > 0 ? (
            <div className="space-y-2">
              {skillMatchesArr.map((s, idx) => {
                const c = getScoreColorClass(s.matchScore);
                return (
                  <div key={idx}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] break-all">{s.skill}</span>
                      <span className={`text-[10px] font-bold ${c.text}`}>
                        {s.matchScore}%
                      </span>
                    </div>
                    <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                      <div
                        className={`h-full bg-gradient-to-r ${c.barFrom} ${c.barTo} rounded-full transition-all duration-700`}
                        style={{ width: `${s.matchScore}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[10px] text-muted-foreground opacity-60">
              暂无技能匹配数据
            </p>
          )}
        </div>

        {suggestionsArr.length > 0 && (
          <div className="rounded-lg border border-border p-4 bg-card">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-yellow-400" />
              改进建议
            </h3>
            <div className="space-y-2">
              {suggestionsArr.slice(0, 3).map((s, idx) => (
                <div
                  key={idx}
                  className="flex items-start gap-2 text-[10px]"
                  style={{
                    borderLeft: `3px solid ${s.priority === "high" ? "#ef4444" : s.priority === "medium" ? "#facc15" : "#22c55e"}`,
                    paddingLeft: 8,
                  }}
                >
                  <span className="text-muted-foreground shrink-0">
                    {getSuggestionIcon(s.type)}
                  </span>
                  <span className="text-muted-foreground break-all">
                    {s.rationale}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {historyAnalyses.length > 0 && (
          <div className="rounded-lg border border-border p-4 bg-card">
            <h3 className="text-xs font-semibold mb-3 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-muted-foreground" />
              JD 分析历史
            </h3>
            <div className="space-y-1">
              {historyAnalyses.map((h) => {
                const c = getScoreColorClass(h.overallScore);
                return (
                  <div
                    key={h.id}
                    className={`flex items-center justify-between py-2 px-2.5 rounded ${h.isLatest ? "bg-white/[0.02]" : ""}`}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground">
                        v{h.version}
                      </span>
                      {h.isLatest && (
                        <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/10 text-green-400">
                          最新
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      {fmtDateTime(h.createdAt)}
                    </span>
                    <span className={`text-xs font-bold ${c.text}`}>
                      {h.overallScore}%
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="w-[320px] shrink-0 space-y-3">
        {interviewCollections.length > 0 ? (
          <div className="rounded-lg border border-border p-4 bg-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-muted-foreground" />
                面试方案
              </h3>
              <button
                onClick={onViewInterview}
                className="flex items-center gap-1 px-2 py-1 rounded border border-border text-[9px] text-muted-foreground hover:text-foreground transition-all"
              >
                查看全部
                <ChevronRight className="w-2.5 h-2.5" />
              </button>
            </div>

            <div className="space-y-2">
              {interviewCollections.map((col) => {
                const completedCount = col.rounds.filter(
                  (r) => r.status === "completed",
                ).length;
                return (
                  <div
                    key={col.id}
                    className="rounded-lg border border-border p-2.5 cursor-pointer hover:bg-white/[0.02] transition-all"
                    onClick={onViewInterview}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <span className="text-[10px] font-medium">
                        {col.name}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] ${getStatusColor(col.status)}`}
                      >
                        {getStatusLabel(col.status)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-[9px] text-muted-foreground">
                      <span>
                        {completedCount}/{col.rounds.length} ·{" "}
                        {col.rounds.length} 轮面试
                      </span>
                      <span>{fmtDateTime(col.createdAt)}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="rounded-lg border border-border p-4 bg-card">
            <div className="flex flex-col items-center justify-center py-6 text-muted-foreground gap-2">
              <Users className="w-8 h-8 opacity-20" />
              <p className="text-xs">暂无面试方案</p>
              <p className="text-[10px] opacity-60">前往面试模块创建方案</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
