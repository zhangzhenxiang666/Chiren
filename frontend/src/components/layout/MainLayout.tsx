import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
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
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#1c1c1e',
            border: '1px solid #2a2a2e',
            color: '#fff',
          },
        }}
      />
    </div>
  )
}
