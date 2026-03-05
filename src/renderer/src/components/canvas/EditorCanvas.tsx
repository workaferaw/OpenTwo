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
    case 'ease-in':
      return easeIn
    case 'ease-out':
      return easeOut
    case 'ease-in-out':
      return easeInOut
    case 'spring':
      return spring
    case 'linear':
    default:
      return (t) => t
  }
}

interface ActiveZoom {
  keyframe: ZoomKeyframe
  progress: number
}

function getActiveZoom(currentTime: number, keyframes: ZoomKeyframe[]): ActiveZoom | null {
  for (const kf of keyframes) {
    const start = kf.timestamp
    const end = kf.timestamp + kf.duration
    if (currentTime >= start && currentTime <= end) {
      const raw = (currentTime - start) / kf.duration
      const easeFn = getEasing(kf.easing)
      return { keyframe: kf, progress: easeFn(Math.min(raw, 1)) }
    }
  }
  return null
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}

interface EditorCanvasProps {
  videoElement: HTMLVideoElement | null
  width: number
  height: number
}

function EditorCanvas({ videoElement, width, height }: EditorCanvasProps): JSX.Element {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animFrameRef = useRef<number>(0)
  const { currentTime, zoomKeyframes, blurRegions } = useEditorStore()

  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx || !videoElement) return

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    const vw = videoElement.videoWidth || width
    const vh = videoElement.videoHeight || height

    let sx = 0,
      sy = 0,
      sw = vw,
      sh = vh

    const activeZoom = getActiveZoom(currentTime, zoomKeyframes)
    if (activeZoom) {
      const { keyframe, progress } = activeZoom
      const r = keyframe.region
      sx = lerp(0, r.x, progress)
      sy = lerp(0, r.y, progress)
      sw = lerp(vw, r.width, progress)
      sh = lerp(vh, r.height, progress)
    }

    ctx.drawImage(videoElement, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)

    for (const blur of blurRegions) {
      if (currentTime >= blur.startTime && currentTime <= blur.endTime) {
        const scaleX = canvas.width / vw
        const scaleY = canvas.height / vh
        const bx = blur.region.x * scaleX
        const by = blur.region.y * scaleY
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
  }, [videoElement, width, height, currentTime, zoomKeyframes, blurRegions])

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
      <canvas ref={canvasRef} width={width} height={height} className="w-full h-full" />
    </div>
  )
}

export default EditorCanvas
