import { useState, useRef, useEffect } from 'react'
import SourcePicker from '../components/controls/SourcePicker'
import RecordingControls from '../components/controls/RecordingControls'
import WebcamOverlay from '../components/webcam/WebcamOverlay'
import { useRecordingStore } from '../stores/recording'
import { usePhoneStore } from '../stores/phone'

function Recording(): JSX.Element {
  const { status, selectedSource } = useRecordingStore()
  const { connected: phoneConnected, cameraActive } = usePhoneStore()
  const [showSourcePicker, setShowSourcePicker] = useState(!selectedSource)
  const videoRef = useRef<HTMLVideoElement>(null)
  const [liveStream, setLiveStream] = useState<MediaStream | null>(null)
  const [phoneStream, setPhoneStream] = useState<MediaStream | null>(null)
  const [showWebcam, setShowWebcam] = useState(false)

  useEffect(() => {
    if (!selectedSource || status === 'idle') {
      if (liveStream) {
        liveStream.getTracks().forEach((t) => t.stop())
        setLiveStream(null)
      }
      return
    }

    const startPreview = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: {
            // @ts-expect-error Electron desktopCapturer mandatory constraints
            mandatory: {
              chromeMediaSource: 'desktop',
              chromeMediaSourceId: selectedSource.id
            }
          }
        })
        setLiveStream(stream)
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
      } catch {
        setLiveStream(null)
      }
    }

    if (status === 'recording' || status === 'paused') {
      startPreview()
    }

    return () => {
      if (liveStream) {
        liveStream.getTracks().forEach((t) => t.stop())
      }
    }
  }, [selectedSource, status])

  const toggleWebcam = async () => {
    if (showWebcam) {
      phoneStream?.getTracks().forEach((t) => t.stop())
      setPhoneStream(null)
      setShowWebcam(false)
    } else {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true })
        setPhoneStream(stream)
        setShowWebcam(true)
      } catch {
        setShowWebcam(false)
      }
    }
  }

  if (showSourcePicker && status === 'idle') {
    return <SourcePicker onSourceSelected={() => setShowSourcePicker(false)} />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center bg-surface relative">
        {selectedSource ? (
          <div className="relative w-full h-full flex items-center justify-center p-6">
            <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl max-w-full max-h-full">
              {(status === 'recording' || status === 'paused') && liveStream ? (
                <video
                  ref={videoRef}
                  className="max-w-full max-h-[calc(100vh-200px)] object-contain"
                  muted
                  playsInline
                />
              ) : (
                selectedSource.thumbnail && (
                  <img
                    src={selectedSource.thumbnail}
                    alt={selectedSource.name}
                    className="max-w-full max-h-[calc(100vh-200px)] object-contain"
                  />
                )
              )}
              {status === 'recording' && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-red-500/90 backdrop-blur-sm px-3 py-1 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                  <span className="text-xs font-medium text-white">Recording</span>
                </div>
              )}
              {status === 'paused' && (
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-yellow-500/90 backdrop-blur-sm px-3 py-1 rounded-full">
                  <div className="w-2 h-2 rounded-full bg-white" />
                  <span className="text-xs font-medium text-white">Paused</span>
                </div>
              )}
            </div>

            {showWebcam && <WebcamOverlay stream={phoneStream} visible={showWebcam} />}
          </div>
        ) : (
          <p className="text-white/30 text-sm">No source selected</p>
        )}
      </div>

      <div className="flex items-center gap-2 px-4 py-1.5 border-t border-white/5 bg-surface-50">
        <button onClick={toggleWebcam}
          className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-medium transition-colors ${
            showWebcam ? 'bg-accent-600 text-white' : 'bg-surface-200 text-white/40 hover:text-white/60'
          }`}>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M23 7l-7 5 7 5V7z" /><rect x="1" y="5" width="15" height="14" rx="2" />
          </svg>
          {showWebcam ? 'Webcam On' : 'Webcam'}
        </button>
        {phoneConnected && (
          <span className="text-[10px] text-green-400/70 flex items-center gap-1">
            <div className="w-1.5 h-1.5 rounded-full bg-green-400" />
            Phone connected
          </span>
        )}
      </div>

      <RecordingControls onChangeSource={() => setShowSourcePicker(true)} />
    </div>
  )
}

export default Recording
