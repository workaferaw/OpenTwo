import { useState, useRef, useEffect, useCallback } from 'react'
import { LogoFull } from '../components/ui/Logo'
import WebcamOverlay from '../components/webcam/WebcamOverlay'
import { useRecordingStore, DesktopSource } from '../stores/recording'
import { useSettingsStore } from '../stores/settings'
import { useToastStore } from '../components/ui/Toast'

interface RecorderProps {
  onOpenEditor: () => void
  onOpenSettings: () => void
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const m = Math.floor(totalSec / 60)
  const s = totalSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

function Recorder({ onOpenEditor, onOpenSettings }: RecorderProps): JSX.Element {
  const {
    status, selectedSource, setSelectedSource, setStatus,
    setMediaRecorder, addChunk, addCursorPoint,
    setStartTime, reset
  } = useRecordingStore()
  const { selectedMicId } = useSettingsStore()
  const { addToast } = useToastStore()

  const [sources, setSources] = useState<DesktopSource[]>([])
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([])
  const [selectedMic, setSelectedMic] = useState(selectedMicId || '')
  const [selectedCamera, setSelectedCamera] = useState('')
  const [elapsed, setElapsed] = useState(0)
  const [saving, setSaving] = useState(false)

  const previewVideoRef = useRef<HTMLVideoElement>(null)
  const previewStreamRef = useRef<MediaStream | null>(null)
  const webcamStreamRef = useRef<MediaStream | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const cursorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const elapsedRef = useRef(0)
  const recordingStartRef = useRef(0)
  const stopResolveRef = useRef<(() => void) | null>(null)
  const displayInfoRef = useRef<{ scaleFactor: number; width: number; height: number } | null>(null)

  useEffect(() => {
    window.api.getDesktopSources().then(setSources)
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setMics(devices.filter((d) => d.kind === 'audioinput'))
      setCameras(devices.filter((d) => d.kind === 'videoinput'))
    })
  }, [])

  useEffect(() => {
    if (sources.length > 0 && !selectedSource) {
      const screen = sources.find((s) => s.name === 'Entire Screen' || s.name.includes('Screen'))
      setSelectedSource(screen || sources[0])
    }
  }, [sources, selectedSource, setSelectedSource])

  // Live HD preview
  useEffect(() => {
    if (!selectedSource) return
    let cancelled = false
      ; (async () => {
        previewStreamRef.current?.getTracks().forEach((t) => t.stop())
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              // @ts-expect-error Electron desktopCapturer mandatory constraints
              mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: selectedSource.id }
            }
          })
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
          previewStreamRef.current = stream
          if (previewVideoRef.current) previewVideoRef.current.srcObject = stream
        } catch { /* source unavailable */ }
      })()
    return () => {
      cancelled = true
      previewStreamRef.current?.getTracks().forEach((t) => t.stop())
      previewStreamRef.current = null
    }
  }, [selectedSource])

  // Webcam stream
  useEffect(() => {
    if (!selectedCamera) {
      webcamStreamRef.current?.getTracks().forEach((t) => t.stop())
      webcamStreamRef.current = null
      return
    }
    let cancelled = false
      ; (async () => {
        webcamStreamRef.current?.getTracks().forEach((t) => t.stop())
        try {
          const stream = await navigator.mediaDevices.getUserMedia({
            video: { deviceId: { exact: selectedCamera } }, audio: false
          })
          if (cancelled) { stream.getTracks().forEach((t) => t.stop()); return }
          webcamStreamRef.current = stream
        } catch { addToast('Could not access camera', 'error') }
      })()
    return () => {
      cancelled = true
      webcamStreamRef.current?.getTracks().forEach((t) => t.stop())
      webcamStreamRef.current = null
    }
  }, [selectedCamera, addToast])

  useEffect(() => {
    return () => {
      previewStreamRef.current?.getTracks().forEach((t) => t.stop())
      webcamStreamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  const startCursorTracking = useCallback(async () => {
    const startTime = Date.now()
    recordingStartRef.current = startTime
    setStartTime(startTime)

    // Fetch display info once at recording start for proper coordinate normalization
    try {
      const info = await window.api.getDisplayInfo()
      displayInfoRef.current = info
    } catch { /* ignore — will fall back to heuristic */ }

    // Start global mouse click capture (OS-level, captures clicks across all apps)
    try {
      await window.api.startGlobalMouseCapture(startTime)
    } catch { /* ignore */ }

    cursorIntervalRef.current = setInterval(async () => {
      try {
        const pos = await window.api.getCursorPosition()
        addCursorPoint({ x: pos.x, y: pos.y, t: Date.now() - recordingStartRef.current })
      } catch { /* ignore */ }
    }, 1000 / 30)
  }, [addCursorPoint, setStartTime])

  const stopCursorTracking = useCallback(() => {
    if (cursorIntervalRef.current) {
      clearInterval(cursorIntervalRef.current)
      cursorIntervalRef.current = null
    }
  }, [])


  const startTimer = useCallback(() => {
    elapsedRef.current = 0
    setElapsed(0)
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1000
      setElapsed(elapsedRef.current)
    }, 1000)
  }, [])

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
  }, [])

  const handleRecord = useCallback(async () => {
    if (status === 'recording') {
      mediaRecorderRef.current?.pause()
      setStatus('paused')
      stopCursorTracking()
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null }
      return
    }
    if (status === 'paused') {
      mediaRecorderRef.current?.resume()
      setStatus('recording')
      startCursorTracking()
      timerRef.current = setInterval(() => { elapsedRef.current += 1000; setElapsed(elapsedRef.current) }, 1000)
      return
    }
    if (!selectedSource) return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          // @ts-expect-error Electron desktopCapturer mandatory constraints
          mandatory: { chromeMediaSource: 'desktop', chromeMediaSourceId: selectedSource.id }
        }
      })

      try {
        const micId = selectedMic || selectedMicId
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: micId ? { deviceId: { exact: micId } } : true
        })
        audioStream.getAudioTracks().forEach((track) => stream.addTrack(track))
      } catch { addToast('No mic available, recording without audio', 'info') }

      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp9' })
      recorder.ondataavailable = (e) => { if (e.data.size > 0) addChunk(e.data) }
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop())
        if (stopResolveRef.current) {
          stopResolveRef.current()
          stopResolveRef.current = null
        }
      }

      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setMediaRecorder(recorder)
      setStatus('recording')
      startCursorTracking()
      startTimer()
    } catch (err) { addToast(`Failed: ${err}`, 'error') }
  }, [status, selectedSource, selectedMic, selectedMicId, addChunk, setMediaRecorder, setStatus, startCursorTracking, startTimer, stopCursorTracking, addToast])

  const handleStop = useCallback(async () => {
    if (!mediaRecorderRef.current || saving) return
    setSaving(true)
    stopCursorTracking()
    stopTimer()
    setStatus('stopped')
    addToast('Finishing recording...', 'info')

    // Wait for MediaRecorder to fully stop and flush all chunks
    await new Promise<void>((resolve) => {
      stopResolveRef.current = resolve
      mediaRecorderRef.current!.stop()
    })

    // All chunks are now flushed — safe to assemble
    const { recordedChunks, cursorData } = useRecordingStore.getState()
    if (recordedChunks.length === 0) {
      addToast('No data recorded', 'error')
      reset()
      setSaving(false)
      mediaRecorderRef.current = null
      return
    }

    // Stop global mouse capture and get the collected clicks
    let clickEvents: Array<{ x: number; y: number; t: number; button: number }> = []
    try {
      clickEvents = await window.api.stopGlobalMouseCapture()
    } catch { /* ignore */ }

    const blob = new Blob(recordedChunks, { type: 'video/webm' })
    const buffer = await blob.arrayBuffer()

    addToast('Saving and generating ready MP4...', 'info')

    const result = await window.api.autoSaveRecording({
      videoBuffer: buffer,
      cursorData,
      clickEvents,
      displayInfo: displayInfoRef.current || undefined
    })

    if (result.success) {
      const parts: string[] = []
      if (result.mp4Path) parts.push('Ready MP4')
      parts.push('Editor project')
      addToast(`Saved: ${parts.join(' + ')}`, 'success')

      // Auto-navigate to editor with the saved recording (Cursorful-style flow)
      if (result.projectDir) {
        const recordingPath = result.projectDir + (result.projectDir.includes('/') ? '/' : '\\') + 'recording.webm'
        sessionStorage.setItem('opentwo:auto-load', recordingPath)
        setTimeout(() => onOpenEditor(), 500) // Brief delay so user sees the toast
      }
    } else {
      addToast(`Save failed: ${result.error}`, 'error')
    }

    reset()
    setElapsed(0)
    setSaving(false)
    mediaRecorderRef.current = null
  }, [setStatus, stopCursorTracking, stopTimer, reset, addToast, saving, onOpenEditor])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'F9') { e.preventDefault(); handleRecord() }
      if (e.key === 'F10') { e.preventDefault(); if (status === 'recording' || status === 'paused') handleStop() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [status, handleRecord, handleStop])

  // Tray / global shortcut events
  useEffect(() => {
    const onTrayStart = (): void => { handleRecord() }
    const onTrayStop = (): void => { if (status === 'recording' || status === 'paused') handleStop() }
    window.addEventListener('opentwo:start-recording', onTrayStart)
    window.addEventListener('opentwo:stop-recording', onTrayStop)
    return () => {
      window.removeEventListener('opentwo:start-recording', onTrayStart)
      window.removeEventListener('opentwo:stop-recording', onTrayStop)
    }
  }, [status, handleRecord, handleStop])

  useEffect(() => {
    return () => { stopCursorTracking(); stopTimer() }
  }, [stopCursorTracking, stopTimer])

  const isRecording = status === 'recording' || status === 'paused'

  return (
    <div className="flex flex-col h-full select-none">
      <div className="flex items-center justify-between px-5 pt-4 pb-3">
        <LogoFull height={18} className="text-white" />
        <div className="flex items-center gap-1">
          <button onClick={onOpenEditor}
            className="px-2.5 py-1 rounded-lg text-[10px] text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors">
            Editor
          </button>
          <button onClick={onOpenSettings}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </button>
        </div>
      </div>

      <div className="flex-1 flex gap-5 px-5 pb-5 min-h-0">
        <div className="flex-1 flex flex-col gap-2 min-w-0">
          <label className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Screen</label>
          <select value={selectedSource?.id || ''} onChange={(e) => {
            const src = sources.find((s) => s.id === e.target.value)
            if (src) setSelectedSource(src)
          }} disabled={isRecording}
            className="w-full bg-surface-200 text-sm text-white/90 rounded-xl px-3 py-2.5 border border-white/[0.06] focus:outline-none focus:border-accent-500/30 disabled:opacity-40">
            {sources.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>

          <div className="relative flex-1 rounded-xl bg-surface-200 border border-white/[0.06] overflow-hidden flex items-center justify-center min-h-0">
            <video ref={previewVideoRef} autoPlay muted playsInline className="w-full h-full object-contain" />
            {!selectedSource && <span className="absolute text-[10px] text-white/25">No preview</span>}
            <WebcamOverlay stream={webcamStreamRef.current} visible={!!selectedCamera} />
          </div>
          {selectedSource && <span className="text-[10px] text-white/25 px-1 truncate">{selectedSource.name}</span>}
        </div>

        <div className="flex flex-col gap-5 w-[180px] shrink-0">
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Microphone</label>
            <select value={selectedMic} onChange={(e) => setSelectedMic(e.target.value)} disabled={isRecording}
              className="w-full bg-surface-200 text-sm text-white/90 rounded-xl px-3 py-2.5 border border-white/[0.06] focus:outline-none focus:border-accent-500/30 disabled:opacity-40">
              <option value="">Default</option>
              {mics.map((m) => <option key={m.deviceId} value={m.deviceId}>{m.label || `Mic ${m.deviceId.slice(0, 6)}`}</option>)}
            </select>
          </div>
          <div className="flex flex-col gap-2">
            <label className="text-[10px] font-medium text-white/50 uppercase tracking-wider">Camera</label>
            <select value={selectedCamera} onChange={(e) => setSelectedCamera(e.target.value)} disabled={isRecording}
              className="w-full bg-surface-200 text-sm text-white/90 rounded-xl px-3 py-2.5 border border-white/[0.06] focus:outline-none focus:border-accent-500/30 disabled:opacity-40">
              <option value="">None</option>
              {cameras.map((c) => <option key={c.deviceId} value={c.deviceId}>{c.label || `Camera ${c.deviceId.slice(0, 6)}`}</option>)}
            </select>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center gap-3">
            <button onClick={handleRecord} disabled={(!selectedSource && status === 'idle') || saving}
              className="group relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-30">
              <div className={`absolute inset-0 rounded-full transition-all duration-200 ${status === 'recording' ? 'bg-red-500 shadow-lg shadow-red-500/30'
                : status === 'paused' ? 'bg-accent-500 shadow-lg shadow-accent-500/20'
                  : 'bg-surface-300 group-hover:bg-surface-400'}`} />
              <div className={`relative transition-all duration-200 ${status === 'recording' ? 'w-5 h-5 rounded-sm bg-white'
                : status === 'paused' ? '' : 'w-7 h-7 rounded-full bg-red-500 group-hover:bg-red-400 group-hover:scale-110'}`}>
                {status === 'paused' && <svg width="20" height="20" viewBox="0 0 24 24" fill="white"><polygon points="5,3 19,12 5,21" /></svg>}
              </div>
            </button>

            {isRecording && (
              <button onClick={handleStop} disabled={saving}
                className="px-3 py-1.5 rounded-lg bg-surface-300 hover:bg-surface-400 text-[10px] text-white/50 transition-colors disabled:opacity-30">
                {saving ? 'Saving...' : 'Stop'}
              </button>
            )}
            {isRecording && (
              <div className="flex items-center gap-1.5">
                {status === 'recording' && <div className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />}
                <span className="text-xs font-mono text-white/50 tabular-nums">{formatDuration(elapsed)}</span>
              </div>
            )}
            {status === 'idle' && !saving && <span className="text-[10px] text-white/25 text-center">F9 to start</span>}
            {saving && <span className="text-[10px] text-accent-400 text-center animate-pulse">Processing...</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default Recorder
