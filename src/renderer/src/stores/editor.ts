import { create } from 'zustand'

export interface ZoomKeyframe {
  id: string
  timestamp: number
  region: { x: number; y: number; width: number; height: number }
  duration: number
  easing: 'ease-in-out' | 'ease-in' | 'ease-out' | 'linear' | 'spring'
}

export interface BlurRegion {
  id: string
  startTime: number
  endTime: number
  region: { x: number; y: number; width: number; height: number }
}

interface EditorState {
  projectPath: string | null
  videoSrc: string | null
  currentTime: number
  duration: number
  isPlaying: boolean
  zoomKeyframes: ZoomKeyframe[]
  blurRegions: BlurRegion[]

  setProjectPath: (path: string | null) => void
  setVideoSrc: (src: string | null) => void
  setCurrentTime: (time: number) => void
  setDuration: (duration: number) => void
  setIsPlaying: (playing: boolean) => void
  addZoomKeyframe: (keyframe: ZoomKeyframe) => void
  removeZoomKeyframe: (id: string) => void
  addBlurRegion: (region: BlurRegion) => void
  removeBlurRegion: (id: string) => void
  reset: () => void
}

export const useEditorStore = create<EditorState>((set) => ({
  projectPath: null,
  videoSrc: null,
  currentTime: 0,
  duration: 0,
  isPlaying: false,
  zoomKeyframes: [],
  blurRegions: [],

  setProjectPath: (path) => set({ projectPath: path }),
  setVideoSrc: (src) => set({ videoSrc: src }),
  setCurrentTime: (time) => set({ currentTime: time }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  addZoomKeyframe: (keyframe) =>
    set((state) => ({ zoomKeyframes: [...state.zoomKeyframes, keyframe] })),
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
  reset: () =>
    set({
      projectPath: null,
      videoSrc: null,
      currentTime: 0,
      duration: 0,
      isPlaying: false,
      zoomKeyframes: [],
      blurRegions: []
    })
}))
