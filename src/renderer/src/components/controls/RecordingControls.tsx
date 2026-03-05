import { useCallback, useEffect, useRef, useState } from 'react'
import { useRecordingStore } from '../../stores/recording'
import { useSettingsStore } from '../../stores/settings'
import { useToastStore } from '../ui/Toast'

interface RecordingControlsProps {
  onChangeSource: () => void
}

function formatDuration(ms: number): string {
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  return `${m}:${s.toString().padStart(2, '0')}`
}

function RecordingControls({ onChangeSource }: RecordingControlsProps): JSX.Element {
  const {
    status, selectedSource, setStatus, setMediaRecorder,
    addChunk, addCursorPoint, setStartTime, reset
  } = useRecordingStore()
  const { selectedMicId } = useSettingsStore()
  const { addToast } = useToastStore()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const cursorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const [elapsed, setElapsed] = useState(0)
  const elapsedRef = useRef(0)

  const startCursorTracking = useCallback(() => {
    const startTime = Date.now()
    setStartTime(startTime)
    cursorIntervalRef.current = setInterval(async () => {
      try {
        const pos = await window.api.getCursorPosition()
        addCursorPoint({ x: pos.x, y: pos.y, t: Date.now() - startTime })
      } catch {
        /* ignore */
      }
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
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const pauseTimer = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current)
      timerRef.current = null
    }
  }, [])

  const resumeTimer = useCallback(() => {
    timerRef.current = setInterval(() => {
      elapsedRef.current += 1000
      setElapsed(elapsedRef.current)
    }, 1000)
  }, [])

  const handleStart = useCallback(async () => {
    if (!selectedSource) return

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          // @ts-expect-error Electron desktopCapturer mandatory constraints
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedSource.id
          }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({
          audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true
        })
        audioStream.getAudioTracks().forEach((track) => stream.addTrack(track))
      } catch {
        addToast('Microphone not available, recording without audio', 'info')
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      })

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) addChunk(event.data)
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setMediaRecorder(recorder)
      setStatus('recording')
      startCursorTracking()
      startTimer()
      addToast('Recording started', 'success')
    } catch (err) {
      addToast(`Failed to start recording: ${err}`, 'error')
    }
  }, [selectedSource, selectedMicId, addChunk, setMediaRecorder, setStatus, startCursorTracking, startTimer, addToast])

  const handlePause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      setStatus('paused')
      stopCursorTracking()
      pauseTimer()
    }
  }, [setStatus, stopCursorTracking, pauseTimer])

  const handleResume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      setStatus('recording')
      startCursorTracking()
      resumeTimer()
    }
  }, [setStatus, startCursorTracking, resumeTimer])

  const handleStop = useCallback(async () => {
    if (!mediaRecorderRef.current) return

    mediaRecorderRef.current.stop()
    stopCursorTracking()
    stopTimer()
    setStatus('stopped')

    setTimeout(async () => {
      const { recordedChunks, cursorData } = useRecordingStore.getState()
      const blob = new Blob(recordedChunks, { type: 'video/webm' })
      const buffer = await blob.arrayBuffer()
      const filePath = await window.api.showSaveDialog({ defaultName: `opentwo-${Date.now()}.webm` })

      if (filePath) {
        await window.api.saveFile(filePath, buffer)
        const jsonPath = filePath.replace('.webm', '.cursor.json')
        await window.api.saveJson(jsonPath, cursorData)
        addToast(`Recording saved: ${filePath.split(/[\\/]/).pop()}`, 'success')
      }

      reset()
      setElapsed(0)
      mediaRecorderRef.current = null
    }, 500)
  }, [setStatus, stopCursorTracking, stopTimer, reset, addToast])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return

      if (e.key === 'F9' || (e.ctrlKey && e.shiftKey && e.key === 'R')) {
        e.preventDefault()
        if (status === 'idle' && selectedSource) handleStart()
        else if (status === 'recording') handlePause()
        else if (status === 'paused') handleResume()
      }

      if (e.key === 'F10' || (e.ctrlKey && e.shiftKey && e.key === 'S')) {
        e.preventDefault()
        if (status === 'recording' || status === 'paused') handleStop()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [status, selectedSource, handleStart, handlePause, handleResume, handleStop])

  useEffect(() => {
    return () => {
      stopCursorTracking()
      stopTimer()
    }
  }, [stopCursorTracking, stopTimer])

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-surface-50 border-t border-white/5">
      <div className="flex items-center gap-3">
        <button onClick={onChangeSource}
          disabled={status === 'recording' || status === 'paused'}
          className="px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs text-white/60 transition-colors disabled:opacity-30">
          Change Source
        </button>
        {selectedSource && (
          <span className="text-xs text-white/30 truncate max-w-[200px]">
            {selectedSource.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {(status === 'recording' || status === 'paused') && (
          <div className="flex items-center gap-2 mr-2">
            {status === 'recording' && (
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            )}
            <span className="text-sm font-mono text-white/70 tabular-nums min-w-[52px]">
              {formatDuration(elapsed)}
            </span>
          </div>
        )}

        {status === 'idle' && (
          <button onClick={handleStart} disabled={!selectedSource}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-medium text-sm transition-colors disabled:opacity-30">
            <div className="w-3 h-3 rounded-full bg-white" />
            Start Recording
            <span className="text-[10px] text-white/50 ml-1">F9</span>
          </button>
        )}
        {status === 'recording' && (
          <>
            <button onClick={handlePause}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-300 hover:bg-surface-400 text-white/70 text-sm transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              Pause
            </button>
            <button onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors">
              <div className="w-3 h-3 rounded-sm bg-current" />
              Stop
              <span className="text-[10px] text-red-400/50 ml-1">F10</span>
            </button>
          </>
        )}
        {status === 'paused' && (
          <>
            <button onClick={handleResume}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-sm transition-colors">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              Resume
            </button>
            <button onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors">
              <div className="w-3 h-3 rounded-sm bg-current" />
              Stop
              <span className="text-[10px] text-red-400/50 ml-1">F10</span>
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default RecordingControls
