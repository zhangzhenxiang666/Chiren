import { BrowserRouter, Routes, Route } from 'react-router-dom'
import MainLayout from './components/layout/MainLayout'
import Dashboard from './pages/Dashboard'
import WorkspaceStub from './pages/WorkspaceStub'
import TemplateGallery from './pages/TemplateGallery'
import EditorPage from './pages/EditorPage'
import './App.css'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MainLayout />}>
          <Route index element={<Dashboard />} />
          <Route path="templates" element={<TemplateGallery />} />
        </Route>
        <Route path="/workspace/:id" element={<EditorPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App
