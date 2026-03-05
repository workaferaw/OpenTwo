import { useRef, useCallback, useState } from 'react'
import { useEditorStore } from '../../stores/editor'
import ZoomKeyframe from './ZoomKeyframe'
import BlurKeyframe from './BlurKeyframe'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function Timeline(): JSX.Element {
  const {
    currentTime,
    duration,
    isPlaying,
    zoomKeyframes,
    blurRegions,
    setCurrentTime,
    setIsPlaying,
    removeZoomKeyframe,
    removeBlurRegion
  } = useEditorStore()

  const trackRef = useRef<HTMLDivElement>(null)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [trackWidth, setTrackWidth] = useState(800)

  const handleTrackClick = useCallback(
    (e: React.MouseEvent) => {
      const rect = trackRef.current?.getBoundingClientRect()
      if (!rect || duration === 0) return
      const x = e.clientX - rect.left
      const time = (x / rect.width) * duration
      setCurrentTime(Math.max(0, Math.min(time, duration)))
    },
    [duration, setCurrentTime]
  )

  const handleTrackResize = useCallback(() => {
    if (trackRef.current) {
      setTrackWidth(trackRef.current.clientWidth)
    }
  }, [])

  const playheadLeft = duration > 0 ? (currentTime / duration) * 100 : 0

  const handleDelete = useCallback(() => {
    if (!selectedItem) return
    if (selectedItem.startsWith('zoom-')) {
      removeZoomKeyframe(selectedItem)
    } else if (selectedItem.startsWith('blur-')) {
      removeBlurRegion(selectedItem)
    }
    setSelectedItem(null)
  }, [selectedItem, removeZoomKeyframe, removeBlurRegion])

  return (
    <div className="h-40 bg-surface-100 border-t border-white/5 flex flex-col" ref={() => handleTrackResize()}>
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-lg bg-surface-200 hover:bg-surface-300 flex items-center justify-center transition-colors"
          >
            {isPlaying ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-white/70">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-white/70">
                <polygon points="5,3 19,12 5,21" />
              </svg>
            )}
          </button>

          <span className="text-xs text-white/50 font-mono tabular-nums">
            {formatTime(currentTime)} / {formatTime(duration)}
          </span>
        </div>

        <div className="flex items-center gap-2">
          {selectedItem && (
            <button
              onClick={handleDelete}
              className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] transition-colors"
            >
              Delete
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 relative px-4 py-2">
        <div className="text-[9px] text-white/20 mb-1 uppercase tracking-wider">Zoom</div>
        <div
          ref={trackRef}
          className="relative h-6 bg-surface-200 rounded cursor-pointer mb-1"
          onClick={handleTrackClick}
        >
          {zoomKeyframes.map((kf) => (
            <div key={kf.id} onClick={(e) => { e.stopPropagation(); setSelectedItem(kf.id) }}>
              <ZoomKeyframe
                id={kf.id}
                timestamp={kf.timestamp / 1000}
                duration={kf.duration / 1000}
                timelineWidth={trackWidth}
                totalDuration={duration}
              />
            </div>
          ))}

          <div
            className="absolute top-0 w-0.5 h-full bg-white/80 z-10 pointer-events-none"
            style={{ left: `${playheadLeft}%` }}
          >
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
          </div>
        </div>

        <div className="text-[9px] text-white/20 mb-1 uppercase tracking-wider">Blur</div>
        <div
          className="relative h-6 bg-surface-200 rounded cursor-pointer"
          onClick={handleTrackClick}
        >
          {blurRegions.map((br) => (
            <div key={br.id} onClick={(e) => { e.stopPropagation(); setSelectedItem(br.id) }}>
              <BlurKeyframe
                id={br.id}
                startTime={br.startTime}
                endTime={br.endTime}
                timelineWidth={trackWidth}
                totalDuration={duration}
              />
            </div>
          ))}

          <div
            className="absolute top-0 w-0.5 h-full bg-white/80 z-10 pointer-events-none"
            style={{ left: `${playheadLeft}%` }}
          />
        </div>
      </div>
    </div>
  )
}

export default Timeline
