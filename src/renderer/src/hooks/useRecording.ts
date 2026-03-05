import { useEffect, useCallback } from 'react'
import { useRecordingStore } from '../stores/recording'

export function useRecording() {
  const store = useRecordingStore()

  const triggerStart = useCallback(() => {
    if (store.status === 'idle' && store.selectedSource) {
      window.dispatchEvent(new CustomEvent('opentwo:start-recording'))
    }
  }, [store.status, store.selectedSource])

  const triggerStop = useCallback(() => {
    if (store.status === 'recording' || store.status === 'paused') {
      window.dispatchEvent(new CustomEvent('opentwo:stop-recording'))
    }
  }, [store.status])

  useEffect(() => {
    const unsubStart = window.api.onTrayStartRecording(triggerStart)
    const unsubStop = window.api.onTrayStopRecording(triggerStop)
    return () => { unsubStart(); unsubStop() }
  }, [triggerStart, triggerStop])

  return store
}
