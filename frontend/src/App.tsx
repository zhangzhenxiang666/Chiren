import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import Dashboard from './pages/Dashboard'
import TemplateGallery from './pages/TemplateGallery'
import EditorPage from './pages/EditorPage'
import WorkspaceDetail from './pages/WorkspaceDetail'
import NotFoundPage from './pages/NotFoundPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Navigate to="/workspace" replace />} />
          <Route path="templates" element={<TemplateGallery />} />
          <Route path="workspace" element={<Dashboard />} />
          <Route path="workspace/:id" element={<WorkspaceDetail />} />
        </Route>
        <Route path="workspace/:id/template/edit" element={<EditorPage />} />
        <Route path="workspace/:id/resumes/:resumeId/edit" element={<EditorPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
