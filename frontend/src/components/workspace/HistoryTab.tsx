// TODO: Replace mock data with real API when backend activity history is implemented

import { FileText, Check, Calendar, Plus } from 'lucide-react'

interface HistoryTabProps {
  // TODO: Backend API not yet implemented for activity history
}

type ActivityType = 'jd_analysis' | 'round_completed' | 'round_scheduled' | 'scheme_created'

interface Activity {
  type: ActivityType
  timestamp: string
  description: string
  version?: number
  score?: number
  schemeName?: string
  roundName?: string
}

const activities: Activity[] = [
  { type: 'jd_analysis', timestamp: '2025-05-26T14:30:00+08:00', description: 'JD 分析 v3，匹配度 92%', version: 3, score: 92 },
  { type: 'round_completed', timestamp: '2025-05-25T15:30:00+08:00', description: '完成阿里技术一面', schemeName: '阿里技术面试', roundName: '技术一面' },
  { type: 'round_scheduled', timestamp: '2025-05-25T10:00:00+08:00', description: '预约阿里技术二面', schemeName: '阿里技术面试', roundName: '技术二面' },
  { type: 'round_completed', timestamp: '2025-05-24T10:30:00+08:00', description: '完成阿里 HR 初面', schemeName: '阿里技术面试', roundName: 'HR 初面' },
  { type: 'jd_analysis', timestamp: '2025-05-25T16:20:00+08:00', description: 'JD 分析 v2，匹配度 88%', version: 2, score: 88 },
  { type: 'scheme_created', timestamp: '2025-05-20T10:00:00+08:00', description: '创建面试方案：阿里技术面试', schemeName: '阿里技术面试' },
  { type: 'jd_analysis', timestamp: '2025-05-24T10:15:00+08:00', description: 'JD 分析 v1，匹配度 85%', version: 1, score: 85 },
]

function fmtDateTime(iso: string): string {
  const d = new Date(iso)
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const min = String(d.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${min}`
}

const activityIconConfig: Record<
  ActivityType,
  { bg: string; border: string; textCls: string; Icon: React.ComponentType<React.SVGProps<SVGSVGElement>> }
> = {
  jd_analysis: {
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/20',
    textCls: 'text-pink-400',
    Icon: FileText,
  },
  round_completed: {
    bg: 'bg-green-500/10',
    border: 'border-green-500/20',
    textCls: 'text-green-400',
    Icon: Check,
  },
  round_scheduled: {
    bg: 'bg-blue-500/10',
    border: 'border-blue-500/20',
    textCls: 'text-blue-400',
    Icon: Calendar,
  },
  scheme_created: {
    bg: 'bg-yellow-500/10',
    border: 'border-yellow-500/20',
    textCls: 'text-yellow-400',
    Icon: Plus,
  },
}

function ActivityIcon({ type }: { type: ActivityType }) {
  const { bg, border, textCls, Icon } = activityIconConfig[type]
  return (
    <div
      className={`w-6 h-6 rounded-full ${bg} border ${border} flex items-center justify-center`}
    >
      <Icon className={`w-3 h-3 ${textCls}`} />
    </div>
  )
}

export default function HistoryTab(_props: HistoryTabProps) {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-sm font-semibold">活动历史</h2>
        <span className="text-[10px] text-muted-foreground">
          {activities.length} 条记录
        </span>
      </div>

      <div className="relative pl-8 space-y-4">
        <div className="absolute left-[11px] top-2 bottom-2 w-px bg-border" />
        {activities.map((activity, idx) => (
          <div key={idx} className="relative flex items-start gap-3">
            <div className="absolute left-[-24px] top-0">
              <ActivityIcon type={activity.type} />
            </div>
            <div className="flex-1 p-3 rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs break-all">{activity.description}</span>
                <span className="text-[10px] text-muted-foreground">
                  {fmtDateTime(activity.timestamp)}
                </span>
              </div>
              {activity.score && (
                <div className="text-[10px] text-green-400">
                  匹配度 {activity.score}%
                </div>
              )}
                  {activity.schemeName && (
                    <div className="text-[10px] text-muted-foreground break-all">
                      {activity.schemeName}
                      {activity.roundName ? ` · ${activity.roundName}` : ''}
                    </div>
                  )}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}