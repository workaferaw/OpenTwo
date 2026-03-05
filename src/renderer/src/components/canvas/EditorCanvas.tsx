import { useRef, useEffect, useCallback } from 'react'
import { useEditorStore, ZoomKeyframe } from '../../stores/editor'

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

interface ActiveZoom {
  keyframe: ZoomKeyframe
  progress: number
}

function getActiveZoom(currentTimeSec: number, keyframes: ZoomKeyframe[]): ActiveZoom | null {
  const currentTimeMs = currentTimeSec * 1000
  for (const kf of keyframes) {
    const start = kf.timestamp
    const end = kf.timestamp + kf.duration
    if (currentTimeMs >= start && currentTimeMs <= end) {
      const raw = (currentTimeMs - start) / kf.duration
      const easeFn = getEasing(kf.easing)
      return { keyframe: kf, progress: easeFn(Math.min(raw, 1)) }
    }
  }
  return null
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
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
}

function EditorCanvas({ videoElement, width, height }: EditorCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const { currentTime, zoomKeyframes, blurRegions, aspectRatio, background, showBrowserFrame } = useEditorStore()

  const targetRatio = aspectRatio === 'original' ? null : ASPECT_RATIOS[aspectRatio]
  const canvasWidth = targetRatio ? (targetRatio >= 1 ? width : Math.round(height * targetRatio)) : width
  const canvasHeight = targetRatio ? (targetRatio >= 1 ? Math.round(width / targetRatio) : height) : height

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !videoElement) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    // Draw background
    if (targetRatio) {
      if (background.type === 'gradient') {
        const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
        grad.addColorStop(0, background.gradientFrom)
        grad.addColorStop(1, background.gradientTo)
        ctx.fillStyle = grad
      } else {
        ctx.fillStyle = background.color
      }
      ctx.fillRect(0, 0, canvas.width, canvas.height)
    }

    const vw = videoElement.videoWidth || width
    const vh = videoElement.videoHeight || height

    // Fit video within canvas respecting aspect ratio
    let drawW = canvas.width, drawH = canvas.height, drawX = 0, drawY = 0
    if (targetRatio) {
      const videoRatio = vw / vh
      if (videoRatio > (canvas.width / canvas.height)) {
        drawW = canvas.width
        drawH = canvas.width / videoRatio
      } else {
        drawH = canvas.height
        drawW = canvas.height * videoRatio
      }
      drawX = (canvas.width - drawW) / 2
      drawY = (canvas.height - drawH) / 2
    }

    // Source rect (for zoom)
    let sx = 0, sy = 0, sw = vw, sh = vh
    const activeZoom = getActiveZoom(currentTime, zoomKeyframes)
    if (activeZoom) {
      const { keyframe, progress } = activeZoom
      const r = keyframe.region
      sx = lerp(0, r.x, progress)
      sy = lerp(0, r.y, progress)
      sw = lerp(vw, r.width, progress)
      sh = lerp(vh, r.height, progress)
    }

    // Browser frame
    if (showBrowserFrame) {
      const frameHeight = 32
      const radius = 8
      ctx.fillStyle = '#2d2d2d'
      ctx.beginPath()
      ctx.roundRect(drawX, drawY, drawW, frameHeight, [radius, radius, 0, 0])
      ctx.fill()

      // Window dots
      const dotY = drawY + frameHeight / 2
      const colors = ['#ff5f57', '#febc2e', '#28c840']
      colors.forEach((c, i) => {
        ctx.fillStyle = c
        ctx.beginPath()
        ctx.arc(drawX + 16 + i * 20, dotY, 5, 0, Math.PI * 2)
        ctx.fill()
      })

      // URL bar
      ctx.fillStyle = '#1a1a1a'
      ctx.beginPath()
      ctx.roundRect(drawX + 80, drawY + 6, drawW - 100, 20, 4)
      ctx.fill()

      drawY += frameHeight
      drawH -= frameHeight
    }

    ctx.drawImage(videoElement, sx, sy, sw, sh, drawX, drawY, drawW, drawH)

    // Blur regions
    for (const blur of blurRegions) {
      if (currentTime >= blur.startTime && currentTime <= blur.endTime) {
        const scaleX = drawW / vw
        const scaleY = drawH / vh
        const bx = drawX + blur.region.x * scaleX
        const by = drawY + blur.region.y * scaleY
        const bw = blur.region.width * scaleX
        const bh = blur.region.height * scaleY

        const tempCanvas = document.createElement('canvas')
        tempCanvas.width = Math.max(1, Math.round(bw))
        tempCanvas.height = Math.max(1, Math.round(bh))
        const tempCtx = tempCanvas.getContext('2d')
        if (tempCtx) {
          tempCtx.filter = 'blur(12px)'
          tempCtx.drawImage(canvas, bx, by, bw, bh, 0, 0, tempCanvas.width, tempCanvas.height)
          ctx.drawImage(tempCanvas, bx, by, bw, bh)
        }
      }
    }
  }, [videoElement, width, height, currentTime, zoomKeyframes, blurRegions, targetRatio, background, showBrowserFrame])

  useEffect(() => {
    const loop = () => {
      renderFrame()
      animFrameRef.current = requestAnimationFrame(loop)
    }
    animFrameRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animFrameRef.current)
  }, [renderFrame])

  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      <canvas ref={canvasRef} width={canvasWidth} height={canvasHeight} className="w-full h-full object-contain" />
    </div>
  )
}

export default EditorCanvas
