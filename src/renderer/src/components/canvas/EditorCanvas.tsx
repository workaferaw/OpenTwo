/**
 * Editor preview canvas.
 * Renders video with zoom transformations and blur effects.
 * Will be implemented in Phase 3-5.
 */

function EditorCanvas(): JSX.Element {
  return (
    <div className="relative w-full h-full bg-black rounded-lg overflow-hidden">
      <canvas className="w-full h-full" />
    </div>
  )
}

export default EditorCanvas
