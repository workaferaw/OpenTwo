import { create } from 'zustand'

export interface ZoomKeyframe {
  id: string
  timestamp: number
  region: { x: number; y: number; width: number; height: number }
  duration: number
  transitionIn: number
  transitionOut: number
  easing: 'ease-in-out' | 'ease-in' | 'ease-out' | 'linear' | 'spring'
}

export interface BlurRegion {
  id: string
  startTime: number
  endTime: number
  region: { x: number; y: number; width: number; height: number }
}

export type AspectRatio = '16:9' | '9:16' | '4:3' | '1:1' | 'original'

export interface CursorFollowConfig {
  enabled: boolean
  zoomFactor: number
  smoothing: number
}

export interface BackgroundConfig {
  type: 'solid' | 'gradient' | 'image'
  color: string
  gradientFrom: string
  gradientTo: string
  imagePath: string
}

interface EditorState {
  projectPath: string | null
  videoSrc: string | null
  currentTime: number
  duration: number
  isPlaying: boolean
  zoomKeyframes: ZoomKeyframe[]
  blurRegions: BlurRegion[]
  trimStart: number
  trimEnd: number
  splitPoints: number[]
  aspectRatio: AspectRatio
  background: BackgroundConfig
  showBrowserFrame: boolean
  cursorFollow: CursorFollowConfig

  setProjectPath: (path: string | null) => void
  setVideoSrc: (src: string | null) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setIsPlaying: (playing: boolean) => void
  addZoomKeyframe: (keyframe: ZoomKeyframe) => void
  updateZoomKeyframe: (id: string, updates: Partial<ZoomKeyframe>) => void
  removeZoomKeyframe: (id: string) => void
  addBlurRegion: (region: BlurRegion) => void
  removeBlurRegion: (id: string) => void
  setTrimStart: (time: number) => void
  setTrimEnd: (time: number) => void
  addSplitPoint: (time: number) => void
  removeSplitPoint: (time: number) => void
  setAspectRatio: (ratio: AspectRatio) => void
  setBackground: (bg: Partial<BackgroundConfig>) => void
  setShowBrowserFrame: (show: boolean) => void
  setCursorFollow: (config: Partial<CursorFollowConfig>) => void
  reset: () => void
}

const defaultCursorFollow: CursorFollowConfig = {
  enabled: false,
  zoomFactor: 2,
  smoothing: 0.08
}

const defaultBackground: BackgroundConfig = {
  type: 'solid',
  color: '#000000',
  gradientFrom: '#1a1a2e',
  gradientTo: '#16213e',
  imagePath: ''
}

export const useEditorStore = create<EditorState>((set) => ({
  projectPath: null,
  videoSrc: null,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  zoomKeyframes: [],
  blurRegions: [],
  trimStart: 0,
  trimEnd: 0,
  splitPoints: [],
  aspectRatio: 'original',
  background: { ...defaultBackground },
  showBrowserFrame: false,
  cursorFollow: { ...defaultCursorFollow },

  setProjectPath: (path) => set({ projectPath: path }),
  setVideoSrc: (src) => set({ videoSrc: src }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration, trimEnd: duration }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  addZoomKeyframe: (keyframe) =>
    set((state) => ({ zoomKeyframes: [...state.zoomKeyframes, keyframe] })),
  updateZoomKeyframe: (id, updates) =>
    set((state) => ({
      zoomKeyframes: state.zoomKeyframes.map((k) =>
        k.id === id ? { ...k, ...updates } : k
      )
    })),
  removeZoomKeyframe: (id) =>
    set((state) => ({
      zoomKeyframes: state.zoomKeyframes.filter((k) => k.id !== id)
    })),
  addBlurRegion: (region) =>
    set((state) => ({ blurRegions: [...state.blurRegions, region] })),
  removeBlurRegion: (id) =>
    set((state) => ({
      blurRegions: state.blurRegions.filter((r) => r.id !== id)
    })),
  setTrimStart: (time) => set({ trimStart: time }),
  setTrimEnd: (time) => set({ trimEnd: time }),
  addSplitPoint: (time) =>
    set((state) => ({
      splitPoints: [...state.splitPoints, time].sort((a, b) => a - b)
    })),
  removeSplitPoint: (time) =>
    set((state) => ({
      splitPoints: state.splitPoints.filter((t) => Math.abs(t - time) > 0.1)
    })),
  setAspectRatio: (ratio) => set({ aspectRatio: ratio }),
  setBackground: (bg) =>
    set((state) => ({ background: { ...state.background, ...bg } })),
  setShowBrowserFrame: (show) => set({ showBrowserFrame: show }),
  setCursorFollow: (config) =>
    set((state) => ({ cursorFollow: { ...state.cursorFollow, ...config } })),
  reset: () =>
    set({
      projectPath: null,
      videoSrc: null,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      zoomKeyframes: [],
      blurRegions: [],
      trimStart: 0,
      trimEnd: 0,
      splitPoints: [],
      aspectRatio: 'original',
      background: { ...defaultBackground },
      showBrowserFrame: false,
      cursorFollow: { ...defaultCursorFollow }
    })
}))
