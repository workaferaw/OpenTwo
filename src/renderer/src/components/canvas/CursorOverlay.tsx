import { useEffect, useRef } from 'react'
import { CursorPoint } from '../../stores/recording'

interface CursorOverlayProps {
  cursorData: CursorPoint[]
  currentTime: number
  canvasWidth: number
  canvasHeight: number
  videoWidth: number
  videoHeight: number
  style: 'default' | 'highlight' | 'enlarged'
  visible: boolean
}

function interpolateCursor(
  data: CursorPoint[],
  timeMs: number
): { x: number; y: number } | null {
  if (data.length === 0) return null

  let low = 0
  let high = data.length - 1
  while (low < high) {
    const mid = (low + high) >> 1
    if (data[mid].t < timeMs) low = mid + 1
    else high = mid
  }

  if (low === 0) return { x: data[0].x, y: data[0].y }
  if (low >= data.length) return { x: data[data.length - 1].x, y: data[data.length - 1].y }

  const a = data[low - 1]
  const b = data[low]
  const t = (timeMs - a.t) / (b.t - a.t)
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  }
}

function CursorOverlay({
  cursorData,
  currentTime,
  canvasWidth,
  canvasHeight,
  videoWidth,
  videoHeight,
  style,
  visible
}: CursorOverlayProps): JSX.Element {
  const dotRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!visible || !dotRef.current) return

    const timeMs = currentTime * 1000
    const pos = interpolateCursor(cursorData, timeMs)
    if (!pos) return

    const scaleX = canvasWidth / videoWidth
    const scaleY = canvasHeight / videoHeight
    const cx = pos.x * scaleX
    const cy = pos.y * scaleY

    dotRef.current.style.transform = `translate(${cx}px, ${cy}px) translate(-50%, -50%)`
  }, [cursorData, currentTime, canvasWidth, canvasHeight, videoWidth, videoHeight, visible])

  if (!visible) return <></>

  const sizeClasses = {
    default: 'w-4 h-4',
    highlight: 'w-8 h-8',
    enlarged: 'w-6 h-6'
  }

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div ref={dotRef} className="absolute top-0 left-0 transition-transform duration-[33ms] ease-linear">
        {style === 'highlight' ? (
          <div className={`${sizeClasses[style]} rounded-full bg-accent-500/30 border-2 border-accent-500 shadow-lg shadow-accent-500/20`} />
        ) : (
          <div className={`${sizeClasses[style]} rounded-full bg-white shadow-lg`} />
        )}
      </div>
    </div>
  )
}

export default CursorOverlay
export { interpolateCursor }
