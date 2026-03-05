import { useEffect } from 'react'
import { useRecordingStore } from '../stores/recording'

export function useRecording() {
  const store = useRecordingStore()

  useEffect(() => {
    const unsubStart = window.api.onTrayStartRecording(() => {
      if (store.status === 'idle' && store.selectedSource) {
        // Trigger recording start from tray
      }
    })

    const unsubStop = window.api.onTrayStopRecording(() => {
      if (store.status === 'recording' || store.status === 'paused') {
        // Trigger recording stop from tray
      }
    })

    return () => {
      unsubStart()
      unsubStop()
    }
  }, [store.status, store.selectedSource])

  return store
}
