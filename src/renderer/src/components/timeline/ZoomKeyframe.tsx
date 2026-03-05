/**
 * Zoom keyframe marker for the timeline.
 * Displays and allows editing of zoom regions at specific timestamps.
 * Will be implemented in Phase 3.
 */

interface ZoomKeyframeProps {
  id: string
  timestamp: number
  duration: number
  timelineWidth: number
  totalDuration: number
}

function ZoomKeyframe({ timestamp, duration, timelineWidth, totalDuration }: ZoomKeyframeProps): JSX.Element {
  const left = (timestamp / totalDuration) * timelineWidth
  const width = Math.max((duration / totalDuration) * timelineWidth, 4)

  return (
    <div
      className="absolute top-0 h-full bg-accent-500/30 border-l border-r border-accent-500/50 cursor-pointer hover:bg-accent-500/40"
      style={{ left: `${left}px`, width: `${width}px` }}
      title={`Zoom at ${timestamp.toFixed(1)}s`}
    />
  )
}

export default ZoomKeyframe
