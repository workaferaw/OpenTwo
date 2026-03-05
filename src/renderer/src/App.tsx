import { HashRouter, Routes, Route } from 'react-router-dom'
import TitleBar from './components/ui/TitleBar'
import Sidebar from './components/ui/Sidebar'
import Home from './pages/Home'
import Recording from './pages/Recording'
import Editor from './pages/Editor'
import Settings from './pages/Settings'

function App(): JSX.Element {
  return (
    <HashRouter>
      <div className="flex flex-col h-screen w-screen overflow-hidden">
        <TitleBar />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar />
          <main className="flex-1 overflow-y-auto bg-surface">
            <Routes>
              <Route path="/" element={<Home />} />
              <Route path="/recording" element={<Recording />} />
              <Route path="/editor" element={<Editor />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </HashRouter>
  )
}

export default App
