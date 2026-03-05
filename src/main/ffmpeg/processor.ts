import ffmpeg from 'fluent-ffmpeg'
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg'
import { path as ffprobePath } from '@ffprobe-installer/ffprobe'
import { execFile } from 'child_process'

ffmpeg.setFfmpegPath(ffmpegPath)
ffmpeg.setFfprobePath(ffprobePath)

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
const ZOOM_HOLD_AFTER_LAST_CLICK_MS = 2000
const DEFAULT_ZOOM_FACTOR = 1.4
const TRANSITION_IN_MS = 600
const TRANSITION_OUT_MS = 700
const MIN_GAP_BETWEEN_SEGMENTS_MS = 300
const ANTICIPATION_MS = 500 // Start zoom 0.5s BEFORE the first click (Cursorful-style)

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

        // Start zoom BEFORE the first click (anticipation) so it feels predictive
        const startMs = Math.max(0, burstClicks[0].t - ANTICIPATION_MS)
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
  displayInfo?: { scaleFactor: number; width: number; height: number }
}

/**
 * Compute cursor-to-video coordinate scale factors.
 * If displayInfo is provided, uses it directly. Otherwise falls back
 * to the heuristic max-value comparison.
 */
function computeCursorScale(
  cursorData: CursorPt[],
  vw: number,
  vh: number,
  displayInfo?: { scaleFactor: number; width: number; height: number }
): { scX: number; scY: number } {
  if (displayInfo) {
    // Cursor data is in logical pixels; video is in physical pixels.
    // Scale = (videoWidth / displayLogicalWidth)
    // For single-monitor: this equals scaleFactor when video == physical display.
    return {
      scX: vw / displayInfo.width,
      scY: vh / displayInfo.height
    }
  }
  // Heuristic fallback for old recordings without displayInfo
  let maxCX = 0, maxCY = 0
  for (const pt of cursorData) {
    if (pt.x > maxCX) maxCX = pt.x
    if (pt.y > maxCY) maxCY = pt.y
  }
  return {
    scX: maxCX > 0 && Math.abs(maxCX - vw) > vw * 0.1 ? vw / maxCX : 1,
    scY: maxCY > 0 && Math.abs(maxCY - vh) > vh * 0.1 ? vh / maxCY : 1
  }
}

/**
 * Build a per-segment FFmpeg crop+scale filter expression.
 * Uses if(between(t,...)) to select crop window per zoom segment,
 * with linear interpolation during transitions.
 */
