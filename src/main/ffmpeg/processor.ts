import ffmpeg from 'fluent-ffmpeg'
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg'
import { writeFile } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

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
  if (!regions || regions.length === 0) return `scale=${resolution}`
  const parts: string[] = [`[0:v]scale=${resolution}[base]`]
  let prevLabel = 'base'
  regions.forEach((r, i) => {
    const outLabel = i === regions.length - 1 ? 'out' : `v${i}`
    parts.push(
      `[${prevLabel}]split[main${i}][blur_src${i}]`,
      `[blur_src${i}]crop=${Math.round(r.width)}:${Math.round(r.height)}:${Math.round(r.x)}:${Math.round(r.y)},boxblur=20:5[blurred${i}]`,
      `[main${i}][blurred${i}]overlay=${Math.round(r.x)}:${Math.round(r.y)}:enable='between(t,${r.startTime},${r.endTime})'[${outLabel}]`
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
      command.complexFilter(buildBlurFilterComplex(options.blurRegions, resolution), 'out')
    } else {
      command.videoFilter(`scale=${resolution}`)
    }
    if (options.format === 'mp4') {
      command.videoCodec('libx264').audioCodec('aac').outputOptions(['-preset', 'fast', '-crf', '23'])
    } else {
      command.videoCodec('libvpx-vp9').audioCodec('libopus')
    }
    if (onProgress) command.on('progress', (p) => onProgress(p.percent ?? 0))
    command.on('end', () => resolve(options.outputPath)).on('error', (e) => reject(e)).run()
  })
}

// --- Click-triggered zoom (Cursorful-style) ---

interface ClickEvent {
  x: number
  y: number
  t: number
  button: number
}

interface CursorPt {
  x: number
  y: number
  t: number
}

interface ZoomSegment {
  startMs: number
  endMs: number
  centerX: number
  centerY: number
  zoomFactor: number
  transitionInMs: number
  transitionOutMs: number
}

const CLICK_BURST_WINDOW_MS = 3000
const MIN_CLICKS_FOR_ZOOM = 2
const ZOOM_HOLD_AFTER_LAST_CLICK_MS = 1500
const DEFAULT_ZOOM_FACTOR = 2.0
const TRANSITION_IN_MS = 400
const TRANSITION_OUT_MS = 500
const MIN_GAP_BETWEEN_SEGMENTS_MS = 300

function detectClickZoomSegments(clicks: ClickEvent[], cursorData: CursorPt[]): ZoomSegment[] {
  if (clicks.length < MIN_CLICKS_FOR_ZOOM) return []

  const segments: ZoomSegment[] = []
  let burstStart = 0

  for (let i = 1; i <= clicks.length; i++) {
    const gapToNext = i < clicks.length ? clicks[i].t - clicks[i - 1].t : Infinity

    if (gapToNext > CLICK_BURST_WINDOW_MS || i === clicks.length) {
      const burstClicks = clicks.slice(burstStart, i)
      if (burstClicks.length >= MIN_CLICKS_FOR_ZOOM) {
        let cx = 0, cy = 0
        for (const c of burstClicks) { cx += c.x; cy += c.y }
        cx /= burstClicks.length
        cy /= burstClicks.length

        const startMs = burstClicks[0].t
        const endMs = burstClicks[burstClicks.length - 1].t + ZOOM_HOLD_AFTER_LAST_CLICK_MS

        const last = segments[segments.length - 1]
        if (!last || startMs - last.endMs > MIN_GAP_BETWEEN_SEGMENTS_MS) {
          segments.push({
            startMs, endMs,
            centerX: cx, centerY: cy,
            zoomFactor: DEFAULT_ZOOM_FACTOR,
            transitionInMs: TRANSITION_IN_MS,
            transitionOutMs: TRANSITION_OUT_MS
          })
        }
      }
      burstStart = i
    }
  }

  return segments
}

function interpolateCursor(data: CursorPt[], timeMs: number): { x: number; y: number } {
  if (data.length === 0) return { x: 0, y: 0 }
  if (timeMs <= data[0].t) return { x: data[0].x, y: data[0].y }
  const last = data[data.length - 1]
  if (timeMs >= last.t) return { x: last.x, y: last.y }
  let lo = 0, hi = data.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (data[mid].t <= timeMs) lo = mid; else hi = mid
  }
  const a = data[lo], b = data[hi]
  const frac = (timeMs - a.t) / (b.t - a.t || 1)
  return { x: a.x + (b.x - a.x) * frac, y: a.y + (b.y - a.y) * frac }
}

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

