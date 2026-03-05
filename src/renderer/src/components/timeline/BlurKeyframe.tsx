/**
 * Blur region marker for the timeline.
 * Shows the time range where blur is applied.
 * Will be implemented in Phase 4.
 */

interface BlurKeyframeProps {
  id: string
  startTime: number
  endTime: number
  timelineWidth: number
  totalDuration: number
}

function BlurKeyframe({ startTime, endTime, timelineWidth, totalDuration }: BlurKeyframeProps): JSX.Element {
  const left = (startTime / totalDuration) * timelineWidth
  const width = Math.max(((endTime - startTime) / totalDuration) * timelineWidth, 4)

  return (
    <div
      className="absolute top-0 h-full bg-yellow-500/20 border-l border-r border-yellow-500/40 cursor-pointer hover:bg-yellow-500/30"
      style={{ left: `${left}px`, width: `${width}px` }}
      title={`Blur ${startTime.toFixed(1)}s - ${endTime.toFixed(1)}s`}
    />
  )
}

export default BlurKeyframe
