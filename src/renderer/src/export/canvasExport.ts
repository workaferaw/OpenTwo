/**
 * Canvas-based video export using MediaRecorder.
 *
 * Plays the video in a hidden canvas with the same zoom/follow logic
 * as the editor preview, then captures the canvas output using
 * MediaRecorder + captureStream(). This is fast, doesn't block the
 * UI, and produces results that exactly match the editor preview.
 */
import { CursorPoint } from '../stores/recording'
import { ZoomKeyframe } from '../stores/editor'

// --- Easing functions (same as EditorCanvas) ---
function easeInOut(t: number): number {
    return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t
}
function easeIn(t: number): number {
    return t * t
}
function easeOut(t: number): number {
    return t * (2 - t)
}
function spring(t: number): number {
    return 1 - Math.cos(t * Math.PI * 0.5) * Math.exp(-t * 3)
}
function getEasing(type: ZoomKeyframe['easing']): (t: number) => number {
    switch (type) {
        case 'ease-in':
            return easeIn
        case 'ease-out':
            return easeOut
        case 'spring':
            return spring
        case 'linear':
            return (t) => t
        default:
            return easeInOut
    }
}
function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t
}

function interpolateCursor(
    data: CursorPoint[],
    timeMs: number
): { x: number; y: number } | null {
    if (data.length === 0) return null
    let lo = 0,
        hi = data.length - 1
    while (lo < hi) {
        const mid = (lo + hi) >> 1
        if (data[mid].t < timeMs) lo = mid + 1
        else hi = mid
    }
    if (lo === 0) return { x: data[0].x, y: data[0].y }
    const prev = data[lo - 1],
        next = data[lo]
    if (next.t === prev.t) return { x: next.x, y: next.y }
    const frac = (timeMs - prev.t) / (next.t - prev.t)
    return {
        x: prev.x + (next.x - prev.x) * frac,
        y: prev.y + (next.y - prev.y) * frac
    }
}

export interface CanvasExportOptions {
    videoElement: HTMLVideoElement
    outputPath: string
    audioSourcePath: string
    cursorData: CursorPoint[]
    displayInfo: { scaleFactor: number; width: number; height: number } | null
    zoomKeyframes: ZoomKeyframe[]
    cursorFollow: { enabled: boolean; zoomFactor: number; smoothing: number }
    onProgress?: (percent: number) => void
}

