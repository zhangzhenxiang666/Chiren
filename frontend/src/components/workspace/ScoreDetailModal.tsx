import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import {
  X,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Lightbulb,
  ChevronDown,
  ArrowLeft,
  Loader2,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { fetchResumeSectionById } from '../../lib/api'
import type { JdAnalysis } from '../../lib/api'

export interface ScoreDetailModalProps {
  open: boolean
  onClose: () => void
  resumeTitle: string
  analyses: JdAnalysis[]
}

// ─── Color helpers ────────────────────────────────────────────────────────────

function scoreColor(score: number) {
  if (score >= 90) return { text: 'text-emerald-400', hex: '#34d399', bar: 'bg-emerald-400', ring: '#34d399', badge: 'bg-emerald-400/10 border-emerald-400/25 text-emerald-400' }
  if (score >= 75) return { text: 'text-yellow-400', hex: '#facc15', bar: 'bg-yellow-400', ring: '#facc15', badge: 'bg-yellow-400/10 border-yellow-400/25 text-yellow-400' }
  if (score >= 60) return { text: 'text-orange-400', hex: '#fb923c', bar: 'bg-orange-400', ring: '#fb923c', badge: 'bg-orange-400/10 border-orange-400/25 text-orange-400' }
  return { text: 'text-red-400', hex: '#f87171', bar: 'bg-red-400', ring: '#f87171', badge: 'bg-red-400/10 border-red-400/25 text-red-400' }
}

// ─── Score Ring ───────────────────────────────────────────────────────────────

function ScoreRing({ score, size = 108 }: { score: number; size?: number }) {
  const stroke = 7
  const r = (size - stroke) / 2
  const circ = 2 * Math.PI * r
  const offset = circ * (1 - score / 100)
  const c = scoreColor(score)

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" style={{ display: 'block' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#2a2a2e" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={c.hex}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.9s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 6px ${c.hex}55)` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`text-4xl font-black leading-none tracking-tight ${c.text}`}>{score}</span>
        <span className="text-[9px] font-semibold text-gray-500 uppercase tracking-[0.12em] mt-1">总体匹配</span>
      </div>
    </div>
  )
}

// ─── ATS Bar ──────────────────────────────────────────────────────────────────

function ATSBar({ score }: { score: number }) {
  const c = scoreColor(score)
  return (
    <div className="w-full">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-gray-400 tracking-wide">ATS 兼容性</span>
        <div className={`flex items-center gap-1.5 text-xs font-bold px-2 py-0.5 rounded-full border ${c.badge}`}>
          <span>{score}</span>
          <span className="font-normal opacity-60">/ 100</span>
        </div>
      </div>
      <div className="relative w-full h-2.5 bg-[#1a1a1e] rounded-full overflow-hidden border border-[#2a2a2e]">
        {/* Tick marks */}
        {[25, 50, 75].map(tick => (
          <div
            key={tick}
            className="absolute top-0 bottom-0 w-px bg-[#2a2a2e]"
            style={{ left: `${tick}%` }}
          />
        ))}
        <div
          className={`h-full rounded-full transition-all duration-700 ease-out ${c.bar}`}
          style={{ width: `${score}%`, opacity: 0.9 }}
        />
      </div>
      <div className="flex justify-between mt-1 px-0.5">
        {['差', '一般', '良好', '优秀'].map((label, i) => (
          <span key={label} className={`text-[9px] ${i === 0 ? 'text-left' : i === 3 ? 'text-right' : 'text-center'} ${score >= (i + 1) * 25 - 10 ? 'text-gray-500' : 'text-gray-700'
            }`}>{label}</span>
        ))}
      </div>
    </div>
  )
}

// ─── Timeline Sparkline ───────────────────────────────────────────────────────

function MiniSparkline({ scores }: { scores: number[] }) {
  if (scores.length < 2) return null
  const min = Math.min(...scores)
  const max = Math.max(...scores)
  const range = max - min || 1
  const w = 36, h = 16
  const pts = scores.map((s, i) => {
    const x = (i / (scores.length - 1)) * w
    const y = h - ((s - min) / range) * h
    return `${x},${y}`
  }).join(' ')

  return (
    <svg width={w} height={h} className="opacity-60">
      <polyline points={pts} fill="none" stroke="#ec4899" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}

// ─── Suggestion Accordion ────────────────────────────────────────────────────

function SuggestionDiff({ current, suggested }: { current: string; suggested: string }) {
  return (
    <div className="rounded-lg overflow-hidden border border-[#2a2a2e] text-sm">
      <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/5 border-b border-[#2a2a2e]">
        <span className="w-3 h-3 rounded-full bg-red-400/30 flex items-center justify-center">
          <span className="block w-1.5 h-px bg-red-400 rounded" />
        </span>
        <span className="text-[10px] font-semibold text-red-400/70 uppercase tracking-wider">当前</span>
      </div>
      <p className="px-3 py-2.5 text-red-400/60 line-through leading-relaxed whitespace-pre-wrap bg-red-500/[0.03]">
        {current}
      </p>
      <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/5 border-t border-b border-[#2a2a2e]">
        <span className="w-3 h-3 rounded-full bg-emerald-400/30 flex items-center justify-center">
          <span className="block w-1.5 h-1.5 text-emerald-400 leading-none text-center" style={{ fontSize: 8 }}>+</span>
        </span>
        <span className="text-[10px] font-semibold text-emerald-400/70 uppercase tracking-wider">建议</span>
      </div>
      <p className="px-3 py-2.5 text-emerald-400 leading-relaxed whitespace-pre-wrap bg-emerald-500/[0.03]">
        {suggested}
      </p>
    </div>
  )
}

function SectionSuggestionGroup({
  sectionId,
  sectionTitle,
  isLoadingTitle,
  suggestions,
}: {
  sectionId: string
  sectionTitle: string
  isLoadingTitle: boolean
  suggestions: { current: string; suggested: string }[]
}) {
  const [open, setOpen] = useState(false)

  return (
    <div className={`rounded-xl border transition-all duration-200 overflow-hidden ${open ? 'border-[#3a3a3e] bg-[#131316]' : 'border-[#2a2a2e] bg-[#0f0f12] hover:border-[#323236]'
      }`}>
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
        onClick={() => setOpen(!open)}
      >
        <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 transition-colors ${open ? 'bg-pink-500/20' : 'bg-[#2a2a2e]'
          }`}>
          <ChevronDown className={`w-3 h-3 transition-transform duration-200 ${open ? 'rotate-180 text-pink-400' : 'text-gray-500'
            }`} />
        </div>

        <span className="flex-1 text-sm font-medium text-gray-200 truncate">
          {isLoadingTitle ? (
            <span className="inline-flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin text-gray-500" />
              <span className="text-gray-600 text-xs">加载中…</span>
            </span>
          ) : sectionTitle}
        </span>

        <span className="shrink-0 text-[10px] px-2 py-0.5 rounded-full bg-[#2a2a2e] text-gray-500 font-mono">
          {suggestions.length}
        </span>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3">
          {suggestions.map((s, idx) => (
            <SuggestionDiff key={`${sectionId}-${idx}`} current={s.current} suggested={s.suggested} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── JDPreview ───────────────────────────────────────────────────────────────

function JDPreview({ jd }: { jd?: string }) {
  if (!jd) return null

  return (
    <div className="group relative mt-1 max-w-full">
      <div className="flex items-center gap-1.5 text-[11px] text-gray-500">
        <span className="opacity-60">JD:</span>
        <p className="truncate max-w-[420px] cursor-default">
          {jd}
        </p>
      </div>

      {/* Tooltip */}
      <div className="absolute left-0 top-full mt-2 z-50 hidden group-hover:block w-[520px]">
        <div className="rounded-lg border border-[#2a2a2e] bg-[#111113] p-3 shadow-xl">
          <p className="text-[12px] text-gray-300 leading-relaxed whitespace-pre-wrap">
            {jd}
          </p>
        </div>
      </div>
    </div>
  )
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

function fmtDate(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

function fmtTime(dateStr: string) {
  const d = new Date(dateStr)
  return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
}

// ─── Trend icon ───────────────────────────────────────────────────────────────

function TrendIcon({ delta }: { delta: number }) {
  if (delta > 0) return <TrendingUp className="w-2.5 h-2.5 text-emerald-400" />
  if (delta < 0) return <TrendingDown className="w-2.5 h-2.5 text-red-400" />
  return <Minus className="w-2.5 h-2.5 text-gray-600" />
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function ScoreDetailModal({
  open,
  onClose,
  resumeTitle,
  analyses,
}: ScoreDetailModalProps) {
  const sortedAnalyses = useMemo(() =>
    [...analyses].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [analyses]
  )

  const [selectedIndex, setSelectedIndex] = useState(0)
  const [sectionTitles, setSectionTitles] = useState<Record<string, string>>({})
  const [loadingTitles, setLoadingTitles] = useState<Set<string>>(new Set())
  const loadingRef = useRef<Set<string>>(new Set())

  const currentAnalysis = sortedAnalyses[selectedIndex] ?? null
  const isViewingHistory = selectedIndex > 0

  const handleResetAndClose = useCallback(() => { setSelectedIndex(0); onClose() }, [onClose])

  const groupedSuggestions = useMemo(() => {
    if (!currentAnalysis?.suggestions?.length) return []
    const map = new Map<string, { sectionId: string; suggestions: { current: string; suggested: string }[] }>()
    for (const s of currentAnalysis.suggestions) {
      if (!s.sectionId) continue
      if (!map.has(s.sectionId)) map.set(s.sectionId, { sectionId: s.sectionId, suggestions: [] })
      map.get(s.sectionId)!.suggestions.push({ current: s.current ?? '', suggested: s.suggested ?? '' })
    }
    return Array.from(map.values())
  }, [currentAnalysis])

  useEffect(() => {
    if (!currentAnalysis) return
    const neededIds = groupedSuggestions
      .map(g => g.sectionId)
      .filter(id => id && !sectionTitles[id] && !loadingRef.current.has(id))
    if (!neededIds.length) return
    loadingRef.current = new Set([...loadingRef.current, ...neededIds])
    setLoadingTitles(prev => new Set([...prev, ...neededIds]))
    Promise.all(neededIds.map(async (id) => {
      try {
        const s = await fetchResumeSectionById(id)
        return { id, title: s.title || id }
      } catch { return { id, title: id } }
    })).then(results => {
      setSectionTitles(prev => { const u = { ...prev }; results.forEach(r => { u[r.id] = r.title }); return u })
      setLoadingTitles(prev => { const n = new Set(prev); neededIds.forEach(id => n.delete(id)); return n })
    })
  }, [currentAnalysis, groupedSuggestions, sectionTitles])

  // Sparkline data: scores in chronological order (oldest first)
  const sparklineScores = useMemo(() =>
    [...sortedAnalyses].reverse().map(a => a.overallScore),
    [sortedAnalyses]
  )

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={handleResetAndClose}
        aria-label="关闭弹窗"
      />

      <div
        className="relative w-full max-w-5xl h-[82vh] bg-[#18181b] border border-[#2a2a2e] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
        onKeyDown={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="评分详情"
        style={{ animation: 'modal-enter 0.28s cubic-bezier(0.16, 1, 0.3, 1)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-4 px-5 py-4 border-b border-[#2a2a2e] shrink-0 bg-[#18181b]">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-pink-500/10 border border-pink-500/20 shrink-0">
            <TrendingUp className="w-4 h-4 text-pink-400" />
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="text-[15px] font-semibold text-white leading-tight truncate">{resumeTitle}</h2>

            {/* 👇 JD Preview（新加） */}
            {currentAnalysis && (
              <JDPreview jd={currentAnalysis.jobDescription} />
            )}

            <div className="flex items-center gap-2 mt-0.5">
              {isViewingHistory && currentAnalysis && (
                <button
                  type="button"
                  onClick={() => setSelectedIndex(0)}
                  className="inline-flex items-center gap-1 text-[11px] text-pink-400 hover:text-pink-300 transition-colors"
                >
                  <ArrowLeft className="w-2.5 h-2.5" />
                  返回最新
                </button>
              )}
              <span className="text-[11px] text-gray-500">
                {isViewingHistory && currentAnalysis
                  ? `${fmtDate(currentAnalysis.createdAt)} ${fmtTime(currentAnalysis.createdAt)} 快照`
                  : '最新评分结果'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={handleResetAndClose}
            className="flex items-center justify-center w-7 h-7 rounded-lg text-gray-500 hover:text-gray-300 hover:bg-white/5 transition-colors shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {!currentAnalysis ? (
            <div className="flex flex-col items-center justify-center flex-1 gap-2 text-gray-500">
              <TrendingUp className="w-12 h-12 opacity-10" />
              <p className="text-sm">暂无评分记录</p>
              <p className="text-xs opacity-60">请先启动 JD 匹配评分任务</p>
            </div>
          ) : (
            <>
              {/* ── Left: Timeline ── */}
              <div className="w-[152px] border-r border-[#2a2a2e] flex flex-col shrink-0 bg-[#111113]">
                {/* Timeline header with sparkline */}
                <div className="px-3 pt-3 pb-2.5 border-b border-[#1e1e21]">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-[10px] font-semibold text-gray-600 uppercase tracking-widest">历史</span>
                    <span className="text-[10px] font-mono text-gray-600 bg-[#1e1e21] px-1.5 py-0.5 rounded">
                      {sortedAnalyses.length}
                    </span>
                  </div>
                  {sparklineScores.length >= 2 && (
                    <div className="flex items-center gap-2">
                      <MiniSparkline scores={sparklineScores} />
                      <span className="text-[9px] text-gray-600">趋势</span>
                    </div>
                  )}
                </div>

                {/* Timeline items */}
                <div className="flex-1 overflow-y-auto py-1.5 scrollbar-hide">
                  {sortedAnalyses.map((analysis, index) => {
                    const isSelected = index === selectedIndex
                    const isLatest = index === 0
                    const c = scoreColor(analysis.overallScore)
                    const prevScore = sortedAnalyses[index + 1]?.overallScore
                    const delta = prevScore !== undefined ? analysis.overallScore - prevScore : 0

                    return (
                      <button
                        key={analysis.id}
                        type="button"
                        onClick={() => setSelectedIndex(index)}
                        className={`relative w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-all duration-150 group ${isSelected ? 'bg-pink-500/8' : 'hover:bg-white/[0.025]'
                          }`}
                      >
                        {/* Left accent */}
                        <div className={`absolute left-0 top-2 bottom-2 w-[3px] rounded-r-full transition-all duration-200 ${isSelected ? 'bg-pink-500' : isLatest ? 'bg-[#2a3a4a]' : 'bg-transparent group-hover:bg-[#2a2a2e]'
                          }`} />

                        {/* Score badge */}
                        <div className={`flex flex-col items-center justify-center w-10 h-10 rounded-lg shrink-0 transition-all duration-150 border ${isSelected
                            ? `border-pink-500/30 bg-pink-500/10`
                            : `border-[#222226] bg-[#0f0f12] group-hover:border-[#2a2a2e]`
                          }`}>
                          <span className={`text-[15px] font-black leading-none ${c.text}`}>
                            {analysis.overallScore}
                          </span>
                          <div className="w-5 h-[2px] bg-[#1e1e21] rounded-full mt-1 overflow-hidden">
                            <div
                              className={`h-full rounded-full ${c.bar}`}
                              style={{ width: `${analysis.overallScore}%` }}
                            />
                          </div>
                        </div>

                        {/* Meta */}
                        <div className="flex-1 min-w-0 space-y-0.5">
                          {isLatest && (
                            <span className="inline-block text-[9px] px-1.5 py-px rounded bg-blue-500/15 text-blue-400 font-semibold leading-tight mb-0.5">
                              最新
                            </span>
                          )}
                          <div className="text-[11px] font-medium text-gray-400 leading-none">
                            {fmtDate(analysis.createdAt)}
                          </div>
                          <div className="flex items-center gap-1 mt-0.5">
                            <span className="text-[10px] text-gray-600">{fmtTime(analysis.createdAt)}</span>
                            {index < sortedAnalyses.length - 1 && (
                              <TrendIcon delta={delta} />
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Right: Content ── */}
              <div className="flex-1 overflow-y-auto bg-[#18181b]">
                <div className="px-6 py-5 space-y-5">

                  {/* ── Score Overview ── */}
                  <div className="flex items-start gap-5 p-4 rounded-2xl border border-[#242428] bg-[#111113]">
                    <ScoreRing score={currentAnalysis.overallScore} />

                    <div className="flex-1 space-y-4 min-w-0">
                      <ATSBar score={currentAnalysis.atsScore} />

                      {currentAnalysis.summary && (
                        <div className="relative rounded-lg border border-[#242428] bg-[#0d0d10] px-4 py-3 overflow-hidden">
                          <div className="absolute left-0 inset-y-0 w-[3px] bg-gradient-to-b from-pink-500/60 to-pink-500/10 rounded-l-lg" />
                          <p className="text-[13px] text-gray-400 leading-relaxed pl-2">
                            {currentAnalysis.summary}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* ── Keywords ── */}
                  <div className="grid grid-cols-2 gap-3">
                    {/* Matched */}
                    <div className="rounded-xl border border-[#242428] bg-[#111113] overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e21]">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        <span className="text-xs font-semibold text-gray-300">已匹配</span>
                        <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                          {currentAnalysis.keywordMatches?.length ?? 0}
                        </span>
                      </div>
                      <div className="px-3 py-3 flex flex-wrap gap-1.5 min-h-[52px]">
                        {(currentAnalysis.keywordMatches ?? []).length === 0 ? (
                          <span className="text-xs text-gray-700 italic self-center mx-auto">无匹配关键词</span>
                        ) : (
                          currentAnalysis.keywordMatches.map(kw => (
                            <span
                              key={`match-${kw}`}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-emerald-500/8 text-emerald-400 border border-emerald-500/15"
                            >
                              {kw}
                            </span>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Missing */}
                    <div className="rounded-xl border border-[#242428] bg-[#111113] overflow-hidden">
                      <div className="flex items-center gap-2 px-4 py-3 border-b border-[#1e1e21]">
                        <AlertCircle className="w-3.5 h-3.5 text-orange-400" />
                        <span className="text-xs font-semibold text-gray-300">待补充</span>
                        <span className="ml-auto text-[10px] font-mono px-1.5 py-0.5 rounded bg-orange-500/10 text-orange-500 border border-orange-500/20">
                          {currentAnalysis.missingKeywords?.length ?? 0}
                        </span>
                      </div>
                      <div className="px-3 py-3 flex flex-wrap gap-1.5 min-h-[52px]">
                        {(currentAnalysis.missingKeywords ?? []).length === 0 ? (
                          <span className="text-xs text-gray-700 italic self-center mx-auto">无缺失关键词</span>
                        ) : (
                          currentAnalysis.missingKeywords.map(kw => (
                            <span
                              key={`miss-${kw}`}
                              className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-orange-500/8 text-orange-400 border border-orange-500/15"
                            >
                              {kw}
                            </span>
                          ))
                        )}
                      </div>
                    </div>
                  </div>

                  {/* ── Suggestions ── */}
                  <div>
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center justify-center w-5 h-5 rounded-md bg-yellow-500/10 border border-yellow-500/20">
                        <Lightbulb className="w-3 h-3 text-yellow-400" />
                      </div>
                      <h3 className="text-[13px] font-semibold text-gray-300">改进建议</h3>
                      {groupedSuggestions.length > 0 && (
                        <span className="text-[10px] text-gray-600 font-mono bg-[#1a1a1e] px-1.5 py-0.5 rounded border border-[#2a2a2e]">
                          {groupedSuggestions.length} 个模块
                        </span>
                      )}
                    </div>

                    {groupedSuggestions.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 rounded-xl border border-[#242428] bg-[#111113] gap-2">
                        <CheckCircle2 className="w-8 h-8 text-emerald-400/20" />
                        <p className="text-sm text-gray-600">暂无改进建议</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {groupedSuggestions.map(group => (
                          <SectionSuggestionGroup
                            key={group.sectionId}
                            sectionId={group.sectionId}
                            sectionTitle={sectionTitles[group.sectionId] || group.sectionId}
                            isLoadingTitle={loadingTitles.has(group.sectionId)}
                            suggestions={group.suggestions}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <style>{`
        @keyframes modal-enter {
          from { opacity: 0; transform: scale(0.96) translateY(12px); }
          to   { opacity: 1; transform: scale(1) translateY(0); }
        }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
        .bg-pink-500\\/8 { background-color: rgb(236 72 153 / 0.08); }
        .bg-emerald-500\\/8 { background-color: rgb(16 185 129 / 0.08); }
        .bg-orange-500\\/8 { background-color: rgb(249 115 22 / 0.08); }
      `}</style>
    </div>
  )
}