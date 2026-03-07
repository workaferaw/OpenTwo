import ffmpeg from 'fluent-ffmpeg'
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg'
import { path as ffprobePath } from '@ffprobe-installer/ffprobe'
import { execFile, execFileSync, spawn } from 'child_process'
import { join } from 'path'
import { tmpdir } from 'os'
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmdirSync } from 'fs'

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
 * Build zoom segments into a series of FFmpeg commands that:
 * 1. Split video at zoom boundaries
 * 2. Apply static crop to zoomed parts
 * 3. Concatenate all parts
 *
 * FFmpeg N-92722 (bundled version) doesn't support expression-based crop filters
 * with time variables reliably. This segment-based approach uses only hardcoded
 * crop values which are guaranteed to work.
 */
async function processZoomSegments(
  inputPath: string,
  outputPath: string,
  vw: number,
  vh: number,
  zoomSegments: ZoomSegment[],
  cursorData: CursorPt[],
  scX: number,
  scY: number,
  durationSec: number,
  onProgress?: (percent: number) => void
): Promise<void> {

  const cropW = Math.round(vw / DEFAULT_ZOOM_FACTOR)
  const cropH = Math.round(vh / DEFAULT_ZOOM_FACTOR)

  // Build timeline: alternating non-zoom and zoom segments
  interface Segment {
    start: number
    end: number
    isZoom: boolean
    cropX?: number
    cropY?: number
  }

  const timeline: Segment[] = []
  let cursor = 0

  for (const seg of zoomSegments) {
    const zoomStart = Math.max(0, seg.startMs / 1000)
    const zoomEnd = Math.min(seg.endMs / 1000, durationSec)

    // Compute crop position
    const midMs = (seg.startMs + seg.endMs) / 2
    const center = interpolateCursor(cursorData, midMs)
    const cx = Math.round(center.x * scX)
    const cy = Math.round(center.y * scY)
    const clampedCx = Math.max(cropW / 2, Math.min(cx, vw - cropW / 2))
    const clampedCy = Math.max(cropH / 2, Math.min(cy, vh - cropH / 2))
    const cropX = Math.round(clampedCx - cropW / 2)
    const cropY = Math.round(clampedCy - cropH / 2)

    // Non-zoom segment before this zoom
    if (cursor < zoomStart - 0.01) {
      timeline.push({ start: cursor, end: zoomStart, isZoom: false })
    }

    // Zoom segment
    timeline.push({ start: zoomStart, end: zoomEnd, isZoom: true, cropX, cropY })
    cursor = zoomEnd
  }

  // Non-zoom segment after last zoom
  if (cursor < durationSec - 0.01) {
    timeline.push({ start: cursor, end: durationSec, isZoom: false })
  }

  console.log('[OpenTwo Export] Timeline segments:', timeline.length)
  timeline.forEach((s, i) => {
    console.log(`  [${i}] ${s.isZoom ? 'ZOOM' : 'FULL'} ${s.start.toFixed(2)}s → ${s.end.toFixed(2)}s` +
      (s.isZoom ? ` crop=${cropW}:${cropH}:${s.cropX}:${s.cropY}` : ''))
  })

  // Create temp dir for segments
  const tmpDir = join(tmpdir(), `opentwo-zoom-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })

  const segmentFiles: string[] = []

  try {
    // Step 1: Encode each segment separately
    for (let i = 0; i < timeline.length; i++) {
      const seg = timeline[i]
      const segFile = join(tmpDir, `seg_${i}.mp4`)
      segmentFiles.push(segFile)

      const duration = seg.end - seg.start
      const vf = seg.isZoom
        ? `crop=${cropW}:${cropH}:${seg.cropX}:${seg.cropY},scale=${vw}:${vh}`
        : `scale=${vw}:${vh}`

      console.log(`[OpenTwo Export] Encoding segment ${i}: ${vf} (${duration.toFixed(2)}s)`)

      execFileSync(ffmpegPath, [
        '-y',
        '-ss', seg.start.toFixed(3),
        '-i', inputPath,
        '-t', duration.toFixed(3),
        '-vf', vf,
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-preset', 'fast',
        '-crf', '20',
        '-c:a', 'aac',
        '-b:a', '192k',
        segFile
      ], { timeout: 120000 })

      if (onProgress) {
        onProgress(Math.round(((i + 1) / timeline.length) * 80))
      }
    }

    // Step 2: Create concat list file
    const concatList = join(tmpDir, 'concat.txt')
    const concatContent = segmentFiles.map(f => `file '${f.replace(/\\/g, '/')}'`).join('\n')
    writeFileSync(concatList, concatContent)

    console.log('[OpenTwo Export] Concatenating', segmentFiles.length, 'segments...')

    // Step 3: Concatenate
    execFileSync(ffmpegPath, [
      '-y',
      '-f', 'concat',
      '-safe', '0',
      '-i', concatList,
      '-c', 'copy',
      '-movflags', '+faststart',
      outputPath
    ], { timeout: 120000 })

    if (onProgress) onProgress(100)
    console.log('[OpenTwo Export] Done! Output:', outputPath)

  } finally {
    // Cleanup temp files
    for (const f of segmentFiles) {
      if (existsSync(f)) try { unlinkSync(f) } catch (_e) { /* ignore */ }
    }
    try {
      const concatList = join(tmpDir, 'concat.txt')
      if (existsSync(concatList)) unlinkSync(concatList)
      require('fs').rmdirSync(tmpDir)
    } catch (_e) { /* ignore */ }
  }
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

      // Use segment-based approach (split + static crop + concat)
      // because FFmpeg N-92722 doesn't support expression-based crop filters
      if (zoomSegments.length > 0) {
        try {
          await processZoomSegments(
            options.inputPath, options.outputPath,
            vw, vh, zoomSegments, data, scX, scY, durationSec, onProgress
          )
          resolve(options.outputPath)
        } catch (err) {
          reject(err)
        }
      } else {
        // No zoom — simple scale-only encode
        console.log('[OpenTwo Export] No zoom segments, simple encode')
        const proc = spawn(ffmpegPath, [
          '-y', '-i', options.inputPath,
          '-vf', `scale=${vw}:${vh}`,
          '-c:v', 'libx264', '-pix_fmt', 'yuv420p',
          '-preset', 'medium', '-crf', '18',
          '-c:a', 'aac', '-b:a', '192k',
          '-movflags', '+faststart',
          options.outputPath
        ])

        proc.on('close', (code: number | null) => {
          if (code === 0) resolve(options.outputPath)
          else reject(new Error(`FFmpeg exited with code ${code}`))
        })
        proc.on('error', (err: Error) => reject(err))
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
