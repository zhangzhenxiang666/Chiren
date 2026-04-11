import { useEffect, useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { FileText, Sparkles, Palette, Download, ChevronLeft, ChevronRight, Bell, Settings } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'
import { fetchWorkTasks } from '../../lib/api'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import MessageList from './MessageDropdown'
import SettingsModal from '../settings/SettingsModal'
import logoSvg from '../../assets/logo.svg'

const STORAGE_KEY = 'last_read_work_ts'

function markAllRead() {
  localStorage.setItem(STORAGE_KEY, Date.now().toString())
}

function getUnreadCount(tasks?: Array<{ createdAt: string | null }>): number {
  const ts = localStorage.getItem(STORAGE_KEY)
  if (!ts || !tasks) return 0
  const threshold = parseInt(ts, 10)
  return tasks.filter(t => t.createdAt && new Date(t.createdAt).getTime() > threshold).length
}

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()
  const [showSettings, setShowSettings] = useState(false)
  const [messagesOpen, setMessagesOpen] = useState(false)
  const queryClient = useQueryClient()

  const { data: tasks } = useQuery({
    queryKey: ['work-tasks'],
    queryFn: fetchWorkTasks,
    refetchInterval: 15000,
  })

  const unreadCount = useMemo(() => getUnreadCount(tasks), [tasks])

  useEffect(() => {
    if (messagesOpen && tasks) {
      markAllRead()
      queryClient.invalidateQueries({ queryKey: ['work-tasks'] })
    }
  }, [messagesOpen, tasks, queryClient])

  const navItems = [
    { label: '工作空间', path: '/', icon: FileText },
    { label: 'AI润色记录', path: '/polish', icon: Sparkles },
    { label: '模板库', path: '/templates', icon: Palette },
    { label: '导出记录', path: '/export', icon: Download },
  ]

  return (
    <>
      <aside
        className="bg-[#121214] border-r border-[#1e1e20] flex flex-col h-full transition-all duration-300 ease-in-out overflow-hidden"
        style={{ width: collapsed ? '64px' : '208px' }}
      >
        {/* Brand */}
        <div className="h-14 flex items-center px-4 border-b border-[#1e1e20] shrink-0 gap-3">
          <img src={logoSvg} alt="Chiren" className="w-7 h-7 shrink-0" />
          <span className="text-pink-500 font-bold text-lg whitespace-nowrap transition-opacity duration-300" style={{ opacity: collapsed ? 0 : 1 }}>Chiren</span>
        </div>

        {/* Nav items */}
        <nav className="flex-1 p-3 flex flex-col">
          <ul className="space-y-1">
            {navItems.map(({ label, path, icon: Icon }) => {
              const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
              return (
                <li key={path}>
                  <button
                    type="button"
                    onClick={() => navigate(path)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                      isActive
                        ? 'text-pink-400 bg-[#2a1a22]'
                        : 'text-gray-400 hover:text-white hover:bg-[#1e1e20]'
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-pink-500' : ''}`} />
                    <span className="text-sm whitespace-nowrap transition-opacity duration-300" style={{ opacity: collapsed ? 0 : 1 }}>{label}</span>
                  </button>
                </li>
              )
            })}
          </ul>

          <div className="mt-auto pt-3 space-y-1">
            <Popover open={messagesOpen} onOpenChange={setMessagesOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e1e20] transition-colors"
                >
                  <span className="relative shrink-0">
                    <Bell className="w-4 h-4" />
                    {unreadCount > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 min-w-3.5 h-3.5 bg-pink-500 rounded-full text-[9px] text-white flex items-center justify-center font-medium px-0.5">
                        {unreadCount > 99 ? '99+' : unreadCount}
                      </span>
                    )}
                  </span>
                  <span className="text-sm whitespace-nowrap transition-opacity duration-300" style={{ opacity: collapsed ? 0 : 1 }}>通知</span>
                </button>
              </PopoverTrigger>
              <PopoverContent
                side="right"
                align="start"
                sideOffset={12}
                className="w-96 p-0 bg-[#1a1a1c] border border-[#1e1e20] rounded-xl shadow-2xl"
              >
                <MessageList tasks={tasks || []} />
              </PopoverContent>
            </Popover>

            <button
              type="button"
              onClick={() => setShowSettings(true)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1e1e20] transition-colors"
            >
              <Settings className="w-4 h-4 shrink-0" />
              <span className="text-sm whitespace-nowrap transition-opacity duration-300" style={{ opacity: collapsed ? 0 : 1 }}>设置</span>
            </button>
          </div>
        </nav>

        {/* Footer: collapse toggle only */}
        <div className="border-t border-[#1e1e20] p-3">
          <button
            type="button"
            onClick={onToggle}
            className="flex items-center justify-center w-full h-8 rounded-lg text-gray-500 hover:text-white hover:bg-[#1e1e20] transition-colors"
          >
            {collapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            {!collapsed && <span className="ml-2 text-sm">折叠侧边栏</span>}
          </button>
        </div>
      </aside>

      <SettingsModal open={showSettings} onClose={() => setShowSettings(false)} />
    </>
  )
}
