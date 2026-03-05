import ffmpeg from 'fluent-ffmpeg'
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg'

ffmpeg.setFfmpegPath(ffmpegPath)

export interface ExportOptions {
  inputPath: string
  outputPath: string
  format: 'mp4' | 'webm'
  resolution: '720p' | '1080p' | '4k'
  fps: number
  blurRegions?: BlurFilterRegion[]
}

export interface BlurFilterRegion {
  x: number
  y: number
  width: number
  height: number
  startTime: number
  endTime: number
}

const resolutionMap: Record<string, string> = {
  '720p': '1280:720',
  '1080p': '1920:1080',
  '4k': '3840:2160'
}

function buildBlurFilterComplex(regions: BlurFilterRegion[], resolution: string): string {
  if (!regions || regions.length === 0) {
    return `scale=${resolution}`
  }

  const parts: string[] = [`[0:v]scale=${resolution}[base]`]
  let prevLabel = 'base'

  regions.forEach((r, i) => {
    const outLabel = i === regions.length - 1 ? 'out' : `v${i}`
    const cropW = Math.round(r.width)
    const cropH = Math.round(r.height)
    const cropX = Math.round(r.x)
    const cropY = Math.round(r.y)

    parts.push(
      `[${prevLabel}]split[main${i}][blur_src${i}]`,
      `[blur_src${i}]crop=${cropW}:${cropH}:${cropX}:${cropY},boxblur=20:5[blurred${i}]`,
      `[main${i}][blurred${i}]overlay=${cropX}:${cropY}:enable='between(t,${r.startTime},${r.endTime})'[${outLabel}]`
    )
    prevLabel = outLabel
  })

  return parts.join(';')
}

export function exportVideo(
  options: ExportOptions,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    const resolution = resolutionMap[options.resolution] || resolutionMap['1080p']

    const command = ffmpeg(options.inputPath).output(options.outputPath).fps(options.fps)

    if (options.blurRegions && options.blurRegions.length > 0) {
      const filterComplex = buildBlurFilterComplex(options.blurRegions, resolution)
      command.complexFilter(filterComplex, 'out')
    } else {
      command.videoFilter(`scale=${resolution}`)
    }

    if (options.format === 'mp4') {
      command.videoCodec('libx264').audioCodec('aac').outputOptions(['-preset', 'fast', '-crf', '23'])
    } else {
      command.videoCodec('libvpx-vp9').audioCodec('libopus')
    }

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
