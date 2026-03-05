import { useRef, useCallback, useState, useEffect } from 'react'
import { useEditorStore } from '../../stores/editor'

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m}:${s.toString().padStart(2, '0')}`
}

function Timeline(): JSX.Element {
  const {
    currentTime, duration, isPlaying, zoomKeyframes, blurRegions,
    trimStart, trimEnd, splitPoints,
    setCurrentTime, setIsPlaying, setTrimStart, setTrimEnd,
    addSplitPoint, removeSplitPoint,
    removeZoomKeyframe, removeBlurRegion, updateZoomKeyframe
  } = useEditorStore()

  const trackRef = useRef<HTMLDivElement>(null)
  const [selectedItem, setSelectedItem] = useState<string | null>(null)
  const [draggingTrim, setDraggingTrim] = useState<'start' | 'end' | null>(null)
  const [draggingKeyframe, setDraggingKeyframe] = useState<string | null>(null)

  const timeToPercent = useCallback((t: number) => {
    return duration > 0 ? (t / duration) * 100 : 0
  }, [duration])

  const percentToTime = useCallback((pct: number) => {
    return (pct / 100) * duration
  }, [duration])

  const getTimeFromMouseEvent = useCallback((e: MouseEvent | React.MouseEvent) => {
    const rect = trackRef.current?.getBoundingClientRect()
    if (!rect || duration === 0) return 0
    const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
    return (x / rect.width) * duration
  }, [duration])

  const handleTrackClick = useCallback((e: React.MouseEvent) => {
    if (draggingTrim || draggingKeyframe) return
    setCurrentTime(getTimeFromMouseEvent(e))
    setSelectedItem(null)
  }, [getTimeFromMouseEvent, setCurrentTime, draggingTrim, draggingKeyframe])

  const handleSplit = useCallback(() => {
    if (currentTime > trimStart && currentTime < trimEnd) {
      addSplitPoint(currentTime)
    }
  }, [currentTime, trimStart, trimEnd, addSplitPoint])

  const handleDelete = useCallback(() => {
    if (!selectedItem) return
    if (selectedItem.startsWith('zoom-')) removeZoomKeyframe(selectedItem)
    else if (selectedItem.startsWith('blur-')) removeBlurRegion(selectedItem)
    else if (selectedItem.startsWith('split-')) {
      const time = parseFloat(selectedItem.replace('split-', ''))
      removeSplitPoint(time)
    }
    setSelectedItem(null)
  }, [selectedItem, removeZoomKeyframe, removeBlurRegion, removeSplitPoint])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (draggingTrim === 'start') {
        const t = Math.max(0, Math.min(getTimeFromMouseEvent(e), trimEnd - 0.5))
        setTrimStart(t)
      } else if (draggingTrim === 'end') {
        const t = Math.min(duration, Math.max(getTimeFromMouseEvent(e), trimStart + 0.5))
        setTrimEnd(t)
      } else if (draggingKeyframe) {
        const t = getTimeFromMouseEvent(e)
        updateZoomKeyframe(draggingKeyframe, { timestamp: t * 1000 })
      }
    }
    const handleMouseUp = () => {
      setDraggingTrim(null)
      setDraggingKeyframe(null)
    }

    if (draggingTrim || draggingKeyframe) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [draggingTrim, draggingKeyframe, trimStart, trimEnd, duration, getTimeFromMouseEvent, setTrimStart, setTrimEnd, updateZoomKeyframe])

  const playheadPct = timeToPercent(currentTime)
  const trimStartPct = timeToPercent(trimStart)
  const trimEndPct = timeToPercent(trimEnd)

  return (
    <div className="h-44 bg-surface-100 border-t border-white/5 flex flex-col select-none">
      {/* Controls bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5">
        <div className="flex items-center gap-3">
          <button onClick={() => setIsPlaying(!isPlaying)}
            className="w-8 h-8 rounded-lg bg-surface-200 hover:bg-surface-300 flex items-center justify-center transition-colors">
            {isPlaying ? (
              <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" className="text-white/70">
                <rect x="6" y="4" width="4" height="16" rx="1" /><rect x="14" y="4" width="4" height="16" rx="1" />
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
          <button onClick={handleSplit}
            className="px-2 py-1 rounded bg-surface-200 hover:bg-surface-300 text-[10px] text-white/50 transition-colors"
            title="Split at playhead">
            Split
          </button>
          {selectedItem && (
            <button onClick={handleDelete}
              className="px-2 py-1 rounded bg-red-500/20 hover:bg-red-500/30 text-red-400 text-[10px] transition-colors">
              Delete
            </button>
          )}
          <span className="text-[10px] text-white/30 ml-2">
            Trim: {formatTime(trimStart)} - {formatTime(trimEnd)}
          </span>
        </div>
      </div>

      {/* Zoom track */}
      <div className="px-4 pt-2">
        <div className="text-[9px] text-white/20 mb-1 uppercase tracking-wider">Zoom</div>
        <div ref={trackRef} className="relative h-6 bg-surface-200 rounded cursor-pointer" onClick={handleTrackClick}>
          {/* Trim overlay */}
          <div className="absolute top-0 left-0 h-full bg-white/5 rounded-l pointer-events-none"
            style={{ width: `${trimStartPct}%` }} />
          <div className="absolute top-0 right-0 h-full bg-white/5 rounded-r pointer-events-none"
            style={{ width: `${100 - trimEndPct}%` }} />

          {/* Trim handles */}
          <div className="absolute top-0 h-full w-1.5 bg-accent-500 cursor-ew-resize z-20 rounded-l hover:bg-accent-400"
            style={{ left: `${trimStartPct}%` }}
            onMouseDown={(e) => { e.stopPropagation(); setDraggingTrim('start') }} />
          <div className="absolute top-0 h-full w-1.5 bg-accent-500 cursor-ew-resize z-20 rounded-r hover:bg-accent-400"
            style={{ left: `${trimEndPct}%`, transform: 'translateX(-100%)' }}
            onMouseDown={(e) => { e.stopPropagation(); setDraggingTrim('end') }} />

          {/* Zoom keyframes */}
          {zoomKeyframes.map((kf) => {
            const left = timeToPercent(kf.timestamp / 1000)
            const width = Math.max(timeToPercent(kf.duration / 1000), 0.5)
            const isSelected = selectedItem === kf.id
            return (
              <div key={kf.id}
                className={`absolute top-0 h-full cursor-grab active:cursor-grabbing z-10 rounded-sm ${
                  isSelected ? 'bg-accent-500/50 border border-accent-400' : 'bg-accent-500/30 hover:bg-accent-500/40'
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
                onClick={(e) => { e.stopPropagation(); setSelectedItem(kf.id) }}
                onMouseDown={(e) => { e.stopPropagation(); setDraggingKeyframe(kf.id) }}
                title={`Zoom at ${(kf.timestamp / 1000).toFixed(1)}s`} />
            )
          })}

          {/* Split points */}
          {splitPoints.map((t) => (
            <div key={`sp-${t}`}
              className={`absolute top-0 w-0.5 h-full z-15 cursor-pointer ${
                selectedItem === `split-${t}` ? 'bg-yellow-400' : 'bg-yellow-500/60 hover:bg-yellow-400'
              }`}
              style={{ left: `${timeToPercent(t)}%` }}
              onClick={(e) => { e.stopPropagation(); setSelectedItem(`split-${t}`) }} />
          ))}

          {/* Playhead */}
          <div className="absolute top-0 w-0.5 h-full bg-white/80 z-30 pointer-events-none"
            style={{ left: `${playheadPct}%` }}>
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-white rounded-full" />
          </div>
        </div>
      </div>

      {/* Blur track */}
      <div className="px-4 pt-2">
        <div className="text-[9px] text-white/20 mb-1 uppercase tracking-wider">Blur</div>
        <div className="relative h-6 bg-surface-200 rounded cursor-pointer" onClick={handleTrackClick}>
          {blurRegions.map((br) => {
            const left = timeToPercent(br.startTime)
            const width = Math.max(timeToPercent(br.endTime - br.startTime), 0.5)
            const isSelected = selectedItem === br.id
            return (
              <div key={br.id}
                className={`absolute top-0 h-full rounded-sm z-10 ${
                  isSelected ? 'bg-yellow-500/40 border border-yellow-400' : 'bg-yellow-500/20 hover:bg-yellow-500/30'
                }`}
                style={{ left: `${left}%`, width: `${width}%` }}
                onClick={(e) => { e.stopPropagation(); setSelectedItem(br.id) }} />
            )
          })}
          <div className="absolute top-0 w-0.5 h-full bg-white/80 z-30 pointer-events-none"
            style={{ left: `${playheadPct}%` }} />
        </div>
      </div>

      {/* Time ruler */}
      <div className="px-4 pt-1 flex justify-between">
        {Array.from({ length: 11 }, (_, i) => (
          <span key={i} className="text-[8px] text-white/15 font-mono">
            {formatTime((duration * i) / 10)}
          </span>
        ))}
      </div>
    </div>
  )
}

export default Timeline
