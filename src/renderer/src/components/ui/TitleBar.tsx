import { useState, useEffect } from 'react'

function TitleBar(): JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.api.isMaximized().then(setIsMaximized)
  }, [])

  const handleMinimize = () => window.api.minimizeWindow()
  const handleMaximize = async () => {
    await window.api.maximizeWindow()
    setIsMaximized(await window.api.isMaximized())
  }
  const handleClose = () => window.api.closeWindow()

  return (
    <div className="flex items-center justify-between h-9 bg-surface-100 border-b border-white/5 select-none"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}>
      <div className="flex items-center gap-2 px-4">
        <div className="w-5 h-5 rounded bg-accent-500 flex items-center justify-center">
          <span className="text-[10px] font-bold text-white">O2</span>
        </div>
        <span className="text-xs font-medium text-white/70">OpenTwo</span>
      </div>

      <div className="flex items-center" style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}>
        <button onClick={handleMinimize}
          className="h-9 w-12 flex items-center justify-center hover:bg-white/10 transition-colors">
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor" className="text-white/60">
            <rect width="10" height="1" />
          </svg>
        </button>
        <button onClick={handleMaximize}
          className="h-9 w-12 flex items-center justify-center hover:bg-white/10 transition-colors">
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
              strokeWidth="1" className="text-white/60">
              <rect x="2" y="0" width="8" height="8" rx="1" />
              <rect x="0" y="2" width="8" height="8" rx="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor"
              strokeWidth="1" className="text-white/60">
              <rect x="0.5" y="0.5" width="9" height="9" rx="1" />
            </svg>
          )}
        </button>
        <button onClick={handleClose}
          className="h-9 w-12 flex items-center justify-center hover:bg-red-500/80 transition-colors">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor" className="text-white/60">
            <path d="M1 1L9 9M9 1L1 9" stroke="currentColor" strokeWidth="1.2" fill="none" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default TitleBar
