import { Plus } from 'lucide-react'
import WorkspaceCard from '../components/workspace/WorkspaceCard'
import { workspaces } from '../data/mockData'

export default function Dashboard() {
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
          onClick={() => console.log('新建工作空间')}
        >
          <Plus className="w-4 h-4" />
          新建工作空间
        </button>
      </div>

      <div className="grid grid-cols-3 gap-5">
        {workspaces.map((ws, index) => (
          <WorkspaceCard
            key={index}
            title={ws.title}
            domain={ws.domain}
            subResumeCount={ws.subResumeCount}
            lastModified={ws.lastModified}
            coverStyle={ws.coverStyle}
            isActive={ws.isActive}
          />
        ))}
      </div>
    </div>
  )
}
