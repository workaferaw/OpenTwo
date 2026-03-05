import { useState, useEffect } from 'react'

function TitleBar(): JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    window.api.isMaximized().then(setIsMaximized)
  }, [])

  const handleMinimize = (): void => { window.api.minimizeWindow() }
  const handleMaximize = async (): Promise<void> => {
    await window.api.maximizeWindow()
    setIsMaximized(await window.api.isMaximized())
  }
  const handleClose = (): void => { window.api.closeWindow() }

  return (
    <div
      className="flex items-center justify-end h-8 bg-transparent select-none shrink-0"
      style={{ WebkitAppRegion: 'drag' } as React.CSSProperties}
    >
      <div
        className="flex items-center"
        style={{ WebkitAppRegion: 'no-drag' } as React.CSSProperties}
      >
        <button
          onClick={handleMinimize}
          className="h-8 w-10 flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors"
        >
          <svg width="10" height="1" viewBox="0 0 10 1" fill="currentColor"><rect width="10" height="1" /></svg>
        </button>
        <button
          onClick={handleMaximize}
          className="h-8 w-10 flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors"
        >
          {isMaximized ? (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="2" y="0" width="8" height="8" rx="1" /><rect x="0" y="2" width="8" height="8" rx="1" />
            </svg>
          ) : (
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1">
              <rect x="0.5" y="0.5" width="9" height="9" rx="1" />
            </svg>
          )}
        </button>
        <button
          onClick={handleClose}
          className="h-8 w-10 flex items-center justify-center text-white/25 hover:text-white hover:bg-red-500 transition-colors"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.3">
            <path d="M1 1L9 9M9 1L1 9" />
          </svg>
        </button>
      </div>
    </div>
  )
}

export default TitleBar
