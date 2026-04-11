import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Toaster } from 'sonner'
import Sidebar from './Sidebar'

export default function MainLayout() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className="h-screen w-full flex bg-[#121214]">
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(prev => !prev)} />
      <main className="flex-1 min-h-0 p-6">
        <Outlet />
      </main>
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
