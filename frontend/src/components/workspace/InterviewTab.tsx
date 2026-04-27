import { useEffect, useState } from 'react'
import { CheckCircle2, Circle, Plus, Play } from 'lucide-react'
import { toast } from 'sonner'
import { useInterviewStore } from '@/stores/interview-store'
import type { InterviewCollectionDetail, InterviewRound, InterviewRoundDraft } from '@/types/interview'
import CreateInterviewModal from './interview/CreateInterviewModal'
import { Timeline, TimelineItem } from '@/components/ui/Timeline'

interface InterviewTabProps {
  subResumeId: string
  subResumeTitle?: string
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
}: {
  collection: InterviewCollectionDetail
}) {
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

  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
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

      <div className="p-4">
        {sortedRounds.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-4">暂无面试轮次，点击上方按钮添加</p>
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
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${getStatusColor(round.status)}`}>
                    {getStatusLabel(round.status)}
                  </span>
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
                      onClick={() => toast.info('开始面试功能开发中，敬请期待')}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                    >
                      <Play className="w-2.5 h-2.5" />
                      开始面试
                    </button>
                  )}
                  {round.status === 'completed' && (
                    <button
                      type="button"
                      onClick={() => toast.info('面试详情功能开发中，敬请期待')}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] border border-border text-muted-foreground hover:text-foreground hover:bg-white/[0.02] transition-colors"
                    >
                      查看详情
                    </button>
                  )}
                  {round.status === 'in_progress' && (
                    <button
                      type="button"
                      onClick={() => toast.info('面试功能开发中，敬请期待')}
                      className="flex items-center gap-1 px-2 py-1 rounded text-[10px] bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors"
                    >
                      进入面试
                    </button>
                  )}
                </div>
              </TimelineItem>
            ))}
          </Timeline>
        )}
      </div>
    </div>
  )
}

export default function InterviewTab({ subResumeId, subResumeTitle: _subResumeTitle }: InterviewTabProps) {
  const collections = useInterviewStore((s) => s.collections)
  const loading = useInterviewStore((s) => s.loading)
  const error = useInterviewStore((s) => s.error)
  const fetchCollections = useInterviewStore((s) => s.fetchCollections)
  const createCollectionWithRounds = useInterviewStore((s) => s.createCollectionWithRounds)
  const clearError = useInterviewStore((s) => s.clearError)

  const [showCreateModal, setShowCreateModal] = useState(false)

  useEffect(() => {
    fetchCollections(subResumeId)
  }, [subResumeId, fetchCollections])

  useEffect(() => {
    if (error) {
      toast.error(error)
      clearError()
    }
  }, [error, clearError])

  if (loading && collections.length === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        加载中...
      </div>
    )
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
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
        <div className="space-y-3">
          {collections.map((collection) => (
            <CollectionCard
              key={collection.id}
              collection={collection}
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
