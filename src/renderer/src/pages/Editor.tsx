import { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore, AspectRatio } from '../stores/editor'
import EditorCanvas from '../components/canvas/EditorCanvas'
import CursorOverlay from '../components/canvas/CursorOverlay'
import BlurRegionTool from '../components/blur/BlurRegionTool'
import Timeline from '../components/timeline/Timeline'
import { useFFmpeg } from '../hooks/useFFmpeg'
import { useToastStore } from '../components/ui/Toast'
import { CursorPoint } from '../stores/recording'

type EditorTool = 'select' | 'zoom' | 'blur'

function Editor(): JSX.Element {
  const {
    videoSrc, setVideoSrc, currentTime, setCurrentTime,
    duration, setDuration, isPlaying, setIsPlaying,
    addZoomKeyframe, blurRegions, trimStart, trimEnd,
    aspectRatio, setAspectRatio, background, setBackground,
    showBrowserFrame, setShowBrowserFrame
  } = useEditorStore()

  const [activeTool, setActiveTool] = useState<EditorTool>('select')
  const [cursorData, setCursorData] = useState<CursorPoint[]>([])
  const [videoSize, setVideoSize] = useState({ width: 1920, height: 1080 })
  const [loadedFilePath, setLoadedFilePath] = useState<string | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playbackRef = useRef<number>(0)
  const { exportVideo, exporting, progress } = useFFmpeg()
  const { addToast } = useToastStore()

  const handleLoadProject = useCallback(async () => {
    const filePath = await window.api.openFileDialog()
    if (!filePath) return

    setLoadedFilePath(filePath)
    setVideoSrc(filePath)

    const cursorPath = filePath.replace('.webm', '.cursor.json')
    try {
      const response = await fetch(`file://${cursorPath}`)
      const data = await response.json()
      setCursorData(data)
      addToast('Loaded recording with cursor data', 'success')
    } catch {
      setCursorData([])
      addToast('Loaded recording (no cursor data found)', 'info')
    }
  }, [setVideoSrc, addToast])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !videoSrc) return
    video.src = videoSrc.startsWith('file://') ? videoSrc : `file://${videoSrc}`
    video.onloadedmetadata = () => {
      setDuration(video.duration)
      setVideoSize({ width: video.videoWidth, height: video.videoHeight })
    }
    video.onerror = () => addToast('Failed to load video file', 'error')
  }, [videoSrc, setDuration, addToast])

  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    if (isPlaying) {
      video.play()
      const tick = () => {
        const t = video.currentTime
        if (t >= trimEnd) {
          video.pause()
          setIsPlaying(false)
          setCurrentTime(trimEnd)
          return
        }
        setCurrentTime(t)
        if (!video.paused && !video.ended) playbackRef.current = requestAnimationFrame(tick)
        else setIsPlaying(false)
      }
      playbackRef.current = requestAnimationFrame(tick)
    } else {
      video.pause()
      cancelAnimationFrame(playbackRef.current)
    }
    return () => cancelAnimationFrame(playbackRef.current)
  }, [isPlaying, setCurrentTime, setIsPlaying, trimEnd])

  useEffect(() => {
    const video = videoRef.current
    if (!video || isPlaying) return
    video.currentTime = currentTime
  }, [currentTime, isPlaying])

  const handleAddZoom = useCallback(() => {
    addZoomKeyframe({
      id: `zoom-${Date.now()}`,
      timestamp: currentTime * 1000,
      region: { x: videoSize.width * 0.25, y: videoSize.height * 0.25, width: videoSize.width * 0.5, height: videoSize.height * 0.5 },
      duration: 2000,
      easing: 'ease-in-out'
    })
    addToast('Zoom keyframe added', 'success')
  }, [currentTime, videoSize, addZoomKeyframe, addToast])

  const handleAutoDetectZoom = useCallback(async () => {
    if (cursorData.length === 0) { addToast('No cursor data for auto-detection', 'error'); return }
    const candidates = await window.api.detectZoomCandidates(cursorData, videoSize.width, videoSize.height)
    for (const c of candidates) {
      addZoomKeyframe({
        id: `zoom-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: c.timestamp, region: c.region, duration: c.duration, easing: 'ease-in-out'
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
      x: r.region.x, y: r.region.y, width: r.region.width, height: r.region.height,
      startTime: r.startTime, endTime: r.endTime
    }))
    const result = await exportVideo({
      inputPath: loadedFilePath, outputPath, format: format as 'mp4' | 'webm',
      resolution: '1080p', fps: 30, blurRegions: blurExport
    })
    addToast(result.success ? 'Export complete!' : `Export failed: ${result.error}`, result.success ? 'success' : 'error')
  }, [loadedFilePath, blurRegions, exportVideo, addToast])

  if (!videoSrc) {
    return (
      <div className="flex flex-col h-full">
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center max-w-sm">
            <div className="w-16 h-16 rounded-xl bg-surface-200 flex items-center justify-center mx-auto mb-4">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30">
                <rect x="2" y="2" width="20" height="20" rx="2" /><line x1="2" y1="16" x2="22" y2="16" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white/80 mb-2">Editor</h2>
            <p className="text-sm text-white/40 mb-6">Open a recording to edit with zoom, blur, and more.</p>
            <button onClick={handleLoadProject} className="px-5 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-sm font-medium transition-colors">
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
      <div className="flex items-center justify-between px-4 py-2 border-b border-white/5 bg-surface-50">
        <div className="flex items-center gap-1.5">
          <ToolBtn active={activeTool === 'select'} onClick={() => setActiveTool('select')} label="Select"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" /></svg>} />
          <ToolBtn active={false} onClick={handleAddZoom} label="+ Zoom"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="11" y1="8" x2="11" y2="14" /><line x1="8" y1="11" x2="14" y2="11" /></svg>} />
          <ToolBtn active={false} onClick={handleAutoDetectZoom} label="Auto Zoom"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><path d="M12 6v6l4 2" /></svg>} />
          <ToolBtn active={activeTool === 'blur'} onClick={() => setActiveTool('blur')} label="Blur"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" /><rect x="7" y="7" width="10" height="10" rx="1" strokeDasharray="2 2" /></svg>} />

          <div className="w-px h-5 bg-white/10 mx-1" />

          {/* Aspect ratio */}
          <select value={aspectRatio} onChange={(e) => setAspectRatio(e.target.value as AspectRatio)}
            className="bg-surface-200 text-[10px] text-white/60 rounded px-2 py-1 border border-white/5 focus:outline-none">
            <option value="original">Original</option>
            <option value="16:9">16:9</option>
            <option value="9:16">9:16 (Mobile)</option>
            <option value="4:3">4:3</option>
            <option value="1:1">1:1 (Square)</option>
          </select>

          {/* Browser frame */}
          <button onClick={() => setShowBrowserFrame(!showBrowserFrame)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              showBrowserFrame ? 'bg-accent-600 text-white' : 'bg-surface-200 text-white/40 hover:text-white/60'}`}>
            Frame
          </button>

          {/* Settings toggle */}
          <button onClick={() => setShowSettings(!showSettings)}
            className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              showSettings ? 'bg-accent-600 text-white' : 'bg-surface-200 text-white/40 hover:text-white/60'}`}>
            BG
          </button>
        </div>

        <div className="flex items-center gap-2">
          {exporting && (
            <div className="flex items-center gap-2 mr-2">
              <div className="w-24 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <div className="h-full bg-accent-500 rounded-full transition-all" style={{ width: `${progress}%` }} />
              </div>
              <span className="text-[10px] text-white/50 tabular-nums">{progress}%</span>
            </div>
          )}
          <ToolBtn active={false} onClick={handleLoadProject} label="Open"
            icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>} />
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-accent-600 hover:bg-accent-500 text-white text-xs font-medium transition-colors disabled:opacity-40">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            {exporting ? 'Exporting...' : 'Export'}
          </button>
        </div>
      </div>

      {/* Background settings panel */}
      {showSettings && (
        <div className="flex items-center gap-3 px-4 py-2 border-b border-white/5 bg-surface-50">
          <span className="text-[10px] text-white/40">Background:</span>
          <select value={background.type} onChange={(e) => setBackground({ type: e.target.value as 'solid' | 'gradient' })}
            className="bg-surface-200 text-[10px] text-white/60 rounded px-2 py-1 border border-white/5 focus:outline-none">
            <option value="solid">Solid</option>
            <option value="gradient">Gradient</option>
          </select>
          {background.type === 'solid' && (
            <input type="color" value={background.color} onChange={(e) => setBackground({ color: e.target.value })}
              className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
          )}
          {background.type === 'gradient' && (
            <>
              <input type="color" value={background.gradientFrom} onChange={(e) => setBackground({ gradientFrom: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
              <span className="text-[10px] text-white/30">to</span>
              <input type="color" value={background.gradientTo} onChange={(e) => setBackground({ gradientTo: e.target.value })}
                className="w-6 h-6 rounded cursor-pointer bg-transparent border-0" />
            </>
          )}
          {/* Quick presets */}
          {[
            { color: '#000000', label: 'Black' },
            { color: '#1a1a2e', label: 'Dark' },
            { color: '#0f3460', label: 'Navy' },
            { color: '#16213e', label: 'Slate' },
            { color: '#ffffff', label: 'White' }
          ].map((p) => (
            <button key={p.color} onClick={() => setBackground({ type: 'solid', color: p.color })}
              className="w-5 h-5 rounded-full border border-white/20 hover:scale-110 transition-transform"
              style={{ backgroundColor: p.color }} title={p.label} />
          ))}
        </div>
      )}

      {/* Canvas */}
      <div className="flex-1 relative flex items-center justify-center p-4 bg-surface">
        <video ref={videoRef} className="hidden" />
        <div className="relative max-w-full max-h-full" style={{ aspectRatio: `${videoSize.width}/${videoSize.height}` }}>
          <EditorCanvas videoElement={videoRef.current} width={videoSize.width} height={videoSize.height} />
          <CursorOverlay cursorData={cursorData} currentTime={currentTime}
            canvasWidth={videoSize.width} canvasHeight={videoSize.height}
            videoWidth={videoSize.width} videoHeight={videoSize.height}
            style="highlight" visible={cursorData.length > 0} />
          <BlurRegionTool active={activeTool === 'blur'} canvasWidth={videoSize.width} canvasHeight={videoSize.height} />
        </div>
      </div>

      <Timeline />
    </div>
  )
}

interface ToolBtnProps { active: boolean; onClick: () => void; label: string; icon: JSX.Element }
function ToolBtn({ active, onClick, label, icon }: ToolBtnProps): JSX.Element {
  return (
    <button onClick={onClick}
      className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-medium transition-colors ${
        active ? 'bg-accent-600 text-white' : 'bg-surface-200 text-white/50 hover:text-white/70 hover:bg-surface-300'
      }`}>
      {icon}{label}
    </button>
  )
}

export default Editor
