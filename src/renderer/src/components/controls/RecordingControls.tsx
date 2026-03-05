import { useCallback, useEffect, useRef } from 'react'
import { useRecordingStore } from '../../stores/recording'
import { useSettingsStore } from '../../stores/settings'

interface RecordingControlsProps {
  onChangeSource: () => void
}

function RecordingControls({ onChangeSource }: RecordingControlsProps): JSX.Element {
  const {
    status,
    selectedSource,
    setStatus,
    setMediaRecorder,
    addChunk,
    addCursorPoint,
    setStartTime,
    reset
  } = useRecordingStore()
  const { selectedMicId } = useSettingsStore()
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const cursorIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const startCursorTracking = useCallback(() => {
    const startTime = Date.now()
    setStartTime(startTime)
    cursorIntervalRef.current = setInterval(async () => {
      try {
        const pos = await window.api.getCursorPosition()
        addCursorPoint({ x: pos.x, y: pos.y, t: Date.now() - startTime })
      } catch {
        // ignore cursor tracking errors
      }
    }, 1000 / 30) // 30fps tracking
  }, [addCursorPoint, setStartTime])

  const stopCursorTracking = useCallback(() => {
    if (cursorIntervalRef.current) {
      clearInterval(cursorIntervalRef.current)
      cursorIntervalRef.current = null
    }
  }, [])

  const handleStart = useCallback(async () => {
    if (!selectedSource) return

    try {
      const constraints: MediaStreamConstraints = {
        audio: false,
        video: {
          // @ts-expect-error Electron's mandatory constraint for desktopCapturer
          mandatory: {
            chromeMediaSource: 'desktop',
            chromeMediaSourceId: selectedSource.id
          }
        }
      }

      const stream = await navigator.mediaDevices.getUserMedia(constraints)

      if (selectedMicId || true) {
        try {
          const audioStream = await navigator.mediaDevices.getUserMedia({
            audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true
          })
          audioStream.getAudioTracks().forEach((track) => stream.addTrack(track))
        } catch {
          console.warn('Could not capture audio')
        }
      }

      const recorder = new MediaRecorder(stream, {
        mimeType: 'video/webm;codecs=vp9'
      })

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          addChunk(event.data)
        }
      }

      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop())
      }

      recorder.start(1000)
      mediaRecorderRef.current = recorder
      setMediaRecorder(recorder)
      setStatus('recording')
      startCursorTracking()
    } catch (err) {
      console.error('Failed to start recording:', err)
    }
  }, [selectedSource, selectedMicId, addChunk, setMediaRecorder, setStatus, startCursorTracking])

  const handlePause = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.pause()
      setStatus('paused')
      stopCursorTracking()
    }
  }, [setStatus, stopCursorTracking])

  const handleResume = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'paused') {
      mediaRecorderRef.current.resume()
      setStatus('recording')
      startCursorTracking()
    }
  }, [setStatus, startCursorTracking])

  const handleStop = useCallback(async () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop()
      stopCursorTracking()
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
        }

        reset()
        mediaRecorderRef.current = null
      }, 500)
    }
  }, [setStatus, stopCursorTracking, reset])

  useEffect(() => {
    return () => {
      stopCursorTracking()
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [stopCursorTracking])

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-surface-50 border-t border-white/5">
      <div className="flex items-center gap-3">
        <button
          onClick={onChangeSource}
          disabled={status === 'recording' || status === 'paused'}
          className="px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs text-white/60 transition-colors disabled:opacity-30"
        >
          Change Source
        </button>
        {selectedSource && (
          <span className="text-xs text-white/30 truncate max-w-[200px]">
            {selectedSource.name}
          </span>
        )}
      </div>

      <div className="flex items-center gap-3">
        {status === 'idle' && (
          <button
            onClick={handleStart}
            disabled={!selectedSource}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-red-500 hover:bg-red-400 text-white font-medium text-sm transition-colors disabled:opacity-30"
          >
            <div className="w-3 h-3 rounded-full bg-white" />
            Start Recording
          </button>
        )}
        {status === 'recording' && (
          <>
            <button
              onClick={handlePause}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-300 hover:bg-surface-400 text-white/70 text-sm transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
              Pause
            </button>
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors"
            >
              <div className="w-3 h-3 rounded-sm bg-current" />
              Stop
            </button>
          </>
        )}
        {status === 'paused' && (
          <>
            <button
              onClick={handleResume}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent-600 hover:bg-accent-500 text-white text-sm transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="5,3 19,12 5,21" />
              </svg>
              Resume
            </button>
            <button
              onClick={handleStop}
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 text-sm transition-colors"
            >
              <div className="w-3 h-3 rounded-sm bg-current" />
              Stop
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default RecordingControls
