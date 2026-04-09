import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Search, Bell, Settings } from 'lucide-react'
import { currentUser } from '../../data/mockData'
import { fetchWorkTasks } from '../../lib/api'
import MessageDropdown from './MessageDropdown'
import SettingsModal from '../settings/SettingsModal'

const STORAGE_KEY = 'last_read_work_ts'

function markAllRead() {
  localStorage.setItem(STORAGE_KEY, Date.now().toString())
}

function getUnreadCount(tasks?: Array<{ created_at: string | null }>): number {
  const ts = localStorage.getItem(STORAGE_KEY)
  if (!ts || !tasks) return 0
  const threshold = parseInt(ts, 10)
  return tasks.filter(t => t.created_at && new Date(t.created_at).getTime() > threshold).length
}

export default function Header() {
  const [showMessages, setShowMessages] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const queryClient = useQueryClient()

  const { data: tasks } = useQuery({
    queryKey: ['work-tasks'],
    queryFn: fetchWorkTasks,
    refetchInterval: 15000,
  })

  const unreadCount = useMemo(() => getUnreadCount(tasks), [tasks])

  useEffect(() => {
    if (showMessages && tasks) {
      markAllRead()
      queryClient.invalidateQueries({ queryKey: ['work-tasks'] })
    }
  }, [showMessages])

  return (
    <>
      <header className="h-14 bg-[#121214] border-b border-[#1e1e20] flex items-center justify-between px-6">
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

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-[#1a1a1c] rounded-lg px-3 py-2">
            <Search className="w-4 h-4 text-gray-500" />
            <input
              type="text"
              placeholder="搜索简历..."
              className="bg-transparent text-gray-300 text-sm outline-none placeholder-gray-500 w-48"
            />
          </div>
          <button
            className="relative text-gray-400 hover:text-white transition-colors"
            onClick={() => setShowMessages(prev => !prev)}
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-4 h-4 bg-pink-500 rounded-full text-[10px] text-white flex items-center justify-center font-medium px-1">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>
          <button
            className="text-gray-400 hover:text-white transition-colors"
            onClick={() => setShowSettings(true)}
          >
            <Settings className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-orange-500 to-pink-500 flex items-center justify-center text-white text-xs font-medium">
            {currentUser.name.charAt(0)}
          </div>
        </div>
      </header>

      {showMessages && <MessageDropdown onClose={() => setShowMessages(false)} tasks={tasks || []} />}
      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  )
}
