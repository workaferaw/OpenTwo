/**
 * Picture-in-picture webcam overlay.
 * Shows the phone or local webcam feed as a draggable, resizable overlay.
 * Will be implemented in Phase 6.
 */

function WebcamOverlay(): JSX.Element {
  return (
    <div className="absolute bottom-4 right-4 w-48 h-36 rounded-xl overflow-hidden border-2 border-white/20 bg-surface-200 flex items-center justify-center">
      <p className="text-xs text-white/30">Webcam</p>
    </div>
  )
}

export default WebcamOverlay
