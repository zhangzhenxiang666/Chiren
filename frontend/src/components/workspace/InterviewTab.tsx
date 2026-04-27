// TODO: Replace mock data with real API when backend interview management is implemented

import { Check, MoreHorizontal, Circle } from 'lucide-react'

interface InterviewTabProps {
  // TODO: Backend API not yet implemented for interview management
}

interface InterviewRound {
  id: string
  name: string
  type: string
  status: 'completed' | 'in_progress' | 'pending'
  scheduledAt: string | null
  completedAt: string | null
  interviewer: string | null
  duration: number | null
  rating: number | null
  feedback: string | null
  notes: string | null
}

interface InterviewScheme {
  id: string
  name: string
  company: string
  position: string
  status: 'completed' | 'in_progress' | 'pending' | 'abandoned'
  createdAt: string
  updatedAt: string
  rounds: InterviewRound[]
}

const interviewData: { schemes: InterviewScheme[] } = {
  schemes: [
    {
      id: 'scheme-001',
      name: '阿里技术面试',
      company: '阿里巴巴',
      position: 'AI 大模型算法工程师',
      status: 'in_progress',
      createdAt: '2025-05-20T10:00:00+08:00',
      updatedAt: '2025-05-26T15:20:00+08:00',
      rounds: [
        {
          id: 'round-001',
          name: 'HR 初面',
          type: 'hr',
          status: 'completed',
          scheduledAt: '2025-05-24T09:30:00+08:00',
          completedAt: '2025-05-24T10:30:00+08:00',
          interviewer: 'HRBP 小王',
          duration: 60,
          rating: 4,
          feedback: '沟通能力良好，对岗位理解清晰',
          notes: '主要了解个人情况和职业规划',
        },
        {
          id: 'round-002',
          name: '技术一面',
          type: 'technical',
          status: 'completed',
          scheduledAt: '2025-05-25T14:00:00+08:00',
          completedAt: '2025-05-25T15:30:00+08:00',
          interviewer: '后端工程师 张工',
          duration: 90,
          rating: 5,
          feedback: '技术基础扎实，算法题完成优秀',
          notes: '问了3道算法题，都完成了',
        },
        {
          id: 'round-003',
          name: '技术二面',
          type: 'technical',
          status: 'in_progress',
          scheduledAt: '2025-05-27T10:00:00+08:00',
          completedAt: null,
          interviewer: '架构师 李工',
          duration: null,
          rating: null,
          feedback: null,
          notes: null,
        },
        {
          id: 'round-004',
          name: '主管面',
          type: 'manager',
          status: 'pending',
          scheduledAt: null,
          completedAt: null,
          interviewer: null,
          duration: null,
          rating: null,
          feedback: null,
          notes: null,
        },
      ],
    },
    {
      id: 'scheme-002',
      name: '字节后端面试',
      company: '字节跳动',
      position: '后端开发工程师',
      status: 'completed',
      createdAt: '2025-05-15T09:00:00+08:00',
      updatedAt: '2025-05-22T16:00:00+08:00',
      rounds: [
        {
          id: 'round-005',
          name: 'HR 初面',
          type: 'hr',
          status: 'completed',
          scheduledAt: '2025-05-16T10:00:00+08:00',
          completedAt: '2025-05-16T11:00:00+08:00',
          interviewer: 'HRBP 小刘',
          duration: 60,
          rating: 4,
          feedback: '沟通顺畅，期望薪资在范围内',
          notes: '',
        },
        {
          id: 'round-006',
          name: '技术一面',
          type: 'technical',
          status: 'completed',
          scheduledAt: '2025-05-18T14:00:00+08:00',
          completedAt: '2025-05-18T15:30:00+08:00',
          interviewer: '后端工程师 陈工',
          duration: 90,
          rating: 4,
          feedback: '技术能力不错，项目经验丰富',
          notes: '',
        },
        {
          id: 'round-007',
          name: '技术二面',
          type: 'technical',
          status: 'completed',
          scheduledAt: '2025-05-20T10:00:00+08:00',
          completedAt: '2025-05-20T11:30:00+08:00',
          interviewer: '技术leader 王工',
          duration: 90,
          rating: 3,
          feedback: '系统设计能力有待提升',
          notes: '',
        },
        {
          id: 'round-008',
          name: 'HR 终面',
          type: 'hr',
          status: 'completed',
          scheduledAt: '2025-05-22T15:00:00+08:00',
          completedAt: '2025-05-22T16:00:00+08:00',
          interviewer: 'HRD 赵总',
          duration: 60,
          rating: 5,
          feedback: '综合表现优秀，发放offer',
          notes: '已发放offer，薪资符合期望',
        },
      ],
    },
  ],
}

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${min}`
}

function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    completed: 'text-green-400 bg-green-500/10 border border-green-500/20',
    in_progress: 'text-blue-400 bg-blue-500/10 border border-blue-500/20',
    pending: 'text-muted-foreground bg-muted/30 border border-border',
    abandoned: 'text-red-400 bg-red-500/10 border border-red-500/20',
  }
  return colors[status] || colors.pending
}

function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    completed: '已完成',
    in_progress: '进行中',
    pending: '待面试',
    abandoned: '已放弃',
  }
  return labels[status] || status
}

function RoundStatusIcon({ status }: { status: string }) {
  if (status === 'completed') {
    return (
      <div className="w-5 h-5 rounded-full bg-green-500 flex items-center justify-center">
        <Check className="w-3 h-3 text-black" strokeWidth={3} />
      </div>
    )
  }
  if (status === 'in_progress') {
    return <div className="w-5 h-5 rounded-full bg-blue-500 border-2 border-card" />
  }
  return <Circle className="w-5 h-5 text-border" strokeWidth={2} />
}

export default function InterviewTab(_props: InterviewTabProps) {
  const { schemes } = interviewData

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <span className="text-xs font-semibold">面试方案</span>
          <span className="text-[10px] text-muted-foreground">
            {schemes.length} 个方案
          </span>
        </div>
      </div>

      <div className="space-y-3">
        {schemes.map((scheme) => {
          const completedRounds = scheme.rounds.filter(
            (r) => r.status === 'completed'
          ).length
          const totalRounds = scheme.rounds.length
          const progressPercent = (completedRounds / totalRounds) * 100

          return (
            <div
              key={scheme.id}
              className="rounded-xl border border-border bg-card overflow-hidden"
            >
              <div className="p-4 border-b border-border">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold break-all">{scheme.name}</h3>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[9px] ${getStatusColor(scheme.status)}`}
                    >
                      {getStatusLabel(scheme.status)}
                    </span>
                  </div>
                  <button className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors">
                    <MoreHorizontal className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground mb-3">
                  <span className="break-all">{scheme.company}</span>
                  <span className="break-all">{scheme.position}</span>
                  <span className="shrink-0">更新于 {fmtDateTime(scheme.updatedAt)}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-pink-500 to-pink-400 rounded-full transition-all"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground">
                    {completedRounds}/{totalRounds}
                  </span>
                </div>
              </div>

              <div className="p-4">
                <div className="relative pl-5 space-y-4">
                  <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border" />
                  {scheme.rounds.map((round) => (
                    <div
                      key={round.id}
                      className="relative flex items-start gap-3"
                    >
                      <div className="absolute left-[-20px] top-0">
                        <RoundStatusIcon status={round.status} />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-medium break-all">
                            {round.name}
                          </span>
                          <span
                            className={`text-[9px] px-1.5 py-0.5 rounded ${getStatusColor(round.status)}`}
                          >
                            {getStatusLabel(round.status)}
                          </span>
                        </div>
                        {round.interviewer && (
                          <div className="text-[10px] text-muted-foreground mb-1 break-all">
                            {round.interviewer}
                          </div>
                        )}
                        {round.scheduledAt && (
                          <div className="text-[10px] text-muted-foreground">
                            {fmtDateTime(round.scheduledAt)}
                            {round.duration ? ` · ${round.duration}分钟` : ''}
                          </div>
                        )}
                        {round.feedback && (
                          <div className="mt-2 p-2 rounded bg-white/[0.02] border border-border/50">
                            <div className="text-[10px] text-muted-foreground mb-1">
                              反馈
                            </div>
                            <div className="text-[10px] break-all">{round.feedback}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}