export async function canvasExport(options: CanvasExportOptions): Promise<string> {
    const {
        videoElement,
        outputPath,
        audioSourcePath,
        cursorData,
        displayInfo,
        zoomKeyframes,
        cursorFollow,
        onProgress
    } = options

    const video = videoElement
    const vw = video.videoWidth || 1920
    const vh = video.videoHeight || 1080
    const duration = video.duration

    if (!duration || duration <= 0) throw new Error('Video has no duration')

    // Create offscreen canvas for rendering
    const canvas = document.createElement('canvas')
    canvas.width = vw
    canvas.height = vh
    const ctx = canvas.getContext('2d')!

    // Cursor scale factors
    let scX = 1, scY = 1
    if (displayInfo) {
        scX = vw / displayInfo.width
        scY = vh / displayInfo.height
    }

    // Smoothing state
    let smoothX: number | null = null
    let smoothY: number | null = null
    let lastRenderTime = 0

    function computeZoomRegion(timeMs: number, deltaMs: number) {
        let sx = 0, sy = 0, sw = vw, sh = vh

        // 1) Manual zoom keyframes
        let hasManualZoom = false
        for (const kf of zoomKeyframes) {
            const start = kf.timestamp
            const end = kf.timestamp + kf.duration
            if (timeMs >= start && timeMs <= end) {
                const elapsed = timeMs - start
                const tIn = kf.transitionIn || 300
                const tOut = kf.transitionOut || 300
                const holdEnd = Math.max(tIn, kf.duration - tOut)

                let progress: number
                if (elapsed < tIn) {
                    progress = getEasing(kf.easing)(elapsed / tIn)
                } else if (elapsed < holdEnd) {
                    progress = 1
                } else {
                    progress = 1 - getEasing(kf.easing)(Math.min((elapsed - holdEnd) / tOut, 1))
                }

                const r = kf.region
                sx = lerp(0, r.x, progress)
                sy = lerp(0, r.y, progress)
                sw = lerp(vw, r.width, progress)
                sh = lerp(vh, r.height, progress)
                hasManualZoom = true
                break
            }
        }

        // 2) Cursor follow
        if (!hasManualZoom && cursorFollow.enabled && cursorData.length > 0) {
            const rawCursor = interpolateCursor(cursorData, timeMs)
            if (rawCursor) {
                const cursor = { x: rawCursor.x * scX, y: rawCursor.y * scY }
                const zoom = cursorFollow.zoomFactor
                const regionW = vw / zoom
                const regionH = vh / zoom

                let targetX = cursor.x - regionW / 2
                let targetY = cursor.y - regionH / 2
                targetX = Math.max(0, Math.min(targetX, vw - regionW))
                targetY = Math.max(0, Math.min(targetY, vh - regionH))

                const speed = cursorFollow.smoothing
                const decay = 1 - Math.exp(-speed * (deltaMs / 16.67))

                if (smoothX === null || smoothY === null) {
                    smoothX = targetX
                    smoothY = targetY
                } else {
                    smoothX += (targetX - smoothX) * decay
                    smoothY += (targetY - smoothY) * decay
                    if (Math.abs(smoothX - targetX) < 0.5) smoothX = targetX
                    if (Math.abs(smoothY - targetY) < 0.5) smoothY = targetY
                }

                sx = smoothX
                sy = smoothY
                sw = regionW
                sh = regionH
            }
        }

        return { sx, sy, sw, sh }
    }

    return new Promise<string>((resolve, reject) => {
        // Set up MediaRecorder to capture canvas stream
        const stream = canvas.captureStream(30)
        const recorder = new MediaRecorder(stream, {
            mimeType: 'video/webm;codecs=vp9',
            videoBitsPerSecond: 8_000_000 // 8 Mbps - high quality
        })

        const chunks: Blob[] = []
        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunks.push(e.data)
        }

        recorder.onstop = async () => {
            console.log('[Canvas Export] Recording stopped, saving...')
            const blob = new Blob(chunks, { type: 'video/webm' })
            console.log(`[Canvas Export] WebM blob size: ${Math.round(blob.size / 1024)}KB`)
            const buffer = await blob.arrayBuffer()

            // Send the WebM blob to main process for remuxing to MP4
            try {
                const result = await window.api.canvasExportSaveBlob(buffer)
                if (result.success) {
                    if (onProgress) onProgress(100)
                    resolve(outputPath)
                } else {
                    reject(new Error(result.error || 'Export failed'))
                }
            } catch (err) {
                reject(err)
            }
        }

        recorder.onerror = (e) => {
            reject(new Error(`MediaRecorder error: ${e}`))
        }

        // Start the export pipeline
        // 1. Tell main process we're starting (it will prepare the output path)
        window.api.canvasExportStart({
            outputPath,
            audioSourcePath,
            width: vw,
            height: vh,
            fps: 30,
            totalFrames: Math.ceil(duration * 30)
        }).then(() => {
            // 2. Start recording
            recorder.start(100) // collect data every 100ms

            // 3. Seek video to start and play
            video.currentTime = 0
            video.play()

            // 4. Render loop — draw each frame with zoom
            let animId: number
            const renderLoop = (): void => {
                if (video.ended || video.paused) {
                    // Video finished — stop recording
                    recorder.stop()
                    cancelAnimationFrame(animId)
                    return
                }

                const now = performance.now()
                const deltaMs = lastRenderTime ? now - lastRenderTime : 16
                lastRenderTime = now

                const timeMs = video.currentTime * 1000
                const { sx, sy, sw, sh } = computeZoomRegion(timeMs, deltaMs)

                // Draw zoomed frame
                ctx.clearRect(0, 0, vw, vh)
                ctx.drawImage(video, sx, sy, sw, sh, 0, 0, vw, vh)

                // Progress
                if (onProgress) {
                    onProgress(Math.round((video.currentTime / duration) * 90))
                }

                animId = requestAnimationFrame(renderLoop)
            }

            video.onended = () => {
                console.log('[Canvas Export] Video playback ended')
                recorder.stop()
                cancelAnimationFrame(animId)
            }

            animId = requestAnimationFrame(renderLoop)
        }).catch(reject)
    })
}
