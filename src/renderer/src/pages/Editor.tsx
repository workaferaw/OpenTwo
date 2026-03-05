import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore } from '../stores/editor'
import EditorCanvas from '../components/canvas/EditorCanvas'
import CursorOverlay from '../components/canvas/CursorOverlay'
import BlurRegionTool from '../components/blur/BlurRegionTool'
import Timeline from '../components/timeline/Timeline'
import { CursorPoint } from '../stores/recording'

type EditorTool = 'select' | 'zoom' | 'blur'

function Editor(): JSX.Element {
  const {
    videoSrc,
    setVideoSrc,
    currentTime,
    setCurrentTime,
    duration,
    setDuration,
    isPlaying,
    setIsPlaying,
    addZoomKeyframe
  } = useEditorStore()

  const [activeTool, setActiveTool] = useState<EditorTool>('select')
  const [cursorData, setCursorData] = useState<CursorPoint[]>([])
  const [videoSize, setVideoSize] = useState({ width: 1920, height: 1080 })
  const videoRef = useRef<HTMLVideoElement>(null)
  const playbackRef = useRef<number>(0)

  const handleLoadProject = useCallback(async () => {
    const filePath = await window.api.showSaveDialog({ defaultName: '' })
    if (!filePath) return

    const videoUrl = `file://${filePath}`
    setVideoSrc(videoUrl)

    const cursorPath = filePath.replace('.webm', '.cursor.json')
    try {
      const response = await fetch(`file://${cursorPath}`)
      const data = await response.json()
      setCursorData(data)
    } catch {
      setCursorData([])
    }
  }, [setVideoSrc])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc) return

    video.src = videoSrc
    video.onloadedmetadata = () => {
      setDuration(video.duration)
      setVideoSize({ width: video.videoWidth, height: video.videoHeight })
    }
  }, [videoSrc, setDuration])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.play()
      const tick = () => {
        setCurrentTime(video.currentTime)
        if (!video.paused) {
          playbackRef.current = requestAnimationFrame(tick)
        }
      }
      playbackRef.current = requestAnimationFrame(tick)
    } else {
      video.pause()
      cancelAnimationFrame(playbackRef.current)
    }

    return () => cancelAnimationFrame(playbackRef.current)
  }, [isPlaying, setCurrentTime])

  useEffect(() => {
    const video = videoRef.current
    if (!video || isPlaying) return
    video.currentTime = currentTime
  }, [currentTime, isPlaying])

  const handleAddZoom = useCallback(() => {
    addZoomKeyframe({
      id: `zoom-${Date.now()}`,
      timestamp: currentTime * 1000,
      region: {
        x: videoSize.width * 0.25,
        y: videoSize.height * 0.25,
        width: videoSize.width * 0.5,
        height: videoSize.height * 0.5
      },
      duration: 2000,
      easing: 'ease-in-out'
    })
  }, [currentTime, videoSize, addZoomKeyframe])

  if (!videoSrc) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-xl bg-surface-200 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-white/30">
                <rect x="2" y="2" width="20" height="20" rx="2" />
                <line x1="2" y1="16" x2="22" y2="16" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white/80 mb-2">Editor</h2>
            <p className="text-sm text-white/40 mb-6">
              Open a recording to start editing with zoom animations and blur regions.
            </p>
            <button
              onClick={handleLoadProject}
              className="px-5 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium transition-colors"
            >
              Open Recording
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-2 border-b border-white/5 bg-surface-50">
        <ToolButton
          active={activeTool === 'select'}
          onClick={() => setActiveTool('select')}
          label="Select"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
            </svg>
          }
        />
        <ToolButton
          active={activeTool === 'zoom'}
          onClick={() => { setActiveTool('zoom'); handleAddZoom() }}
          label="Add Zoom"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
              <line x1="11" y1="8" x2="11" y2="14" />
              <line x1="8" y1="11" x2="14" y2="11" />
            </svg>
          }
        />
        <ToolButton
          active={activeTool === 'blur'}
          onClick={() => setActiveTool('blur')}
          label="Blur"
          icon={
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
              <rect x="7" y="7" width="10" height="10" rx="1" strokeDasharray="2 2" />
            </svg>
          }
        />
      </div>

      <div className="flex-1 relative flex items-center justify-center p-4 bg-surface">
        <video ref={videoRef} className="hidden" />
        <div className="relative max-w-full max-h-full" style={{ aspectRatio: `${videoSize.width}/${videoSize.height}` }}>
          <EditorCanvas
            videoElement={videoRef.current}
            width={videoSize.width}
            height={videoSize.height}
          />
          <CursorOverlay
            cursorData={cursorData}
            currentTime={currentTime}
            canvasWidth={videoSize.width}
            canvasHeight={videoSize.height}
            videoWidth={videoSize.width}
            videoHeight={videoSize.height}
            style="highlight"
            visible={cursorData.length > 0}
          />
          <BlurRegionTool
            active={activeTool === 'blur'}
            canvasWidth={videoSize.width}
            canvasHeight={videoSize.height}
          />
        </div>
      </div>

      <Timeline />
    </div>
  )
}

interface ToolButtonProps {
  active: boolean
  onClick: () => void
  label: string
  icon: JSX.Element
}

function ToolButton({ active, onClick, label, icon }: ToolButtonProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
        active
          ? 'bg-accent-600 text-white'
          : 'bg-surface-200 text-white/50 hover:text-white/70 hover:bg-surface-300'
      }`}
    >
      {icon}
      {label}
    </button>
  )
}

export default Editor
