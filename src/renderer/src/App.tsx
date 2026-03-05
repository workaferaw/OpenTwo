import { useState, useEffect } from 'react'
import { HashRouter, Routes, Route } from 'react-router-dom'
import TitleBar from './components/ui/TitleBar'
import Sidebar from './components/ui/Sidebar'
import ToastContainer from './components/ui/Toast'
import Onboarding from './components/ui/Onboarding'
import Home from './pages/Home'
import Recording from './pages/Recording'
import Editor from './pages/Editor'
import Settings from './pages/Settings'
import { useRecording } from './hooks/useRecording'

function AppRoutes(): JSX.Element {
  useRecording()

  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/recording" element={<Recording />} />
      <Route path="/editor" element={<Editor />} />
      <Route path="/settings" element={<Settings />} />
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
      <div className="flex flex-col h-screen w-screen overflow-hidden">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-surface">
            <AppRoutes />
          </main>
        </div>
      </div>
      {showOnboarding && <Onboarding onComplete={handleOnboardingComplete} />}
      <ToastContainer />
    </HashRouter>
  )
}

export default App