export interface ReadyExportOptions {
  inputPath: string
  outputPath: string
  cursorData: CursorPt[]
  clickEvents?: ClickEvent[]
  zoomFactor?: number
  smoothing?: number
}

export function exportReadyVideo(
  options: ReadyExportOptions,
  onProgress?: (percent: number) => void
): Promise<string> {
  return new Promise((resolve, reject) => {
    ffmpeg.ffprobe(options.inputPath, async (err, probe) => {
      if (err) return reject(err)

      const videoStream = probe.streams.find((s) => s.codec_type === 'video')
      if (!videoStream) return reject(new Error('No video stream found'))

      const vw = videoStream.width || 1920
      const vh = videoStream.height || 1080
      const durationSec = parseFloat(String(probe.format.duration || 0))
      if (durationSec <= 0) return reject(new Error('Cannot determine video duration'))

      const data = options.cursorData
      const clicks = options.clickEvents || []

      // Normalize cursor coordinates to video dimensions
      let maxCX = 0, maxCY = 0
      for (const pt of data) { if (pt.x > maxCX) maxCX = pt.x; if (pt.y > maxCY) maxCY = pt.y }
      const scX = maxCX > 0 && Math.abs(maxCX - vw) > vw * 0.1 ? vw / maxCX : 1
      const scY = maxCY > 0 && Math.abs(maxCY - vh) > vh * 0.1 ? vh / maxCY : 1

      // Normalize click coordinates too
      const normalizedClicks = clicks.map((c) => ({ ...c, x: c.x * scX, y: c.y * scY }))

      const zoomSegments = detectClickZoomSegments(normalizedClicks, data)

      if (data.length < 2 && zoomSegments.length === 0) {
        // No tracking data — plain transcode
        const cmd = ffmpeg(options.inputPath).output(options.outputPath)
          .videoFilter('scale=1920:1080')
          .videoCodec('libx264').audioCodec('aac')
          .outputOptions(['-preset', 'fast', '-crf', '23'])
        if (onProgress) cmd.on('progress', (p) => onProgress(p.percent ?? 0))
        cmd.on('end', () => resolve(options.outputPath)).on('error', (e) => reject(e)).run()
        return
      }

      // Generate a crop keypoints file: each line is "time cropX cropY cropW cropH"
      // Then build an FFmpeg expression using piecewise t-based interpolation
      const fps = 30
      const totalFrames = Math.ceil(durationSec * fps)
      const durationMs = durationSec * 1000
      const defaultZoom = options.zoomFactor || 1.0
      const smoothing = options.smoothing || 0.08

      const cropW = Math.round(vw / DEFAULT_ZOOM_FACTOR)
      const cropH = Math.round(vh / DEFAULT_ZOOM_FACTOR)

      // Pre-compute smoothed crop positions for every frame
      const cropXs: number[] = []
      const cropYs: number[] = []
      let smX = -1, smY = -1

      for (let f = 0; f <= totalFrames; f++) {
        const tMs = (f / fps) * 1000

        // Determine zoom level at this moment from segments
        let zoomProgress = 0
        for (const seg of zoomSegments) {
          const fullStart = seg.startMs - seg.transitionInMs
          const fullEnd = seg.endMs + seg.transitionOutMs

          if (tMs >= fullStart && tMs <= fullEnd) {
            const elapsed = tMs - fullStart
            const tIn = seg.transitionInMs
            const tOut = seg.transitionOutMs
            const holdEnd = (seg.endMs - seg.startMs) + tIn

            if (elapsed < tIn) {
              zoomProgress = easeInOutCubic(elapsed / tIn)
            } else if (elapsed < holdEnd) {
              zoomProgress = 1
            } else {
              zoomProgress = 1 - easeInOutCubic((elapsed - holdEnd) / tOut)
            }
            break
          }
        }

        if (zoomProgress <= 0.001) {
          // No zoom — keep at 1:1 (full frame)
          cropXs.push(0)
          cropYs.push(0)
          smX = -1
          smY = -1
          continue
        }

        // Active zoom — find which segment we're in for the center
        let segCenter = { x: vw / 2, y: vh / 2 }
        for (const seg of zoomSegments) {
          if (tMs >= seg.startMs - seg.transitionInMs && tMs <= seg.endMs + seg.transitionOutMs) {
            // Use cursor position during the segment for dynamic tracking
            const cursor = interpolateCursor(data, tMs)
            segCenter = { x: cursor.x * scX, y: cursor.y * scY }
            break
          }
        }

        const curZoom = 1 + (DEFAULT_ZOOM_FACTOR - 1) * zoomProgress
        const cw = Math.round(vw / curZoom)
        const ch = Math.round(vh / curZoom)

        let targetX = segCenter.x - cw / 2
        let targetY = segCenter.y - ch / 2
        targetX = Math.max(0, Math.min(targetX, vw - cw))
        targetY = Math.max(0, Math.min(targetY, vh - ch))

        // Exponential smoothing for panning
        if (smX < 0) { smX = targetX; smY = targetY }
        else {
          const decay = 1 - Math.exp(-smoothing * 1)
          smX += (targetX - smX) * decay
          smY += (targetY - smY) * decay
        }
        cropXs.push(Math.round(smX))
        cropYs.push(Math.round(smY))
      }

      // Write crop data as an FFmpeg-readable text file for the sendcmd filter
      // Alternative: use a concat of segments with zoompan, but that's complex.
      // Best approach for reliability: write a simple crop script and use `-filter_script`
      // But fluent-ffmpeg doesn't support filter_script well.
      // Instead: build a piecewise `if(between(t,...),...)` expression, chunked by segment.

      const cropExprParts: string[] = []
      const sizeExprPartsW: string[] = []
      const sizeExprPartsH: string[] = []

      if (zoomSegments.length > 0) {
        for (const seg of zoomSegments) {
          const tStart = (seg.startMs - seg.transitionInMs) / 1000
          const tEnd = (seg.endMs + seg.transitionOutMs) / 1000
          const tInEnd = seg.startMs / 1000
          const tHoldEnd = seg.endMs / 1000

          // During transition in: lerp from 0,0,vw,vh to cropX,cropY,cropW,cropH
          // We use t-based easing approximated as linear for FFmpeg
          // Zoom in phase
          const inDur = seg.transitionInMs / 1000
          const holdDur = (seg.endMs - seg.startMs) / 1000
          const outDur = seg.transitionOutMs / 1000

          // Find the avg center for this segment from cursor data
          const midMs = (seg.startMs + seg.endMs) / 2
          const center = interpolateCursor(data, midMs)
          const cx = Math.round(center.x * scX)
          const cy = Math.round(center.y * scY)
          const clamped_cx = Math.max(cropW / 2, Math.min(cx, vw - cropW / 2))
          const clamped_cy = Math.max(cropH / 2, Math.min(cy, vh - cropH / 2))
          const targetCropX = Math.round(clamped_cx - cropW / 2)
          const targetCropY = Math.round(clamped_cy - cropH / 2)

          // Transition in: t in [tStart, tInEnd]
          if (inDur > 0) {
            const prog = `(t-${tStart.toFixed(3)})/${inDur.toFixed(3)}`
            cropExprParts.push(`if(between(t\\,${tStart.toFixed(3)}\\,${tInEnd.toFixed(3)})\\,${targetCropX}*${prog}\\,0)`)
            cropExprParts.push(`+0`) // placeholder for Y handled separately
            sizeExprPartsW.push(`if(between(t\\,${tStart.toFixed(3)}\\,${tInEnd.toFixed(3)})\\,${vw}-(${vw}-${cropW})*${prog}\\,0)`)
            sizeExprPartsH.push(`if(between(t\\,${tStart.toFixed(3)}\\,${tInEnd.toFixed(3)})\\,${vh}-(${vh}-${cropH})*${prog}\\,0)`)
          }

          // Hold: t in [tInEnd, tHoldEnd]
          cropExprParts.push(`if(between(t\\,${tInEnd.toFixed(3)}\\,${tHoldEnd.toFixed(3)})\\,${targetCropX}\\,0)`)
          sizeExprPartsW.push(`if(between(t\\,${tInEnd.toFixed(3)}\\,${tHoldEnd.toFixed(3)})\\,${cropW}\\,0)`)
          sizeExprPartsH.push(`if(between(t\\,${tInEnd.toFixed(3)}\\,${tHoldEnd.toFixed(3)})\\,${cropH}\\,0)`)

          // Transition out: t in [tHoldEnd, tEnd]
          if (outDur > 0) {
            const prog = `(t-${tHoldEnd.toFixed(3)})/${outDur.toFixed(3)}`
            cropExprParts.push(`if(between(t\\,${tHoldEnd.toFixed(3)}\\,${tEnd.toFixed(3)})\\,${targetCropX}*(1-${prog})\\,0)`)
            sizeExprPartsW.push(`if(between(t\\,${tHoldEnd.toFixed(3)}\\,${tEnd.toFixed(3)})\\,${cropW}+(${vw}-${cropW})*${prog}\\,0)`)
            sizeExprPartsH.push(`if(between(t\\,${tHoldEnd.toFixed(3)}\\,${tEnd.toFixed(3)})\\,${cropH}+(${vh}-${cropH})*${prog}\\,0)`)
          }
        }
      }

      let filterStr: string

      if (zoomSegments.length === 0) {
        // No click-triggered zoom, just pass through at 1080p
        filterStr = 'scale=1920:1080'
      } else {
        // Build composite expression: sum of all segment contributions (only one active at a time)
        const xExpr = cropExprParts.filter((p) => !p.startsWith('+0')).join('+') || '0'
        const wExpr = sizeExprPartsW.join('+') || String(vw)
        const hExpr = sizeExprPartsH.join('+') || String(vh)

        // For Y, mirror the X logic with targetCropY
        // Rebuild Y expressions
        const yParts: string[] = []
        for (const seg of zoomSegments) {
          const tStart = (seg.startMs - seg.transitionInMs) / 1000
          const tInEnd = seg.startMs / 1000
          const tHoldEnd = seg.endMs / 1000
          const tEnd = (seg.endMs + seg.transitionOutMs) / 1000
          const inDur = seg.transitionInMs / 1000
          const outDur = seg.transitionOutMs / 1000

          const midMs = (seg.startMs + seg.endMs) / 2
          const center = interpolateCursor(data, midMs)
          const cy = Math.round(center.y * scY)
          const clamped_cy = Math.max(cropH / 2, Math.min(cy, vh - cropH / 2))
          const targetCropY = Math.round(clamped_cy - cropH / 2)

          if (inDur > 0) {
            const prog = `(t-${tStart.toFixed(3)})/${inDur.toFixed(3)}`
            yParts.push(`if(between(t\\,${tStart.toFixed(3)}\\,${tInEnd.toFixed(3)})\\,${targetCropY}*${prog}\\,0)`)
          }
          yParts.push(`if(between(t\\,${tInEnd.toFixed(3)}\\,${tHoldEnd.toFixed(3)})\\,${targetCropY}\\,0)`)
          if (outDur > 0) {
            const prog = `(t-${tHoldEnd.toFixed(3)})/${outDur.toFixed(3)}`
            yParts.push(`if(between(t\\,${tHoldEnd.toFixed(3)}\\,${tEnd.toFixed(3)})\\,${targetCropY}*(1-${prog})\\,0)`)
          }
        }
        const yExpr = yParts.join('+') || '0'

        // Default when no segment is active: full frame
        const defaultW = `if(eq(${wExpr}\\,0)\\,${vw}\\,${wExpr})`
        const defaultH = `if(eq(${hExpr}\\,0)\\,${vh}\\,${hExpr})`

        filterStr = `crop=w='${defaultW}':h='${defaultH}':x='${xExpr}':y='${yExpr}',scale=1920:1080`
      }

      try {
        const cmd = ffmpeg(options.inputPath)
          .output(options.outputPath)
          .videoFilter(filterStr)
          .videoCodec('libx264')
          .audioCodec('aac')
          .outputOptions(['-preset', 'fast', '-crf', '23'])

        if (onProgress) cmd.on('progress', (p) => onProgress(p.percent ?? 0))
        cmd.on('end', () => resolve(options.outputPath)).on('error', (e) => reject(e)).run()
      } catch (e) {
        reject(e)
      }
    })
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
