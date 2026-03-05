import { useNavigate } from 'react-router-dom'

function Home(): JSX.Element {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="text-center max-w-lg">
        <div className="w-20 h-20 rounded-2xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center mx-auto mb-6">
          <span className="text-3xl font-bold text-accent-400">O2</span>
        </div>

        <h1 className="text-3xl font-bold text-white mb-2">OpenTwo</h1>
        <p className="text-sm text-white/50 mb-10">
          Screen recording with zoom animations, blur regions, and phone-as-webcam.
          Built for tutorials, demos, and reactions.
        </p>

        <div className="flex flex-col gap-3 w-full max-w-xs mx-auto">
          <button
            onClick={() => navigate('/recording')}
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-accent-600 hover:bg-accent-500 text-white font-medium transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <circle cx="12" cy="12" r="8" />
            </svg>
            New Recording
          </button>

          <button
            onClick={() => navigate('/editor')}
            className="flex items-center justify-center gap-2 h-12 rounded-xl bg-surface-200 hover:bg-surface-300 text-white/70 font-medium transition-colors"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
              <polyline points="14 2 14 8 20 8" />
            </svg>
            Open Project
          </button>
        </div>
      </div>

      <div className="absolute bottom-6 text-center">
        <p className="text-[10px] text-white/20">
          OpenTwo v0.1.0 — Open Source (MIT)
        </p>
      </div>
    </div>
  )
}

export default Home
