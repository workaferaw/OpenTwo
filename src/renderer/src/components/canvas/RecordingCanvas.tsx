/**
 * Live recording preview canvas.
 * Shows the screen capture with cursor overlay during recording.
 * Will be expanded in Phase 2-3.
 */

function RecordingCanvas(): JSX.Element {
  return (
    <div className="relative w-full h-full">
      <canvas className="w-full h-full" />
    </div>
  )
}

export default RecordingCanvas
