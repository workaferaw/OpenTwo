import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore, AspectRatio } from '../stores/editor'
import { LogoIcon } from '../components/ui/Logo'
import EditorCanvas from '../components/canvas/EditorCanvas'
import CursorOverlay from '../components/canvas/CursorOverlay'
import BlurRegionTool from '../components/blur/BlurRegionTool'
import Timeline from '../components/timeline/Timeline'
import { useFFmpeg } from '../hooks/useFFmpeg'
import { useToastStore } from '../components/ui/Toast'
import { CursorPoint } from '../stores/recording'

type EditorTool = 'select' | 'zoom' | 'blur'

function toMediaUrl(filePath: string): string {
  // Use file:// protocol — works with webSecurity: false in dev, and via IPC buffer in prod
  return 'file:///' + filePath.replace(/\\/g, '/')
}

interface EditorProps {
  onBack: () => void
}

function Editor({ onBack }: EditorProps): JSX.Element {
  const {
    videoSrc, setVideoSrc, currentTime, setCurrentTime,
    duration, setDuration, isPlaying, setIsPlaying,
    addZoomKeyframe, blurRegions, trimStart, trimEnd,
    aspectRatio, setAspectRatio, background, setBackground,
    showBrowserFrame, setShowBrowserFrame,
    cursorFollow, setCursorFollow
  } = useEditorStore()

  const [activeTool, setActiveTool] = useState<EditorTool>('select')
  const [cursorData, setCursorData] = useState<CursorPoint[]>([])
  const [videoSize, setVideoSize] = useState({ width: 1920, height: 1080 })
  const [loadedFilePath, setLoadedFilePath] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playbackRef = useRef<number>(0)
  const seekingRef = useRef(false)
  const { exportVideo, exporting, progress } = useFFmpeg()
  const { addToast } = useToastStore()

  const handleLoadProject = useCallback(async () => {
    const filePath = await window.api.openFileDialog()
    if (!filePath) return

    setLoadedFilePath(filePath)
    setVideoSrc(toMediaUrl(filePath))

    const cursorPath = filePath.replace(/\.(webm|mp4)$/, '.cursor.json')
    const cursorResult = await window.api.readJsonFile(cursorPath)
    if (cursorResult.success && Array.isArray(cursorResult.data)) {
      setCursorData(cursorResult.data)
      setCursorFollow({ enabled: true })
      addToast('Loaded with cursor follow enabled', 'success')
    } else {
      setCursorData([])
      setCursorFollow({ enabled: false })
      addToast('Loaded recording (no cursor data found)', 'info')
    }
  }, [setVideoSrc, setCursorFollow, addToast])

  // Set video source when videoSrc changes
  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc) return

    video.preload = 'auto'
    video.src = videoSrc

    const onMeta = (): void => {
      setDuration(video.duration)
      setVideoSize({ width: video.videoWidth, height: video.videoHeight })
    }
    const onError = (): void => {
      addToast('Failed to load video file', 'error')
    }

    video.addEventListener('loadedmetadata', onMeta)
    video.addEventListener('error', onError)
    return () => {
      video.removeEventListener('loadedmetadata', onMeta)
      video.removeEventListener('error', onError)
    }
  }, [videoSrc, setDuration, addToast])

  // Playback: drive currentTime from video element at 60fps
  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    if (isPlaying) {
      video.currentTime = currentTime
      video.play().catch(() => { })

      const tick = (): void => {
        if (video.paused || video.ended) {
          setIsPlaying(false)
          return
        }
        const t = video.currentTime
        if (t >= trimEnd) {
          video.pause()
          setIsPlaying(false)
          setCurrentTime(trimEnd)
          return
        }
        setCurrentTime(t)
        playbackRef.current = requestAnimationFrame(tick)
      }
      playbackRef.current = requestAnimationFrame(tick)
    } else {
      video.pause()
      cancelAnimationFrame(playbackRef.current)
    }
    return () => cancelAnimationFrame(playbackRef.current)
  }, [isPlaying, setCurrentTime, setIsPlaying, trimEnd])

  // Seek when scrubbing (not during playback)
  useEffect(() => {
    const video = videoRef.current
    if (!video || isPlaying || seekingRef.current) return
    if (Math.abs(video.currentTime - currentTime) > 0.05) {
      seekingRef.current = true
      video.currentTime = currentTime
      const onSeeked = (): void => {
        seekingRef.current = false
        video.removeEventListener('seeked', onSeeked)
      }
      video.addEventListener('seeked', onSeeked)
    }
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
      duration: 3000,
      transitionIn: 300,
      transitionOut: 300,
      easing: 'ease-in-out'
    })
    addToast('Zoom keyframe added', 'success')
  }, [currentTime, videoSize, addZoomKeyframe, addToast])

  const handleAutoDetectZoom = useCallback(async () => {
    if (cursorData.length === 0) {
      addToast('No cursor data for auto-detection', 'error')
      return
    }
    const candidates = await window.api.detectZoomCandidates(
      cursorData,
      videoSize.width,
      videoSize.height
    )
    for (const c of candidates) {
      addZoomKeyframe({
        id: `zoom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: c.timestamp,
        region: c.region,
        duration: c.duration,
        transitionIn: 300,
        transitionOut: 300,
        easing: 'ease-in-out'
      })
    }
    addToast(`Auto-detected ${candidates.length} zoom points`, 'success')
  }, [cursorData, videoSize, addZoomKeyframe, addToast])

  const handleExport = useCallback(async () => {
    if (!loadedFilePath) return
    const outputPath = await window.api.showExportDialog()
    if (!outputPath) return
    const format = outputPath.endsWith('.webm') ? 'webm' : 'mp4'
    const blurExport = blurRegions.map((r) => ({
      x: r.region.x,
      y: r.region.y,
      width: r.region.width,
      height: r.region.height,
      startTime: r.startTime,
      endTime: r.endTime
    }))
    const zoomExport = useEditorStore.getState().zoomKeyframes.map((kf) => ({
      timestamp: kf.timestamp,
      region: kf.region,
      duration: kf.duration,
      transitionIn: kf.transitionIn,
      transitionOut: kf.transitionOut,
      easing: kf.easing
    }))
    const result = await exportVideo({
      inputPath: loadedFilePath,
      outputPath,
      format: format as 'mp4' | 'webm',
      resolution: '1080p',
      fps: 30,
      blurRegions: blurExport,
      zoomKeyframes: zoomExport
    })
    addToast(
      result.success
        ? 'Export complete!'
        : `Export failed: ${result.error}`,
      result.success ? 'success' : 'error'
    )
  }, [loadedFilePath, blurRegions, exportVideo, addToast])

  if (!videoSrc) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex items-center gap-2 px-5 pt-4">
          <button onClick={onBack}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <LogoIcon size={16} className="text-accent-500" />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-xl bg-surface-200 flex items-center justify-center mx-auto mb-4">
              <LogoIcon size={28} className="text-white/25" />
            </div>
            <h2 className="text-lg font-semibold text-white/90 mb-2">Editor</h2>
            <p className="text-sm text-white/50 mb-6">
              Open a recording to edit with zoom, blur, and more.
            </p>
            <button
              onClick={handleLoadProject}
              className="px-5 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium transition-colors shadow-sm shadow-accent-600/20"
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
      {/* Toolbar */}
      <div className="flex items-center justify-between px-5 py-2 border-b border-white/[0.06] bg-surface-50">
        <div className="flex items-center gap-2">
          <button onClick={onBack}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <LogoIcon size={16} className="text-accent-500" />
          <ToolBtn
            active={activeTool === 'select'}
            onClick={() => setActiveTool('select')}
            label="Select"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
              </svg>
            }
          />
          <ToolBtn
            active={false}
            onClick={handleAddZoom}
            label="+ Zoom"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" />
                <line x1="11" y1="8" x2="11" y2="14" />
                <line x1="8" y1="11" x2="14" y2="11" />
              </svg>
            }
          />
          <ToolBtn
            active={false}
            onClick={handleAutoDetectZoom}
            label="Auto Zoom"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 6v6l4 2" />
              </svg>
            }
          />
          <ToolBtn
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

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Aspect ratio */}
          <select
            value={aspectRatio}
            onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
            className="bg-surface-200 text-[10px] text-white/50 rounded-lg px-2 py-1 border border-white/[0.06] focus:outline-none focus:border-accent-500/30"
          >
            <option value="original">Original</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16 (Mobile)</option>
            <option value="4:3">4:3</option>
            <option value="1:1">1:1 (Square)</option>
          </select>

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Cursor follow toggle */}
          <button
            onClick={() => setCursorFollow({ enabled: !cursorFollow.enabled })}
            disabled={cursorData.length === 0}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${cursorFollow.enabled
                ? 'bg-emerald-500 text-white'
                : 'bg-surface-200 text-white/50 hover:text-white/90'
              } disabled:opacity-30`}
          >
            {cursorFollow.enabled ? 'Follow: ON' : 'Follow'}
          </button>

          {cursorFollow.enabled && (
            <>
              <select
                value={cursorFollow.zoomFactor}
                onChange={(e) =>
                  setCursorFollow({ zoomFactor: parseFloat(e.target.value) })
                }
                className="bg-surface-200 text-[10px] text-white/50 rounded-lg px-2 py-1 border border-white/[0.06] focus:outline-none"
              >
                <option value="1.5">1.5x</option>
                <option value="2">2x</option>
                <option value="2.5">2.5x</option>
                <option value="3">3x</option>
                <option value="4">4x</option>
              </select>
              <select
                value={cursorFollow.smoothing}
                onChange={(e) =>
                  setCursorFollow({ smoothing: parseFloat(e.target.value) })
                }
                className="bg-surface-200 text-[10px] text-white/50 rounded-lg px-2 py-1 border border-white/[0.06] focus:outline-none"
                title="Pan smoothness"
              >
                <option value="0.03">Cinematic</option>
                <option value="0.08">Smooth</option>
                <option value="0.18">Responsive</option>
                <option value="0.4">Snappy</option>
              </select>
            </>
          )}

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Browser frame */}
          <button
            onClick={() => setShowBrowserFrame(!showBrowserFrame)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${showBrowserFrame
                ? 'bg-accent-600 text-white'
                : 'bg-surface-200 text-white/50 hover:text-white/90'
              }`}
          >
            Frame
          </button>

          {/* Settings toggle */}
          <button
            onClick={() => setShowSettings(!showSettings)}
            className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${showSettings
                ? 'bg-accent-600 text-white'
                : 'bg-surface-200 text-white/50 hover:text-white/90'
              }`}
          >
            BG
          </button>
        </div>

        <div className="flex items-center gap-2">
          {exporting && (
            <div className="flex items-center gap-2 mr-2">
              <div className="w-24 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
              <span className="text-[10px] text-white/50 tabular-nums">
                {progress}%
              </span>
            </div>
          )}
          <ToolBtn
            active={false}
            onClick={handleLoadProject}
            label="Open"
            icon={
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
              </svg>
            }
          />
          <button
            onClick={handleExport}
            disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium transition-colors disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* Background settings panel */}
      {showSettings && (
        <div className="flex items-center gap-3 px-5 py-2 border-b border-white/[0.06] bg-surface-50">
          <span className="text-[10px] text-white/50">Background:</span>
          <select
            value={background.type}
            onChange={(e) =>
              setBackground({ type: e.target.value as 'solid' | 'gradient' })
            }
            className="bg-surface-200 text-[10px] text-white/50 rounded-lg px-2 py-1 border border-white/[0.06] focus:outline-none"
          >
            <option value="solid">Solid</option>
            <option value="gradient">Gradient</option>
          </select>
          {background.type === 'solid' && (
            <input
              type="color"
              value={background.color}
              onChange={(e) => setBackground({ color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
            />
          )}
          {background.type === 'gradient' && (
            <>
              <input
                type="color"
                value={background.gradientFrom}
                onChange={(e) => setBackground({ gradientFrom: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
              />
              <span className="text-[10px] text-white/30">to</span>
              <input
                type="color"
                value={background.gradientTo}
                onChange={(e) => setBackground({ gradientTo: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0"
              />
            </>
          )}
          {[
            { color: '#000000', label: 'Black' },
            { color: '#1a1a2e', label: 'Dark' },
            { color: '#0f3460', label: 'Navy' },
            { color: '#16213e', label: 'Slate' },
            { color: '#ffffff', label: 'White' }
          ].map((p) => (
            <button
              key={p.color}
              onClick={() => setBackground({ type: 'solid', color: p.color })}
              className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform"
              style={{ backgroundColor: p.color }}
              title={p.label}
            />
          ))}
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative flex items-center justify-center p-5 bg-surface min-h-0">
        <video ref={videoRef} className="hidden" preload="auto" />
        <div
          className="relative w-full h-full flex items-center justify-center"
        >
          <EditorCanvas
            videoElement={videoRef.current}
            width={videoSize.width}
            height={videoSize.height}
            cursorData={cursorData}
          />
          {!cursorFollow.enabled && cursorData.length > 0 && (
            <CursorOverlay
              cursorData={cursorData}
              currentTime={currentTime}
              canvasWidth={videoSize.width}
              canvasHeight={videoSize.height}
              videoWidth={videoSize.width}
              videoHeight={videoSize.height}
              style="highlight"
              visible
            />
          )}
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

interface ToolBtnProps {
  active: boolean
  onClick: () => void
  label: string
  icon: JSX.Element
}
function ToolBtn({ active, onClick, label, icon }: ToolBtnProps): JSX.Element {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium transition-all duration-150 ${active
          ? 'bg-accent-500/15 text-accent-400'
          : 'bg-surface-200 text-white/50 hover:text-white/90 hover:bg-surface-300'
        }`}
    >
      {icon}
      {label}
    </button>
  )
}

export default Editor
