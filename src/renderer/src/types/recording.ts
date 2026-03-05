export interface CursorPoint {
  x: number
  y: number
  t: number
}

export interface RecordingMetadata {
  sourceId: string
  sourceName: string
  startedAt: string
  duration: number
  resolution: { width: number; height: number }
  hasAudio: boolean
  hasMicAudio: boolean
}

export interface DesktopSource {
  id: string
  name: string
  thumbnail: string
}
