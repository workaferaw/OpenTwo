import { useState, useEffect, useCallback } from 'react'
import { create } from 'zustand'

interface ToastItem {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface ToastStore {
  toasts: ToastItem[]
  addToast: (message: string, type?: ToastItem['type']) => void
  removeToast: (id: string) => void
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  addToast: (message, type = 'info') =>
    set((state) => ({
      toasts: [...state.toasts, { id: `toast-${Date.now()}`, message, type }]
    })),
  removeToast: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }))
}))

function ToastContainer(): JSX.Element {
  const { toasts, removeToast } = useToastStore()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onDismiss={() => removeToast(toast.id)} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onDismiss }: { toast: ToastItem; onDismiss: () => void }): JSX.Element {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    requestAnimationFrame(() => setVisible(true))
    const timer = setTimeout(() => {
      setVisible(false)
      setTimeout(onDismiss, 200)
    }, 4000)
    return () => clearTimeout(timer)
  }, [onDismiss])

  const colors = {
    success: 'bg-green-500/90 border-green-400/30',
    error: 'bg-red-500/90 border-red-400/30',
    info: 'bg-surface-200 border-white/10'
  }

  const icons = {
    success: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <polyline points="20 6 9 17 4 12" />
      </svg>
    ),
    error: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
      </svg>
    ),
    info: (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
        <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
      </svg>
    )
  }

  return (
    <div
      className={`pointer-events-auto flex items-center gap-2 px-4 py-2.5 rounded-xl border backdrop-blur-sm text-white text-sm shadow-xl transition-all duration-200 ${
        colors[toast.type]
      } ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}`}
    >
      {icons[toast.type]}
      {toast.message}
    </div>
  )
}

export default ToastContainer
