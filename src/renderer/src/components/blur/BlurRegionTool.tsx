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
        x: ((e.clientX - rect.left) / rect.width) * canvasWidth,
        y: ((e.clientY - rect.top) / rect.height) * canvasHeight
      }
    },
    [canvasWidth, canvasHeight]
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

    const x = Math.min(startPos.x, currentPos.x)
    const y = Math.min(startPos.y, currentPos.y)
    const w = Math.abs(currentPos.x - startPos.x)
    const h = Math.abs(currentPos.y - startPos.y)

    if (w < 10 || h < 10) return

    addBlurRegion({
      id: `blur-${Date.now()}`,
      startTime: currentTime,
      endTime: Math.min(currentTime + 5, duration),
      region: { x, y, width: w, height: h }
    })
  }, [drawing, startPos, currentPos, currentTime, duration, addBlurRegion])

  const rect = overlayRef.current?.getBoundingClientRect()
  const scaleX = rect ? rect.width / canvasWidth : 1
  const scaleY = rect ? rect.height / canvasHeight : 1

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
          className="absolute border-2 border-yellow-400 bg-yellow-400/10 rounded"
          style={{
            left: Math.min(startPos.x, currentPos.x) * scaleX,
            top: Math.min(startPos.y, currentPos.y) * scaleY,
            width: Math.abs(currentPos.x - startPos.x) * scaleX,
            height: Math.abs(currentPos.y - startPos.y) * scaleY
          }}
        />
      )}

      {blurRegions
        .filter((r) => currentTime >= r.startTime && currentTime <= r.endTime)
        .map((r) => (
          <div
            key={r.id}
            className="absolute border border-yellow-500/50 bg-yellow-500/10 rounded"
            style={{
              left: r.region.x * scaleX,
              top: r.region.y * scaleY,
              width: r.region.width * scaleX,
              height: r.region.height * scaleY
            }}
          >
            <span className="absolute -top-5 left-0 text-[9px] text-yellow-400 bg-surface-100 px-1 rounded">
              Blur
            </span>
          </div>
        ))}
    </div>
  )
}

export default BlurRegionTool
