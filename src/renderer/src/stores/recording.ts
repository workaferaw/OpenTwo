import { create } from 'zustand'

export type RecordingStatus = 'idle' | 'recording' | 'paused' | 'stopped'

export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
}

export interface CursorPoint {
  x: number
  y: number
  t: number
}

interface RecordingState {
  status: RecordingStatus
  selectedSource: DesktopSource | null
  mediaRecorder: MediaRecorder | null
  recordedChunks: Blob[]
  cursorData: CursorPoint[]
  startTime: number | null
  duration: number

  setStatus: (status: RecordingStatus) => void
  setSelectedSource: (source: DesktopSource | null) => void
  setMediaRecorder: (recorder: MediaRecorder | null) => void
  addChunk: (chunk: Blob) => void
  addCursorPoint: (point: CursorPoint) => void
  setStartTime: (time: number | null) => void
  setDuration: (duration: number) => void
  reset: () => void
}

export const useRecordingStore = create<RecordingState>((set) => ({
  status: 'idle',
  selectedSource: null,
  mediaRecorder: null,
  recordedChunks: [],
  cursorData: [],
  startTime: null,
  duration: 0,

  setStatus: (status) => set({ status }),
  setSelectedSource: (source) => set({ selectedSource: source }),
  setMediaRecorder: (recorder) => set({ mediaRecorder: recorder }),
  addChunk: (chunk) =>
    set((state) => ({ recordedChunks: [...state.recordedChunks, chunk] })),
  addCursorPoint: (point) =>
    set((state) => ({ cursorData: [...state.cursorData, point] })),
  setStartTime: (time) => set({ startTime: time }),
  setDuration: (duration) => set({ duration }),
  reset: () =>
    set({
      status: 'idle',
      mediaRecorder: null,
      recordedChunks: [],
      cursorData: [],
      startTime: null,
      duration: 0
    })
}))
