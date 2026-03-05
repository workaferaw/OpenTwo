import { existsSync } from 'fs'
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg'

export function isFfmpegAvailable(): boolean {
  return existsSync(ffmpegPath)
}

export function getFfmpegPath(): string {
  return ffmpegPath
}
