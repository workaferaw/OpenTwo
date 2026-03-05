function Editor(): JSX.Element {
  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 rounded-xl bg-surface-200 flex items-center justify-center mx-auto mb-4">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
              <rect x="2" y="2" width="20" height="20" rx="2" />
              <line x1="2" y1="16" x2="22" y2="16" />
              <line x1="6" y1="20" x2="6" y2="16" />
              <line x1="10" y1="20" x2="10" y2="16" />
              <line x1="14" y1="20" x2="14" y2="16" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-white/80 mb-2">Editor</h2>
          <p className="text-sm text-white/40 mb-6">
            Record a screen capture first, then edit it here with zoom animations,
            blur regions, and more.
          </p>
          <p className="text-xs text-white/20">
            Timeline, zoom keyframes, blur tools, and export coming in the next update.
          </p>
        </div>
      </div>
    </div>
  )
}

export default Editor
