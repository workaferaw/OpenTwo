import { useRef, useEffect } from 'react'
import { useEditorStore, ZoomKeyframe } from '../../stores/editor'
import { CursorPoint } from '../../stores/recording'

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
  const c4 = (2 * Math.PI) / 3
  return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1
}

function getEasing(type: ZoomKeyframe['easing']): (t: number) => number {
  switch (type) {
    case 'ease-in': return easeIn
    case 'ease-out': return easeOut
    case 'ease-in-out': return easeInOut
    case 'spring': return spring
    case 'linear':
    default: return (t) => t
  }
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

function interpolateCursor(
  cursorData: CursorPoint[],
  timeMs: number
): { x: number; y: number } | null {
  if (cursorData.length === 0) return null
  if (timeMs <= cursorData[0].t) return { x: cursorData[0].x, y: cursorData[0].y }
  const last = cursorData[cursorData.length - 1]
  if (timeMs >= last.t) return { x: last.x, y: last.y }

  let lo = 0,
    hi = cursorData.length - 1
  while (lo < hi - 1) {
    const mid = (lo + hi) >> 1
    if (cursorData[mid].t <= timeMs) lo = mid
    else hi = mid
  }

  const a = cursorData[lo],
    b = cursorData[hi]
  const t = (timeMs - a.t) / (b.t - a.t || 1)
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) }
}

const ASPECT_RATIOS: Record<string, number> = {
  '16:9': 16 / 9,
  '9:16': 9 / 16,
  '4:3': 4 / 3,
  '1:1': 1
}

interface EditorCanvasProps {
  videoElement: HTMLVideoElement | null
  width: number
  height: number
  cursorData: CursorPoint[]
  displayInfo: { scaleFactor: number; width: number; height: number } | null
}

