export interface ProjectFile {
  name: string
  createdAt: string
  duration: number
  resolution: { width: number; height: number }
  files: {
    recording: string
    cursorData: string
    micAudio?: string
  }
  zoomKeyframes: ZoomKeyframeData[]
  blurRegions: BlurRegionData[]
  trimPoints: { start: number; end: number }
}

export interface ZoomKeyframeData {
  id: string
  timestamp: number
  region: { x: number; y: number; width: number; height: number }
  duration: number
  easing: 'ease-in-out' | 'ease-in' | 'ease-out' | 'linear' | 'spring'
}

export interface BlurRegionData {
  id: string
  startTime: number
  endTime: number
  region: { x: number; y: number; width: number; height: number }
}
