import ffmpeg from 'fluent-ffmpeg'
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg'

ffmpeg.setFfmpegPath(ffmpegPath)

export interface ExportOptions {
  inputPath: string
  outputPath: string
  format: 'mp4' | 'webm'
  resolution: '720p' | '1080p' | '4k'
  fps: number
}

const resolutionMap = {
  '720p': '1280x720',
  '1080p': '1920x1080',
  '4k': '3840x2160'
}

export function exportVideo(
  options: ExportOptions,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const command = ffmpeg(options.inputPath)
      .output(options.outputPath)
      .size(resolutionMap[options.resolution])
      .fps(options.fps)
      .videoCodec(options.format === 'mp4' ? 'libx264' : 'libvpx-vp9')
      .audioCodec(options.format === 'mp4' ? 'aac' : 'libopus')

    if (onProgress) {
      command.on('progress', (progress) => {
        onProgress(progress.percent ?? 0)
      })
    }

    command
      .on('end', () => resolve(options.outputPath))
      .on('error', (err) => reject(err))
      .run()
  })
}

export function getVideoInfo(filePath: string): Promise<ffmpeg.FfprobeData> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(filePath, (err, data) => {
      if (err) reject(err)
      else resolve(data)
    })
  })
}