function EditorCanvas({
  videoElement,
  width,
  height,
  cursorData,
  displayInfo
}: EditorCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)

  const videoRef = useRef(videoElement)
  const widthRef = useRef(width)
  const heightRef = useRef(height)
  const cursorDataRef = useRef(cursorData)
  const lastFrameTimeRef = useRef(0)

  const smoothXRef = useRef<number | null>(null)
  const smoothYRef = useRef<number | null>(null)

  videoRef.current = videoElement
  widthRef.current = width
  heightRef.current = height
  cursorDataRef.current = cursorData

  const storeRef = useRef(useEditorStore.getState())
  useEffect(() => {
    return useEditorStore.subscribe((state) => {
      storeRef.current = state
    })
  }, [])

  const aspectRatio = useEditorStore((s) => s.aspectRatio)
  const cursorFollowEnabled = useEditorStore((s) => s.cursorFollow.enabled)
  const cursorFollowZoom = useEditorStore((s) => s.cursorFollow.zoomFactor)

  const targetRatioForSize = aspectRatio === 'original' ? null : ASPECT_RATIOS[aspectRatio]
  const canvasWidth = targetRatioForSize
    ? (targetRatioForSize >= 1 ? width : Math.round(height * targetRatioForSize))
    : width
  const canvasHeight = targetRatioForSize
    ? (targetRatioForSize >= 1 ? Math.round(width / targetRatioForSize) : height)
    : height

  useEffect(() => {
    smoothXRef.current = null
    smoothYRef.current = null
  }, [cursorFollowEnabled, cursorFollowZoom])

  useEffect(() => {
    const renderFrame = (now: number): void => {
      const deltaMs = lastFrameTimeRef.current ? now - lastFrameTimeRef.current : 16
      lastFrameTimeRef.current = now

      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      const video = videoRef.current
      if (!canvas || !ctx || !video) {
        animFrameRef.current = requestAnimationFrame(renderFrame)
        return
      }

      const state = storeRef.current
      const vw = video.videoWidth || widthRef.current
      const vh = video.videoHeight || heightRef.current
      const currentTimeSec = state.currentTime

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      const targetRatio =
        state.aspectRatio === 'original' ? null : ASPECT_RATIOS[state.aspectRatio]

      if (targetRatio) {
        if (state.background.type === 'gradient') {
          const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
          grad.addColorStop(0, state.background.gradientFrom)
          grad.addColorStop(1, state.background.gradientTo)
          ctx.fillStyle = grad
        } else {
          ctx.fillStyle = state.background.color
        }
        ctx.fillRect(0, 0, canvas.width, canvas.height)
      }

      let drawW = canvas.width,
        drawH = canvas.height,
        drawX = 0,
        drawY = 0
      if (targetRatio) {
        const videoRatio = vw / vh
        if (videoRatio > canvas.width / canvas.height) {
          drawW = canvas.width
          drawH = canvas.width / videoRatio
        } else {
          drawH = canvas.height
          drawW = canvas.height * videoRatio
        }
        drawX = (canvas.width - drawW) / 2
        drawY = (canvas.height - drawH) / 2
      }

      let sx = 0,
        sy = 0,
        sw = vw,
        sh = vh

      // 1) Check manual zoom keyframes first (with transition in/hold/out phases)
      const currentTimeMs = currentTimeSec * 1000
      let hasManualZoom = false
      for (const kf of state.zoomKeyframes) {
        const start = kf.timestamp
        const end = kf.timestamp + kf.duration
        if (currentTimeMs >= start && currentTimeMs <= end) {
          const elapsed = currentTimeMs - start
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

      // 2) Cursor follow zoom (when no manual keyframe is active)
      if (
        !hasManualZoom &&
        state.cursorFollow.enabled &&
        cursorDataRef.current.length > 0
      ) {
        const rawCursor = interpolateCursor(cursorDataRef.current, currentTimeMs)
        if (rawCursor) {
          // Normalize cursor coordinates to video dimensions
          // Use displayInfo if available; fall back to heuristic
          let scX = 1, scY = 1
          if (displayInfo) {
            scX = vw / displayInfo.width
            scY = vh / displayInfo.height
          } else {
            const data = cursorDataRef.current
            let maxX = 0, maxY = 0
            for (let i = 0; i < data.length; i += Math.max(1, (data.length >> 6))) {
              if (data[i].x > maxX) maxX = data[i].x
              if (data[i].y > maxY) maxY = data[i].y
            }
            scX = maxX > 0 && Math.abs(maxX - vw) > vw * 0.1 ? vw / maxX : 1
            scY = maxY > 0 && Math.abs(maxY - vh) > vh * 0.1 ? vh / maxY : 1
          }
          const cursor = { x: rawCursor.x * scX, y: rawCursor.y * scY }

          const zoom = state.cursorFollow.zoomFactor
          const regionW = vw / zoom
          const regionH = vh / zoom

          let targetX = cursor.x - regionW / 2
          let targetY = cursor.y - regionH / 2
          targetX = Math.max(0, Math.min(targetX, vw - regionW))
          targetY = Math.max(0, Math.min(targetY, vh - regionH))

          // Frame-rate-independent exponential smoothing
          // Higher smoothing value = faster response
          const speed = state.cursorFollow.smoothing
          const decay = 1 - Math.exp(-speed * (deltaMs / 16.67))

          if (smoothXRef.current === null || smoothYRef.current === null) {
            smoothXRef.current = targetX
            smoothYRef.current = targetY
          } else {
            smoothXRef.current += (targetX - smoothXRef.current) * decay
            smoothYRef.current += (targetY - smoothYRef.current) * decay

            // Dead zone: snap if very close to target to avoid infinite drift
            if (Math.abs(smoothXRef.current - targetX) < 0.5)
              smoothXRef.current = targetX
            if (Math.abs(smoothYRef.current - targetY) < 0.5)
              smoothYRef.current = targetY
          }

          sx = smoothXRef.current
          sy = smoothYRef.current
          sw = regionW
          sh = regionH
        }
      }

      // Browser frame
      if (state.showBrowserFrame) {
        const frameHeight = 32
        const radius = 8
        ctx.fillStyle = '#2d2d2d'
        ctx.beginPath()
        ctx.roundRect(drawX, drawY, drawW, frameHeight, [radius, radius, 0, 0])
        ctx.fill()

        const dotY = drawY + frameHeight / 2
          ;['#ff5f57', '#febc2e', '#28c840'].forEach((c, i) => {
            ctx.fillStyle = c
            ctx.beginPath()
            ctx.arc(drawX + 16 + i * 20, dotY, 5, 0, Math.PI * 2)
            ctx.fill()
          })

        ctx.fillStyle = '#1a1a1a'
        ctx.beginPath()
        ctx.roundRect(drawX + 80, drawY + 6, drawW - 100, 20, 4)
        ctx.fill()

        drawY += frameHeight
        drawH -= frameHeight
      }

      // Draw video frame
      try {
        if (video.readyState >= 2) {
          ctx.drawImage(video, sx, sy, sw, sh, drawX, drawY, drawW, drawH)
        }
      } catch {
        // video not ready yet
      }

      // Blur regions
      for (const blur of state.blurRegions) {
        if (
          currentTimeSec >= blur.startTime &&
          currentTimeSec <= blur.endTime
        ) {
          const scaleX = drawW / sw
          const scaleY = drawH / sh
          const bx = drawX + (blur.region.x - sx) * scaleX
          const by = drawY + (blur.region.y - sy) * scaleY
          const bw = blur.region.width * scaleX
          const bh = blur.region.height * scaleY

          if (
            bx + bw < drawX ||
            bx > drawX + drawW ||
            by + bh < drawY ||
            by > drawY + drawH
          )
            continue

          const tempCanvas = document.createElement('canvas')
          tempCanvas.width = Math.max(1, Math.round(bw))
          tempCanvas.height = Math.max(1, Math.round(bh))
          const tempCtx = tempCanvas.getContext('2d')
          if (tempCtx) {
            tempCtx.filter = 'blur(12px)'
            tempCtx.drawImage(
              canvas,
              bx,
              by,
              bw,
              bh,
              0,
              0,
              tempCanvas.width,
              tempCanvas.height
            )
            ctx.drawImage(tempCanvas, bx, by, bw, bh)
          }
        }
      }

      animFrameRef.current = requestAnimationFrame(renderFrame)
    }

    animFrameRef.current = requestAnimationFrame(renderFrame)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [])

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      <canvas
        ref={canvasRef}
        width={canvasWidth}
        height={canvasHeight}
        className="w-full h-full object-contain"
      />
    </div>
  )
}

export default EditorCanvas
