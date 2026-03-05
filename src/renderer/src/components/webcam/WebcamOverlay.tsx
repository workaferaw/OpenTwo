import { useState, useRef, useCallback, useEffect } from 'react'

interface WebcamOverlayProps {
  stream: MediaStream | null
  visible: boolean
}

function WebcamOverlay({ stream, visible }: WebcamOverlayProps): JSX.Element {
  const videoRef = useRef<HTMLVideoElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState({ x: 20, y: 20 })
  const [size, setSize] = useState({ width: 200, height: 150 })
  const [dragging, setDragging] = useState(false)
  const [resizing, setResizing] = useState(false)
  const dragOffset = useRef({ x: 0, y: 0 })

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream
      videoRef.current.play().catch(() => {})
    }
  }, [stream])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).dataset.resize) return
    setDragging(true)
    dragOffset.current = {
      x: e.clientX - position.x,
      y: e.clientY - position.y
    }
  }, [position])

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    setResizing(true)
    dragOffset.current = { x: e.clientX, y: e.clientY }
  }, [])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (dragging) {
        setPosition({
          x: e.clientX - dragOffset.current.x,
          y: e.clientY - dragOffset.current.y
        })
      } else if (resizing) {
        const dx = e.clientX - dragOffset.current.x
        const dy = e.clientY - dragOffset.current.y
        dragOffset.current = { x: e.clientX, y: e.clientY }
        setSize((prev) => ({
          width: Math.max(100, prev.width + dx),
          height: Math.max(75, prev.height + dy)
        }))
      }
    }

    const handleMouseUp = () => {
      setDragging(false)
      setResizing(false)
    }

    if (dragging || resizing) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [dragging, resizing])

  if (!visible) return <></>

  return (
    <div
      ref={containerRef}
      className="absolute z-20 rounded-xl overflow-hidden border-2 border-white/20 shadow-2xl cursor-move select-none"
      style={{
        right: position.x,
        bottom: position.y,
        width: size.width,
        height: size.height
      }}
      onMouseDown={handleMouseDown}
    >
      <video
        ref={videoRef}
        className="w-full h-full object-cover mirror"
        muted
        playsInline
        style={{ transform: 'scaleX(-1)' }}
      />

      {!stream && (
        <div className="absolute inset-0 bg-surface-200 flex items-center justify-center">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" className="text-white/20">
            <path d="M23 7l-7 5 7 5V7z" />
            <rect x="1" y="5" width="15" height="14" rx="2" />
          </svg>
        </div>
      )}

      <div
        data-resize="true"
        className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
        onMouseDown={handleResizeStart}
      >
        <svg width="10" height="10" viewBox="0 0 10 10" className="absolute bottom-1 right-1 text-white/40">
          <path d="M9 1L1 9M9 5L5 9M9 9L9 9" stroke="currentColor" strokeWidth="1" />
        </svg>
      </div>
    </div>
  )
}

export default WebcamOverlay
