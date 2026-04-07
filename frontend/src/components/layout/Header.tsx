import { Search, Bell, Settings } from 'lucide-react'
import { currentUser } from '../../data/mockData'

export default function Header() {
  return (
    <header className="h-14 bg-[#121214] border-b border-[#1e1e20] flex items-center justify-between px-6">
      {/* 左侧 Logo + 导航 */}
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-1 shrink-0">
          <span className="text-pink-500 font-bold text-lg">Chiren</span>
        </div>
        <nav className="flex items-center gap-6">
          <button className="text-pink-500 font-medium text-sm border-b-2 border-pink-500 pb-0.5">
            控制面板
          </button>
          <button className="text-gray-400 hover:text-white text-sm transition-colors">
            AI实验室
          </button>
        </nav>
      </div>

      {/* 右侧 */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2 bg-[#1a1a1c] rounded-lg px-3 py-2">
          <Search className="w-4 h-4 text-gray-500" />
          <input
            type="text"
            placeholder="搜索简历..."
            className="bg-transparent text-gray-300 text-sm outline-none placeholder-gray-500 w-48"
          />
        </div>
        <button className="text-gray-400 hover:text-white transition-colors">
          <Bell className="w-5 h-5" />
        </button>
        <button className="text-gray-400 hover:text-white transition-colors">
          <Settings className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white text-xs font-medium">
          {currentUser.name.charAt(0)}
        </div>
      </div>
    </header>
  )
}
