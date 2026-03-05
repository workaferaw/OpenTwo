import { useState } from 'react'
import SourcePicker from '../components/controls/SourcePicker'
import RecordingControls from '../components/controls/RecordingControls'
import { useRecordingStore } from '../stores/recording'

function Recording(): JSX.Element {
  const { status, selectedSource } = useRecordingStore()
  const [showSourcePicker, setShowSourcePicker] = useState(!selectedSource)

  if (showSourcePicker && status === 'idle') {
    return <SourcePicker onSourceSelected={() => setShowSourcePicker(false)} />
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 flex items-center justify-center bg-surface">
        {selectedSource ? (
          <div className="relative w-full h-full flex items-center justify-center p-6">
            <div className="relative rounded-xl overflow-hidden border border-white/10 shadow-2xl max-w-full max-h-full">
              {selectedSource.thumbnail && (
                <img
                  src={selectedSource.thumbnail}
                  alt={selectedSource.name}
                  className="max-w-full max-h-[calc(100vh-200px)] object-contain"
                />
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
          </div>
        ) : (
          <p className="text-white/30 text-sm">No source selected</p>
        )}
      </div>

      <RecordingControls onChangeSource={() => setShowSourcePicker(true)} />
    </div>
  )
}

export default Recording
