import { useState, useEffect } from 'react'
import { Plus } from 'lucide-react'
import WorkspaceCard from '../components/workspace/WorkspaceCard'
import CreateWorkspaceModal from '../components/workspace/CreateWorkspaceModal'
import { fetchWorkspaces, createWorkspace } from '../lib/api'
import type { Workspace } from '../types/workspace'

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  const hhmm = date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false })

  if (diffSec < 60) return '刚刚'
  if (diffMin < 60) return `${diffMin} 分钟前`
  if (diffHour < 24) return `${diffHour} 小时前`
  if (diffDay === 1) return `昨天 ${hhmm}`
  if (diffDay === 2) return `前天 ${hhmm}`

  const mmdd = date.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' }).replace(/\//g, '-')
  return `${mmdd} ${hhmm}`
}

const coverStyles: Array<'food' | 'portrait' | 'plant'> = ['food', 'portrait', 'plant']

export default function Dashboard() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [loading, setLoading] = useState(true)
  const [createModalOpen, setCreateModalOpen] = useState(false)

  const refreshWorkspaces = () => {
    fetchWorkspaces().then((data) => {
      setWorkspaces(data)
    })
  }

  useEffect(() => {
    fetchWorkspaces().then((data) => {
      setWorkspaces(data)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return <div className="text-gray-400">加载中...</div>
  }

  return (
    <div>
      <div className="flex items-start justify-between mb-8">
        <div>
          <div className="text-pink-500 text-xs font-medium tracking-widest mb-2">MANAGEMENT</div>
          <h1 className="text-4xl font-bold text-white mb-2">工作空间管理</h1>
          <p className="text-gray-400 text-sm">
            管理您的职业身份。Chiren 为不同岗位精准定制简历，帮助您在每个领域都展现出最佳状态。
          </p>
        </div>
        <button
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-pink-500 text-white hover:bg-pink-600 transition-colors text-sm font-medium"
          onClick={() => setCreateModalOpen(true)}
        >
          <Plus className="w-4 h-4" />
          新建工作空间
        </button>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {workspaces.map((ws, index) => (
          <WorkspaceCard
            key={ws.id}
            title={ws.title}
            domain={`${ws.template} 模板`}
            subResumeCount={ws.sub_resume_count}
            lastModified={formatRelativeTime(ws.updated_at)}
            coverStyle={coverStyles[index % 3]}
            isActive={ws.is_default}
          />
        ))}
      </div>

      <CreateWorkspaceModal
        open={createModalOpen}
        onClose={() => setCreateModalOpen(false)}
        onRefreshWs={refreshWorkspaces}
        onCreate={async (template, name) => {
          const newWs = await createWorkspace(template, name || undefined)
          setWorkspaces((prev) => [...prev, newWs])
          setCreateModalOpen(false)
        }}
      />
    </div>
  )
}
