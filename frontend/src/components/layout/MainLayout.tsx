import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import Header from './Header'
import Sidebar from './Sidebar'

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="h-screen w-screen flex flex-col bg-[#121214]">
      <Header />
      <div className="flex-1 flex overflow-hidden">
        <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(prev => !prev)} />
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
