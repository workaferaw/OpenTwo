import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  outputDir: string
  selectedMicId: string
  recordSystemAudio: boolean
  videoQuality: 'high' | 'medium' | 'low'
  cursorStyle: 'default' | 'highlight' | 'enlarged'
  showCursorHighlight: boolean

  setOutputDir: (dir: string) => void
  setSelectedMicId: (id: string) => void
  setRecordSystemAudio: (enabled: boolean) => void
  setVideoQuality: (quality: 'high' | 'medium' | 'low') => void
  setCursorStyle: (style: 'default' | 'highlight' | 'enlarged') => void
  setShowCursorHighlight: (show: boolean) => void
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      outputDir: '',
      selectedMicId: '',
      recordSystemAudio: true,
      videoQuality: 'high',
      cursorStyle: 'default',
      showCursorHighlight: true,

      setOutputDir: (dir) => set({ outputDir: dir }),
      setSelectedMicId: (id) => set({ selectedMicId: id }),
      setRecordSystemAudio: (enabled) => set({ recordSystemAudio: enabled }),
      setVideoQuality: (quality) => set({ videoQuality: quality }),
      setCursorStyle: (style) => set({ cursorStyle: style }),
      setShowCursorHighlight: (show) => set({ showCursorHighlight: show })
    }),
    { name: 'opentwo-settings' }
  )
)
