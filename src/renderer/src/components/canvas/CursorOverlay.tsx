/**
 * Custom cursor overlay for the canvas.
 * Renders a smooth, customizable cursor on top of the recording/editor canvas.
 * Will be implemented in Phase 3.
 */

interface CursorOverlayProps {
  x: number
  y: number
  style: 'default' | 'highlight' | 'enlarged'
  visible: boolean
}

function CursorOverlay({ x, y, style, visible }: CursorOverlayProps): JSX.Element {
  if (!visible) return <></>

  const sizes = {
    default: 'w-4 h-4',
    highlight: 'w-8 h-8',
    enlarged: 'w-6 h-6'
  }

  return (
    <div
      className="absolute pointer-events-none transition-all duration-75"
      style={{ left: x, top: y, transform: 'translate(-50%, -50%)' }}
    >
      {style === 'highlight' && (
        <div className={`${sizes[style]} rounded-full bg-accent-500/30 border-2 border-accent-500`} />
      )}
      {style !== 'highlight' && (
        <div className={`${sizes[style]} rounded-full bg-white shadow-lg`} />
      )}
    </div>
  )
}

export default CursorOverlay