function buildZoomFilterExpr(
  vw: number,
  vh: number,
  zoomSegments: ZoomSegment[],
  cursorData: CursorPt[],
  scX: number,
  scY: number,
  durationSec: number
): string {
  if (zoomSegments.length === 0) return `scale=1920:1080`

  const cropW = Math.round(vw / DEFAULT_ZOOM_FACTOR)
  const cropH = Math.round(vh / DEFAULT_ZOOM_FACTOR)

  // Build X, Y, W, H expressions
  const xParts: string[] = []
  const yParts: string[] = []
  const wParts: string[] = []
  const hParts: string[] = []

  for (const seg of zoomSegments) {
    const tStart = Math.max(0, (seg.startMs - seg.transitionInMs) / 1000)
    const tInEnd = seg.startMs / 1000
    // Clamp end times to video duration so crop expression doesn't extend past the video
    const tHoldEnd = Math.min(seg.endMs / 1000, durationSec)
    const tEnd = Math.min((seg.endMs + seg.transitionOutMs) / 1000, durationSec)
    const inDur = seg.transitionInMs / 1000
    const outDur = Math.max(0.001, tEnd - tHoldEnd)

    // Find cursor center for this segment
    const midMs = (seg.startMs + seg.endMs) / 2
    const center = interpolateCursor(cursorData, midMs)
    const cx = Math.round(center.x * scX)
    const cy = Math.round(center.y * scY)
    const clampedCx = Math.max(cropW / 2, Math.min(cx, vw - cropW / 2))
    const clampedCy = Math.max(cropH / 2, Math.min(cy, vh - cropH / 2))
    const targetX = Math.round(clampedCx - cropW / 2)
    const targetY = Math.round(clampedCy - cropH / 2)

    // Transition in
    if (inDur > 0.001) {
      const p = `(t-${tStart.toFixed(3)})/${inDur.toFixed(3)}`
      xParts.push(`if(between(t,${tStart.toFixed(3)},${tInEnd.toFixed(3)}),${targetX}*${p},0)`)
      yParts.push(`if(between(t,${tStart.toFixed(3)},${tInEnd.toFixed(3)}),${targetY}*${p},0)`)
      wParts.push(`if(between(t,${tStart.toFixed(3)},${tInEnd.toFixed(3)}),${vw}-(${vw}-${cropW})*${p},0)`)
      hParts.push(`if(between(t,${tStart.toFixed(3)},${tInEnd.toFixed(3)}),${vh}-(${vh}-${cropH})*${p},0)`)
    }

    // Hold
    xParts.push(`if(between(t,${tInEnd.toFixed(3)},${tHoldEnd.toFixed(3)}),${targetX},0)`)
    yParts.push(`if(between(t,${tInEnd.toFixed(3)},${tHoldEnd.toFixed(3)}),${targetY},0)`)
    wParts.push(`if(between(t,${tInEnd.toFixed(3)},${tHoldEnd.toFixed(3)}),${cropW},0)`)
    hParts.push(`if(between(t,${tInEnd.toFixed(3)},${tHoldEnd.toFixed(3)}),${cropH},0)`)

    // Transition out
    if (outDur > 0.001) {
      const p = `(t-${tHoldEnd.toFixed(3)})/${outDur.toFixed(3)}`
      xParts.push(`if(between(t,${tHoldEnd.toFixed(3)},${tEnd.toFixed(3)}),${targetX}*(1-${p}),0)`)
      yParts.push(`if(between(t,${tHoldEnd.toFixed(3)},${tEnd.toFixed(3)}),${targetY}*(1-${p}),0)`)
      wParts.push(`if(between(t,${tHoldEnd.toFixed(3)},${tEnd.toFixed(3)}),${cropW}+(${vw}-${cropW})*${p},0)`)
      hParts.push(`if(between(t,${tHoldEnd.toFixed(3)},${tEnd.toFixed(3)}),${cropH}+(${vh}-${cropH})*${p},0)`)
    }
  }

  const xExpr = xParts.join('+') || '0'
  const yExpr = yParts.join('+') || '0'
  const wSum = wParts.join('+') || String(vw)
  const hSum = hParts.join('+') || String(vh)

  // When no segment is active, sums are 0 → use full frame
  const wExpr = `if(eq(${wSum},0),${vw},${wSum})`
  const hExpr = `if(eq(${hSum},0),${vh},${hSum})`

  return `crop=w='${wExpr}':h='${hExpr}':x='${xExpr}':y='${yExpr}',scale=1920:1080`
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
      let durationSec = parseFloat(String(probe.format.duration || 0))

      // WebM from MediaRecorder often has duration=N/A in ffprobe
      // Fall back to cursor/click data to estimate duration
      if (!durationSec || isNaN(durationSec) || durationSec <= 0) {
        const data = options.cursorData
        const clicks = options.clickEvents || []
        const lastCursorT = data.length > 0 ? data[data.length - 1].t : 0
        const lastClickT = clicks.length > 0 ? clicks[clicks.length - 1].t : 0
        durationSec = Math.max(lastCursorT, lastClickT) / 1000
      }
      if (!durationSec || durationSec <= 0) return reject(new Error('Cannot determine video duration'))

      const data = options.cursorData
      const clicks = options.clickEvents || []

      const { scX, scY } = computeCursorScale(data, vw, vh, options.displayInfo)

      // Clicks from global-mouse are already in physical pixel space (scaled by scaleFactor)
      // matching the video dimensions — no additional normalization needed
      const zoomSegments = detectClickZoomSegments(clicks, data)

      console.log('[OpenTwo Export] Video:', vw, 'x', vh, '| Duration:', durationSec, 's')
      console.log('[OpenTwo Export] Clicks:', clicks.length, '| Scale:', scX.toFixed(3), scY.toFixed(3))
      console.log('[OpenTwo Export] Zoom segments:', zoomSegments.length, JSON.stringify(zoomSegments))

      // Build filter expression
      const filterExpr = buildZoomFilterExpr(vw, vh, zoomSegments, data, scX, scY, durationSec)
      console.log('[OpenTwo Export] Filter:', filterExpr.substring(0, 200), '...')

      // Use spawn for full control over arguments (no escaping issues)
      const args = [
        '-y',
        '-i', options.inputPath,
        '-vf', filterExpr,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'medium',
        '-crf', '18',
        '-c:a', 'aac',
        '-b:a', '192k',
        '-movflags', '+faststart',
        options.outputPath
      ]

      const proc = execFile(ffmpegPath, args, { maxBuffer: 1024 * 1024 * 10 }, (error) => {
        if (error) {
          reject(new Error(`FFmpeg failed: ${error.message}`))
        } else {
          resolve(options.outputPath)
        }
      })

      // Parse progress from stderr for onProgress callback
      if (onProgress && proc.stderr) {
        let lastPercent = 0
        proc.stderr.on('data', (chunk: Buffer) => {
          const line = chunk.toString()
          const timeMatch = line.match(/time=(\d+):(\d+):(\d+\.\d+)/)
          if (timeMatch) {
            const secs = parseInt(timeMatch[1]) * 3600 + parseInt(timeMatch[2]) * 60 + parseFloat(timeMatch[3])
            const pct = Math.min(100, Math.round((secs / durationSec) * 100))
            if (pct > lastPercent) {
              lastPercent = pct
              onProgress(pct)
            }
          }
        })
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
