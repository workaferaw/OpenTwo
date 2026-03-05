import { useState, useRef, useCallback } from 'react'
import { useEditorStore } from '../../stores/editor'

interface BlurRegionToolProps {
  active: boolean
  canvasWidth: number
  canvasHeight: number
}

function BlurRegionTool({ active, canvasWidth, canvasHeight }: BlurRegionToolProps): JSX.Element {
  const { currentTime, duration, addBlurRegion, blurRegions } = useEditorStore()
  const [drawing, setDrawing] = useState(false)
  const [startPos, setStartPos] = useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = useState({ x: 0, y: 0 })
  const overlayRef = useRef<HTMLDivElement>(null)

  const getRelativePos = useCallback(
    (e: React.MouseEvent) => {
      const rect = overlayRef.current?.getBoundingClientRect()
      if (!rect) return { x: 0, y: 0 }
      return {
        x: (e.clientX - rect.left) / rect.width,
        y: (e.clientY - rect.top) / rect.height
      }
    },
    []
  )

  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      if (!active) return
      const pos = getRelativePos(e)
      setStartPos(pos)
      setCurrentPos(pos)
      setDrawing(true)
    },
    [active, getRelativePos]
  )

  const handleMouseMove = useCallback(
    (e: React.MouseEvent) => {
      if (!drawing) return
      setCurrentPos(getRelativePos(e))
    },
    [drawing, getRelativePos]
  )

  const handleMouseUp = useCallback(() => {
    if (!drawing) return
    setDrawing(false)

    const x = Math.min(startPos.x, currentPos.x) * canvasWidth
    const y = Math.min(startPos.y, currentPos.y) * canvasHeight
    const w = Math.abs(currentPos.x - startPos.x) * canvasWidth
    const h = Math.abs(currentPos.y - startPos.y) * canvasHeight

    if (w < 10 || h < 10) return

    addBlurRegion({
      id: `blur-${Date.now()}`,
      startTime: currentTime,
      endTime: Math.min(currentTime + 5, duration),
      region: { x, y, width: w, height: h }
    })
  }, [drawing, startPos, currentPos, currentTime, duration, addBlurRegion, canvasWidth, canvasHeight])

  return (
    <div
      ref={overlayRef}
      className={`absolute inset-0 ${active ? 'cursor-crosshair' : 'pointer-events-none'}`}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => setDrawing(false)}
    >
      {drawing && (
        <div
          className="absolute border-2 border-amber-400 bg-amber-400/10 rounded-lg"
          style={{
            left: `${Math.min(startPos.x, currentPos.x) * 100}%`,
            top: `${Math.min(startPos.y, currentPos.y) * 100}%`,
            width: `${Math.abs(currentPos.x - startPos.x) * 100}%`,
            height: `${Math.abs(currentPos.y - startPos.y) * 100}%`
          }}
        />
      )}

      {blurRegions
        .filter((r) => currentTime >= r.startTime && currentTime <= r.endTime)
        .map((r) => (
          <div
            key={r.id}
            className="absolute border border-amber-500/50 bg-amber-500/10 rounded-lg"
            style={{
              left: `${(r.region.x / canvasWidth) * 100}%`,
              top: `${(r.region.y / canvasHeight) * 100}%`,
              width: `${(r.region.width / canvasWidth) * 100}%`,
              height: `${(r.region.height / canvasHeight) * 100}%`
            }}
          >
            <span className="absolute -top-5 left-0 text-[10px] text-amber-400 bg-surface-100 px-1 rounded-lg">
              Blur
            </span>
          </div>
        ))}
    </div>
  )
}

export default BlurRegionTool
