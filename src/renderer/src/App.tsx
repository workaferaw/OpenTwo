import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import TitleBar from './components/ui/TitleBar'
import ToastContainer from './components/ui/Toast'
import Onboarding from './components/ui/Onboarding'
import Recorder from './pages/Recorder'
import Editor from './pages/Editor'
import Settings from './pages/Settings'
import { useRecording } from './hooks/useRecording'

function AppRoutes(): JSX.Element {
  useRecording()
  const location = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (location.pathname === '/editor') {
      window.api.resizeWindow('editor')
    } else {
      window.api.resizeWindow('compact')
    }
  }, [location.pathname])

  return (
    <Routes>
      <Route path="/" element={<Recorder onOpenEditor={() => navigate('/editor')} onOpenSettings={() => navigate('/settings')} />} />
      <Route path="/editor" element={<Editor onBack={() => navigate('/')} />} />
      <Route path="/settings" element={<Settings onBack={() => navigate('/')} />} />
    </Routes>
  )
}

function App(): JSX.Element {
  const [showOnboarding, setShowOnboarding] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('opentwo-onboarding-seen')
    if (!seen) setShowOnboarding(true)
  }, [])

  const handleOnboardingComplete = () => {
    localStorage.setItem('opentwo-onboarding-seen', 'true')
    setShowOnboarding(false)
  }

  return (
    <HashRouter>
      <div className="flex flex-col h-screen w-screen overflow-hidden bg-surface">
        <TitleBar />
        <main className="flex-1 overflow-hidden">
          <AppRoutes />
        </main>
      </div>
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <ToastContainer />
    </HashRouter>
  )
}

export default App
