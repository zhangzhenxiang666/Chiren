import { useEffect, useState, useCallback } from 'react'
import { CheckCircle2, Circle, Plus, Play, ChevronDown, ChevronRight, Pencil } from 'lucide-react'
import { toast } from 'sonner'
import { useNavigate, useParams } from 'react-router-dom'
import { useInterviewStore } from '@/stores/interview-store'
import type { InterviewCollectionDetail, InterviewRound, InterviewRoundDraft } from '@/types/interview'
import CreateInterviewModal from './interview/CreateInterviewModal'
import AddRoundModal from './interview/AddRoundModal'
import { Timeline, TimelineItem } from '@/components/ui/Timeline'

interface InterviewTabProps {
  subResumeId: string
  subResumeTitle?: string
  selectedCollectionId?: string
  onSelectCollection?: (collectionId: string) => void
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    completed: 'text-green-400 bg-green-500/10 border border-green-500/20',
    in_progress: 'text-blue-400 bg-blue-500/10 border border-blue-500/20',
    not_started: 'text-muted-foreground bg-muted/30 border border-border',
  }
  return colors[status] || colors.not_started
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: '已完成',
    in_progress: '进行中',
    not_started: '待开始',
  }
  return labels[status] || status
}

function RoundStatusIcon({ status }: { status: string }) {
  if (status === 'completed') {
    return <CheckCircle2 className="w-3 h-3 text-green-500" strokeWidth={3} />
  }
  if (status === 'in_progress') {
    return <div className="w-3 h-3 rounded-full bg-blue-500 border-2 border-card" />
  }
  return <Circle className="w-3 h-3 text-border" strokeWidth={3} />
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
  collection: InterviewCollectionDetail
  workspaceId: string
  subResumeId: string
  isSelected: boolean
  isExpanded: boolean
  onSelect: (collectionId: string) => void
  onToggleExpand: (collectionId: string) => void
}) {
  const navigate = useNavigate()
  const createRound = useInterviewStore((s) => s.createRound)
  const updateRound = useInterviewStore((s) => s.updateRound)

  const [showAddRound, setShowAddRound] = useState(false)
  const [editingRound, setEditingRound] = useState<InterviewRound | null>(null)

  const sortedRounds = [...collection.rounds].sort((a, b) => a.sortOrder - b.sortOrder)
  const completedCount = sortedRounds.filter((r) => r.status === 'completed').length
  const progressPercent = sortedRounds.length > 0
    ? (completedCount / sortedRounds.length) * 100
    : 0

  const canStartRound = (round: InterviewRound, index: number): boolean => {
    if (round.status !== 'not_started') return false
    for (let i = 0; i < index; i++) {
      if (sortedRounds[i].status !== 'completed') return false
    }
    const hasInProgress = sortedRounds.some((r) => r.status === 'in_progress')
    return !hasInProgress
  }

  const handleStartRound = (e: React.MouseEvent, round: InterviewRound) => {
    e.stopPropagation()
    navigate(`/workspace/${workspaceId}/resumes/${subResumeId}/interview/${collection.id}/${round.id}`)
  }

  const handleEnterInterview = (e: React.MouseEvent, round: InterviewRound) => {
    e.stopPropagation()
    navigate(`/workspace/${workspaceId}/resumes/${subResumeId}/interview/${collection.id}/${round.id}`)
  }

  const handleToggleExpand = (e: React.MouseEvent) => {
    e.stopPropagation()
    onToggleExpand(collection.id)
  }

  const handleHeaderClick = () => {
    onSelect(collection.id)
  }

  const nextSortOrder = sortedRounds.length > 0
    ? Math.max(...sortedRounds.map((r) => r.sortOrder)) + 1
    : 0

  const canAddRound = collection.status !== 'completed'

  return (
    <div
      className={`rounded-xl border border-border bg-card overflow-hidden transition-all ${
        isSelected ? 'border-pink-500/40 bg-pink-500/[0.03]' : 'hover:border-border-hover'
      }`}
    >
      <div
        onClick={handleHeaderClick}
        className={`p-4 cursor-pointer ${isExpanded ? 'border-b border-border' : ''}`}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleToggleExpand}
              className="p-0.5 rounded hover:bg-white/10 transition-colors text-muted-foreground"
            >
              {isExpanded ? (
                <ChevronDown className="w-3.5 h-3.5" />
              ) : (
                <ChevronRight className="w-3.5 h-3.5" />
              )}
            </button>
            <h3 className="text-sm font-semibold">{collection.name}</h3>
            <span className={`px-1.5 py-0.5 rounded text-[9px] ${getStatusColor(collection.status)}`}>
              {getStatusLabel(collection.status)}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
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
        <div className="p-4">
          {sortedRounds.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">暂无面试轮次</p>
          ) : (
            <Timeline>
              {sortedRounds.map((round, index) => (
                <TimelineItem key={round.id} icon={<RoundStatusIcon status={round.status} />}>
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
                      {round.status === 'not_started' && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            setEditingRound(round)
                          }}
                          className="p-1 rounded hover:bg-white/10 text-muted-foreground hover:text-foreground transition-colors"
                          title="编辑轮次"
                        >
                          <Pencil className="w-3 h-3" />
                        </button>
                      )}
                      <span className={`text-[9px] px-1.5 py-0.5 rounded ${getStatusColor(round.status)}`}>
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
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-green-500/10 text-green-400 hover:bg-green-500/20 transition-colors"
                      >
                        <Play className="w-2.5 h-2.5" />
                        开始面试
                      </button>
                    )}
                    {round.status === 'completed' && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/workspace/${workspaceId}/resumes/${subResumeId}/interview/${collection.id}/${round.id}`);
                        }}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border text-muted-foreground hover:text-foreground hover:bg-white/[0.02] transition-colors"
                      >
                        查看详情
                      </button>
                    )}
                    {round.status === 'in_progress' && (
                      <button
                        type="button"
                        onClick={(e) => handleEnterInterview(e, round)}
                        className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
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
              className="mt-3 flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-dashed border-border text-[11px] text-muted-foreground hover:text-foreground hover:border-foreground/20 transition-colors w-full justify-center"
            >
              <Plus className="w-3.5 h-3.5" />
              添加轮次
            </button>
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
          await createRound(params)
          toast.success('轮次添加成功')
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
            await updateRound({
              id: params.id,
              name: params.name,
              interviewerName: params.interviewerName,
              interviewerTitle: params.interviewerTitle,
              interviewerBio: params.interviewerBio,
              questionStyle: params.questionStyle,
              assessmentDimensions: params.assessmentDimensions,
              personalityTraits: params.personalityTraits,
              sortOrder: params.sortOrder,
            })
            toast.success('轮次修改成功')
          }
        }}
      />
    </div>
  )
}

export default function InterviewTab({ subResumeId, subResumeTitle: _subResumeTitle, selectedCollectionId, onSelectCollection }: InterviewTabProps) {
  const { id: workspaceId } = useParams<{ id: string }>()
  const collections = useInterviewStore((s) => s.collections)
  const loading = useInterviewStore((s) => s.loading)
  const error = useInterviewStore((s) => s.error)
  const fetchCollections = useInterviewStore((s) => s.fetchCollections)
  const createCollectionWithRounds = useInterviewStore((s) => s.createCollectionWithRounds)
  const clearError = useInterviewStore((s) => s.clearError)

  const [showCreateModal, setShowCreateModal] = useState(false)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

  const handleToggleExpand = useCallback((collectionId: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(collectionId)) {
        next.delete(collectionId)
      } else {
        next.add(collectionId)
      }
      return next
    })
  }, [])

  useEffect(() => {
    fetchCollections(subResumeId)
  }, [subResumeId, fetchCollections])

  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, clearError])

  useEffect(() => {
    if (selectedCollectionId) {
      setExpandedIds((prev) => {
        const next = new Set(prev)
        next.add(selectedCollectionId)
        return next
      })
    }
  }, [selectedCollectionId])

  if (loading && collections.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        加载中...
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold">面试方案</span>
          <span className="text-[10px] text-muted-foreground">
            {collections.length} 个方案
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowCreateModal(true)}
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-pink-500/10 text-pink-400 text-xs hover:bg-pink-500/20 transition-colors"
        >
          <Plus className="w-3 h-3" />
          创建方案
        </button>
      </div>

      {collections.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
          <p className="text-sm">暂无面试方案</p>
          <button
            type="button"
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 rounded-lg bg-pink-500/10 text-pink-400 text-xs hover:bg-pink-500/20 transition-colors"
          >
            创建第一个面试方案
          </button>
        </div>
      ) : (
        <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
          {collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
              workspaceId={workspaceId || ''}
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
          })
          toast.success('面试方案创建成功')
        }}
      />
    </div>
  )
}
