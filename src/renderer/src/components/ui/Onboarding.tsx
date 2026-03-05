import { useState } from 'react'

interface OnboardingProps {
  onComplete: () => void
}

const steps = [
  {
    title: 'Welcome to OpenTwo',
    description: 'The open-source screen recording tool with zoom animations, blur regions, and phone-as-webcam. Built for tutorial creators.',
    icon: (
      <div className="w-20 h-20 rounded-2xl bg-accent-500/20 border border-accent-500/30 flex items-center justify-center">
        <span className="text-3xl font-bold text-accent-400">O2</span>
      </div>
    )
  },
  {
    title: 'Record Your Screen',
    description: 'Pick any screen or window to record. Your cursor position is tracked alongside the video for smart zoom animations later.',
    icon: (
      <div className="w-20 h-20 rounded-2xl bg-red-500/20 border border-red-500/30 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-red-400">
          <circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="4" fill="currentColor" />
        </svg>
      </div>
    )
  },
  {
    title: 'Edit with Zoom & Blur',
    description: 'Add zoom animations that follow your cursor, blur sensitive areas, trim your clip, and choose an aspect ratio — all in the built-in editor.',
    icon: (
      <div className="w-20 h-20 rounded-2xl bg-purple-500/20 border border-purple-500/30 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-purple-400">
          <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          <line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" />
        </svg>
      </div>
    )
  },
  {
    title: 'Keyboard Shortcuts',
    description: 'F9 to start or pause recording, F10 to stop. These work even when OpenTwo is in the background.',
    icon: (
      <div className="w-20 h-20 rounded-2xl bg-green-500/20 border border-green-500/30 flex items-center justify-center">
        <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-green-400">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <line x1="6" y1="8" x2="6.01" y2="8" /><line x1="10" y1="8" x2="10.01" y2="8" />
          <line x1="14" y1="8" x2="14.01" y2="8" /><line x1="18" y1="8" x2="18.01" y2="8" />
          <line x1="6" y1="16" x2="18" y2="16" />
        </svg>
      </div>
    )
  }
]

function Onboarding({ onComplete }: OnboardingProps): JSX.Element {
  const [step, setStep] = useState(0)
  const current = steps[step]
  const isLast = step === steps.length - 1

  return (
    <div className="fixed inset-0 z-50 bg-surface/95 backdrop-blur-sm flex items-center justify-center">
      <div className="w-full max-w-md text-center px-8">
        <div className="flex justify-center mb-6">{current.icon}</div>
        <h2 className="text-xl font-semibold text-white mb-2">{current.title}</h2>
        <p className="text-sm text-white/50 mb-8 leading-relaxed">{current.description}</p>

        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i === step ? 'bg-accent-500' : 'bg-white/15'}`} />
          ))}
        </div>

        <div className="flex items-center justify-center gap-3">
          {step > 0 && (
            <button onClick={() => setStep(step - 1)}
              className="px-5 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 text-white/60 text-sm transition-colors">
              Back
            </button>
          )}
          <button onClick={isLast ? onComplete : () => setStep(step + 1)}
            className="px-6 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium transition-colors">
            {isLast ? 'Get Started' : 'Next'}
          </button>
        </div>

        {!isLast && (
          <button onClick={onComplete} className="mt-4 text-xs text-white/30 hover:text-white/50 transition-colors">
            Skip intro
          </button>
        )}
      </div>
    </div>
  )
}

export default Onboarding
