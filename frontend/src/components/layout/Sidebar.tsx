import { FileText, Sparkles, Palette, Download, ChevronLeft, ChevronRight } from 'lucide-react'
import { useNavigate, useLocation } from 'react-router-dom'

export default function Sidebar({ collapsed, onToggle }: { collapsed: boolean; onToggle: () => void }) {
  const navigate = useNavigate()
  const location = useLocation()

  const navItems = [
    { label: '工作空间', path: '/', icon: FileText },
    { label: 'AI润色记录', path: '/polish', icon: Sparkles },
    { label: '模板库', path: '/templates', icon: Palette },
    { label: '导出记录', path: '/export', icon: Download },
  ]

  return (
    <aside
      className="bg-[#121214] border-r border-[#1e1e20] flex flex-col h-full transition-all duration-300 ease-in-out overflow-hidden"
      style={{ width: collapsed ? '64px' : '208px' }}
    >
      <nav className="flex-1 p-3">
        <ul className="space-y-1">
          {navItems.map(({ label, path, icon: Icon }) => {
            const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path)
            return (
              <li key={path}>
                <button
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
      </nav>

      <div className="border-t border-[#1e1e20] p-3">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center gap-3 px-3 py-2.5 rounded-lg text-gray-500 hover:text-white hover:bg-[#1e1e20] transition-colors"
        >
          {collapsed ? <ChevronRight className="w-4 h-4 shrink-0" /> : <><ChevronLeft className="w-4 h-4 shrink-0" /><span className="text-xs whitespace-nowrap transition-opacity duration-300" style={{ opacity: collapsed ? 0 : 1 }}>收起侧边栏</span></>}
        </button>
      </div>
    </aside>
  )
}
