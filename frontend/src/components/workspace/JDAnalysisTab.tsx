import { useState, useMemo } from 'react';
import type { ReactNode } from 'react';
import {
  Square,
  Lightbulb,
  Zap,
  Target,
  BarChart2,
  Award,
  GraduationCap,
  Star,
  FileText,
  Pencil,
  Key,
  Ruler,
  Building,
  Minus,
  Info,
  Check,
  // keep existing ones
  RefreshCw,
} from 'lucide-react';
import type { JdAnalysis, JdRequirement } from '../../types/workspace';
import { getScoreColorClass, fmtDateTime } from '../../lib/resume-insights';
import { enrichJdAnalysisList } from '../../lib/jd-analysis-adapter';

interface JDAnalysisTabProps {
  analyses: JdAnalysis[];
  onStartScoring?: () => void;
}

type KeywordTab = 'matched' | 'partial' | 'missing';

export default function JDAnalysisTab({ analyses, onStartScoring }: JDAnalysisTabProps) {
  const enrichedList = useMemo(() => enrichJdAnalysisList(analyses), [analyses]);
  const [selectedId, setSelectedId] = useState<number>(enrichedList[0]?.id ?? 0);
  const [activeKwTab, setActiveKwTab] = useState<KeywordTab>('matched');

  const record = useMemo(() => enrichedList.find((a) => a.id === selectedId) || enrichedList[0] || null, [enrichedList, selectedId]);

  if (!record) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-muted-foreground gap-2">
        <FileText className="w-12 h-12 opacity-10" />
        <p className="text-sm">暂无 JD 分析记录</p>
        <p className="text-xs opacity-60">请先对子简历进行 JD 评分</p>
        {onStartScoring && (
          <button
            type="button"
            onClick={onStartScoring}
            className="mt-2 inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
          >
            <Star className="w-3 h-3" />
            开始评分
          </button>
        )}
      </div>
    );
  }

  const c = getScoreColorClass(record.overallScore);

  const keywordMatchesArr = Array.isArray(record.keywordMatches) && typeof record.keywordMatches[0] === 'object'
    ? (record.keywordMatches as any[])
    : [];
  const partialMatchesArr = record.partialMatches || [];
  const missingKeywordsArr = Array.isArray(record.missingKeywords) && typeof record.missingKeywords[0] === 'object'
    ? (record.missingKeywords as any[])
    : [];
  const skillMatchesArr = record.skillMatches || [];
  const strengthsArr = record.strengths || [];
  const suggestionsArr = (record.suggestions as any[]) || [];

  const catLabels: Record<string, string> = { required: '必需', preferred: '优先', bonus: '加分' };
  const typeLabels: Record<string, string> = { exact: '精确匹配', synonym: '同义匹配', contextual: '上下文匹配' };
  const typeIcons: Record<string, ReactNode> = {
    content_gap: <FileText className="w-3 h-3" />, 
    wording: <Pencil className="w-3 h-3" />, 
    keyword_add: <Key className="w-3 h-3" />, 
    format: <Ruler className="w-3 h-3" />, 
    structure: <Building className="w-3 h-3" />, 
  };
  const typeNames: Record<string, string> = { content_gap: '内容缺失', wording: '措辞优化', keyword_add: '关键词补充', format: '格式优化', structure: '结构调整' };
  const dimLabels: Record<string, string> = { skills: '技能维度', experience: '经验维度', education: '教育维度' };
  const strengthIcons: Record<string, ReactNode> = {
    skill_match: <Zap className="w-3 h-3" />, 
    experience_match: <Target className="w-3 h-3" />, 
    project_relevance: <BarChart2 className="w-3 h-3" />, 
    certification: <Award className="w-3 h-3" />, 
    education_match: <GraduationCap className="w-3 h-3" />, 
    unique_advantage: <Star className="w-3 h-3" />, 
  };

  const reqCatLabels: Record<JdRequirement['category'], string> = {
    hard_skill: '技术栈', soft_skill: '软技能', tool: '工具/平台',
    domain_knowledge: '领域知识', certification: '证书/资质',
    education: '学历要求', experience: '工作经验', language: '语言能力',
  };
  const reqCatOrder: JdRequirement['category'][] = [
    'hard_skill', 'experience', 'education', 'tool',
    'domain_knowledge', 'certification', 'soft_skill', 'language',
  ];
  const reqImportanceLabels: Record<JdRequirement['importance'], string> = {
    mandatory: '硬性要求', preferred: '优先项', bonus: '加分项',
  };
  const reqImportanceStyles: Record<JdRequirement['importance'], { accentColor: string; bg: string; text: string }> = {
    mandatory: { accentColor: '#ec4899', bg: 'bg-pink-500/[0.06]', text: 'text-pink-300' },
    preferred: { accentColor: '#fbbf24', bg: 'bg-amber-500/[0.06]', text: 'text-amber-300' },
    bonus:    { accentColor: '#94a3b8', bg: 'bg-slate-500/[0.06]', text: 'text-slate-400' },
  };

  const renderImportanceDots = (importance: number, colorClass: string) => {
    return Array.from({ length: 5 }, (_, i) => (
      <span
        key={i}
        className={`inline-block w-1.5 h-1.5 rounded-full mr-0.5 ${i < importance ? colorClass : 'bg-white/10'}`}
      />
    ));
  };

  const renderKeywordContent = () => {
    if (activeKwTab === 'matched') {
      if (!keywordMatchesArr.length) return <div className="text-center py-8 text-muted-foreground text-sm">暂无完全匹配的关键词</div>;
      return keywordMatchesArr.map((item: any, idx: number) => {
        const catClass = item.category === 'required'
          ? 'bg-red-500/10 text-red-400 border-red-500/20'
          : item.category === 'preferred'
            ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
            : 'bg-blue-500/10 text-blue-400 border-blue-500/20';
        return (
          <div key={idx} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
            <div className="flex items-center gap-2 mt-0.5">
              <span className={`text-[10px] px-1.5 py-0.5 rounded border ${catClass}`}>{catLabels[item.category] || item.category}</span>
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-sm font-medium break-all">{item.keyword}</span>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-500/10 text-green-400 shrink-0">{typeLabels[item.matchType] || item.matchType}</span>
              </div>
              <div className="flex items-center gap-1 mb-1">{renderImportanceDots(item.importance, 'text-green-400')}</div>
              {item.evidence && <div className="text-[10px] text-muted-foreground mt-1 break-all"><span className="opacity-60">匹配证据：</span>{item.evidence}</div>}
            </div>
          </div>
        );
      });
    }
    if (activeKwTab === 'partial') {
      if (!partialMatchesArr.length) return <div className="text-center py-8 text-muted-foreground text-sm">暂无部分匹配项</div>;
      return partialMatchesArr.map((item: any, idx: number) => (
        <div key={idx} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
          <div className="mt-0.5 w-5 h-5 rounded-full bg-yellow-500/10 flex items-center justify-center shrink-0">
            <Minus className="w-3 h-3 text-yellow-400" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium mb-1 break-all">{item.keyword}</div>
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-1.5 min-w-0 overflow-x-hidden">
              <span className="break-all min-w-0">简历：<span className="text-yellow-400">{item.resumeLevel}</span></span>
              <span className="break-all min-w-0">JD 要求：<span className="text-foreground">{item.jobLevel}</span></span>
            </div>
            <div className="text-[10px] text-muted-foreground bg-yellow-500/5 border border-yellow-500/10 rounded px-2 py-1.5 break-all">{item.gapDescription}</div>
          </div>
        </div>
      ));
    }
    if (!missingKeywordsArr.length) return <div className="text-center py-8 text-muted-foreground text-sm">暂无缺失关键词</div>;
    return missingKeywordsArr.map((item: any, idx: number) => {
      const catClass = item.category === 'required'
        ? 'bg-red-500/10 text-red-400 border-red-500/20'
        : item.category === 'preferred'
          ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20'
          : 'bg-blue-500/10 text-blue-400 border-blue-500/20';
      return (
        <div key={idx} className="flex items-start gap-3 py-3 border-b border-border/50 last:border-0">
          <div className="flex items-center gap-2 mt-0.5">
            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${catClass}`}>{catLabels[item.category] || item.category}</span>
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-medium mb-1 break-all">{item.keyword}</div>
            <div className="flex items-center gap-1 mb-1">{renderImportanceDots(item.importance, 'text-red-400')}</div>
              {item.suggestion && <div className="text-[10px] text-muted-foreground bg-red-500/5 border border-red-500/10 rounded px-2 py-1.5 break-all"><Lightbulb className="w-3 h-3 inline-block mr-1" /> {item.suggestion}</div>}
          </div>
        </div>
      );
    });
  };

  const getRecordCounts = (a: JdAnalysis) => {
    const kwMatches = Array.isArray(a.keywordMatches) && typeof a.keywordMatches[0] === 'object'
      ? (a.keywordMatches as any[]).length : 0;
    const partialMatches = a.partialMatches ? a.partialMatches.length : 0;
    const missingKw = Array.isArray(a.missingKeywords) && typeof a.missingKeywords[0] === 'object'
      ? (a.missingKeywords as any[]).length : 0;
    return { kwMatches, partialMatches, missingKw };
  };

  return (
      <div className="flex gap-4 h-full overflow-hidden fade-in min-w-0" style={{ minHeight: 0 }}>
        <div className="w-[180px] shrink-0 space-y-3 overflow-y-auto">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold">分析记录</span>
          <span className="text-[10px] text-muted-foreground">{enrichedList.length} 个版本</span>
        </div>
        {onStartScoring && (
          <button
            type="button"
            onClick={onStartScoring}
            className="w-full inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-md text-[11px] bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20 transition-colors"
          >
            <RefreshCw className="w-3 h-3" />
            重新评分
          </button>
        )}
        <div className="space-y-2">
          {enrichedList.map((a) => {
            const sc = getScoreColorClass(a.overallScore);
            const isActive = a.id === selectedId;
            const counts = getRecordCounts(a);
            return (
              <div
                key={a.id}
                onClick={() => setSelectedId(a.id)}
                className={`p-3 rounded-lg border cursor-pointer transition-all ${
                  isActive
                    ? 'border-pink-500/30 bg-pink-500/5'
                    : 'border-border hover:border-border-hover hover:bg-white/[0.02]'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold">v{a.version}</span>
                    {a.id === enrichedList[0]?.id && (
                      <span className="text-[9px] px-1 py-0.5 rounded bg-green-500/10 text-green-400">最新</span>
                    )}
                  </div>
                  <span className={`text-xs font-bold ${sc.text}`}>{a.overallScore}%</span>
                </div>
                <div className="text-[10px] text-muted-foreground mb-2">{fmtDateTime(a.createdAt)}</div>
                <div className="flex items-center gap-2 text-[10px]">
                  <span className="text-green-400">{counts.kwMatches} 匹配</span>
                  <span className="text-yellow-400">{counts.partialMatches} 部分</span>
                  <span className="text-red-400">{counts.missingKw} 缺失</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden" style={{ height: '100%' }}>
        <div className="w-full max-w-full space-y-6 p-6">
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <div className="flex items-start gap-4 min-w-0 overflow-x-hidden">
              <div className="shrink-0">
                <div className="relative w-28 h-28">
                  <svg className="w-28 h-28" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                    <circle
                      cx="50" cy="50" r="42"
                      fill="none"
                      stroke="url(#jdGrad)"
                      strokeWidth="7"
                      strokeDasharray="264"
                      strokeDashoffset={264 * (1 - record.overallScore / 100)}
                      strokeLinecap="round"
                      style={{ filter: 'drop-shadow(0 0 12px rgba(236,72,153,0.4))', transform: 'rotate(-90deg)', transformOrigin: '50% 50%', transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)' }}
                    />
                    <defs>
                      <linearGradient id="jdGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#ec4899" />
                        <stop offset="100%" stopColor="#f472b6" />
                      </linearGradient>
                    </defs>
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-black ${c.text}`}>{record.overallScore}</span>
                    <span className="text-[10px] text-muted-foreground mt-0.5">总体匹配</span>
                  </div>
                </div>
              </div>

              <div className="flex-1 min-w-0 space-y-2.5 pt-1 overflow-x-hidden">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">ATS 兼容性</span>
                  <span className={`text-sm px-3 py-1 rounded-full border ${
                    record.atsScore >= 80 ? 'bg-green-500/10 text-green-400 border-green-500/20' :
                    record.atsScore >= 60 ? 'bg-orange-500/10 text-orange-400 border-orange-500/20' :
                    'bg-red-500/10 text-red-400 border-red-500/20'
                  }`}>
                    {record.atsScore}<span className="text-[10px] text-muted-foreground"> / 100</span>
                  </span>
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-1000"
                    style={{
                      width: `${record.atsScore}%`,
                      background: record.atsScore >= 80
                        ? 'linear-gradient(to right, #22c55e, #4ade80)'
                        : record.atsScore >= 60
                        ? 'linear-gradient(to right, #f97316, #fb923c)'
                        : 'linear-gradient(to right, #ef4444, #f87171)'
                    }}
                  />
                </div>
                <div className="grid grid-cols-2 md:grid-cols-4 text-[10px] text-muted-foreground">
                  <span className="text-left">差</span>
                  <span className="text-center">一般</span>
                  <span className="text-center">良好</span>
                  <span className="text-right">优秀</span>
                </div>
              </div>
            </div>

            <div className="rounded-lg border border-border p-3" style={{ borderLeft: '3px solid #7c3aed' }}>
              <p className="text-sm text-muted-foreground leading-relaxed break-all">{record.summary}</p>
            </div>
            {strengthsArr.length > 0 && (
              <div className="flex flex-wrap gap-1.5 overflow-x-hidden">
                {strengthsArr.slice(0, 6).map((s: any, idx: number) => (
                  <span key={idx} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 whitespace-nowrap max-w-full overflow-hidden text-ellipsis min-w-0">
                    {strengthIcons[s.type] || <Check className="w-3 h-3" />} {s.description}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center justify-between mb-3 min-w-0 overflow-x-hidden">
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <h2 className="text-sm font-semibold break-all min-w-0">职位描述 (JD)</h2>
              </div>
              <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-muted shrink-0">原文</span>
            </div>
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap break-all">{record.jobDescription}</p>
            {Array.isArray(record.jdRequirements) && record.jdRequirements.length > 0 && (() => {
              const reqs = record.jdRequirements as JdRequirement[];
              const grouped = reqCatOrder
                .map((cat) => ({ cat, items: reqs.filter((r) => r.category === cat) }))
                .filter((g) => g.items.length > 0);
              return (
                <>
                  <div className="border-t border-border my-4" />
                  <div className="flex items-center justify-between mb-3 min-w-0 overflow-x-hidden">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-2.5 h-2.5 rounded-full bg-pink-400 shrink-0" />
                      <h3 className="text-sm font-semibold">JD 要求清单</h3>
                    </div>
                    <span className="text-[10px] text-muted-foreground px-2 py-0.5 rounded bg-muted shrink-0">{reqs.length} 项</span>
                  </div>
                  <div className="flex items-center gap-3 mb-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1"><Square className="w-2.5 h-2.5 text-pink-500" /> 硬性要求</span>
                    <span className="flex items-center gap-1"><Square className="w-2.5 h-2.5 text-amber-400" /> 优先项</span>
                    <span className="flex items-center gap-1"><Square className="w-2.5 h-2.5 text-slate-400" /> 加分项</span>
                  </div>
                  <div className="space-y-3">
                    {grouped.map(({ cat, items }) => (
                      <div key={cat}>
                        <div className="text-[10px] text-muted-foreground mb-1.5">
                          {reqCatLabels[cat]}<span className="opacity-50 ml-1">({items.length})</span>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          {items.map((req, i) => {
                            const style = reqImportanceStyles[req.importance];
                            return (
                              <div
                                key={`${cat}-${i}`}
                                className={`group relative rounded-lg ${style.bg} px-2 py-1 transition-colors hover:brightness-125`}
                                style={{ borderLeft: `3px solid ${style.accentColor}` }}
                                title={req.rawText ? `${reqImportanceLabels[req.importance]}\n${req.rawText}` : reqImportanceLabels[req.importance]}
                              >
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[11px] text-foreground leading-tight break-all">{req.name}</span>
                                  {req.level && (
                                    <span className={`text-[9px] ${style.text} opacity-80`}>{req.level}</span>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              );
            })()}
          </div>

          {skillMatchesArr.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <h2 className="text-sm font-semibold mb-4">关键技能匹配度</h2>
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-x-8 gap-y-3">
                {skillMatchesArr.map((s: any, idx: number) => {
                  const sc = getScoreColorClass(s.matchScore);
                  const skCatLabels: Record<string, string> = { technical: '技术栈', domain: '领域知识', tool: '工具', soft_skill: '软技能', certification: '证书' };
                  return (
                    <div key={idx} className="min-w-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-xs break-all">{s.skill}</span>
                          <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{skCatLabels[s.category] || s.category}</span>
                        </div>
                        <span className={`text-xs font-bold ${sc.text}`}>{s.matchScore}%</span>
                      </div>
                      <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <div className={`h-full bg-gradient-to-r ${sc.barFrom} ${sc.barTo} rounded-full transition-all duration-700`} style={{ width: `${s.matchScore}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-border bg-card overflow-hidden">
            <div className="flex border-b border-border px-5 min-w-0 overflow-x-hidden">
              <button
                onClick={() => setActiveKwTab('matched')}
                className={`py-3 px-4 text-xs font-medium flex items-center gap-1.5 transition-colors ${activeKwTab === 'matched' ? 'text-pink-400' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
                完全匹配 <span className="text-muted-foreground font-normal">({keywordMatchesArr.length})</span>
              </button>
              <button
                onClick={() => setActiveKwTab('partial')}
                className={`py-3 px-4 text-xs font-medium flex items-center gap-1.5 transition-colors ${activeKwTab === 'partial' ? 'text-pink-400' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                部分匹配 <span className="text-muted-foreground font-normal">({partialMatchesArr.length})</span>
              </button>
              <button
                onClick={() => setActiveKwTab('missing')}
                className={`py-3 px-4 text-xs font-medium flex items-center gap-1.5 transition-colors ${activeKwTab === 'missing' ? 'text-pink-400' : 'text-muted-foreground hover:text-foreground'}`}
              >
                <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
                缺失 <span className="text-muted-foreground font-normal">({missingKeywordsArr.length})</span>
              </button>
            </div>
            <div className="p-5">{renderKeywordContent()}</div>
          </div>

          {suggestionsArr.length > 0 && (
            <div className="rounded-xl border border-border bg-card p-5">
              <div className="flex items-center justify-between mb-4 min-w-0 overflow-x-hidden">
                <h2 className="text-sm font-semibold shrink-0">改进建议</h2>
                <div className="flex items-center gap-3 text-[10px] shrink-0">
                  <span className="flex items-center gap-1"><Square className="w-2.5 h-2.5 text-red-500" /> 高优先级</span>
                  <span className="flex items-center gap-1"><Square className="w-2.5 h-2.5 text-yellow-500" /> 中优先级</span>
                  <span className="flex items-center gap-1"><Square className="w-2.5 h-2.5 text-green-500" /> 低优先级</span>
                </div>
              </div>
              <div className="space-y-3">
                {[...suggestionsArr].sort((a: any, b: any) => {
                  const p = { high: 3, medium: 2, low: 1 };
                  return (p[b.priority as keyof typeof p] || 0) - (p[a.priority as keyof typeof p] || 0);
                }).map((s: any, idx: number) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border bg-background overflow-hidden"
                    style={{ borderLeft: `3px solid ${s.priority === 'high' ? '#ef4444' : s.priority === 'medium' ? '#facc15' : '#22c55e'}` }}
                  >
                    <div className="p-4">
                      <div className="flex items-center gap-2 mb-3 min-w-0 overflow-x-hidden">
                        <span className="text-sm shrink-0">{typeIcons[s.type] || <Lightbulb className="w-3 h-3" />}</span>
                        <span className="text-xs font-medium shrink-0">{typeNames[s.type] || s.type}</span>
                        <span className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${
                          s.priority === 'high' ? 'bg-red-500/10 text-red-400' :
                          s.priority === 'medium' ? 'bg-yellow-500/10 text-yellow-400' :
                          'bg-green-500/10 text-green-400'
                        }`}>
                          {s.priority === 'high' ? '高优先级' : s.priority === 'medium' ? '中优先级' : '低优先级'}
                        </span>
                        {s.targetDimension && <span className="text-[9px] text-muted-foreground break-all min-w-0">影响：{dimLabels[s.targetDimension] || s.targetDimension}</span>}
                        {s.expectedScoreDelta && <span className="text-[9px] text-green-400 ml-auto shrink-0">预计 +{s.expectedScoreDelta} 分</span>}
                      </div>
                      <div className="rounded-lg overflow-hidden border border-border text-sm mb-3">
                        <div className="px-3 py-2 border-b border-border/50" style={{ background: 'rgba(239, 68, 68, 0.05)' }}>
                          <div className="text-[10px] text-red-400/60 mb-1">当前</div>
                          <p className="text-sm text-red-400/70 line-through break-all">{s.current}</p>
                        </div>
                        <div className="px-3 py-2" style={{ background: 'rgba(34, 197, 94, 0.05)' }}>
                          <div className="text-[10px] text-green-400/60 mb-1">建议</div>
                          <p className="text-sm text-green-400 break-all">{s.suggested}</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 text-[11px] text-muted-foreground bg-muted/30 rounded-lg px-3 py-2">
                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                        <span className="break-all">{s.rationale}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
