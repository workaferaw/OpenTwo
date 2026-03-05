import { useEffect, useCallback } from 'react'
import { useRecordingStore } from '../stores/recording'
import { useNavigate } from 'react-router-dom'

export function useRecording() {
  const store = useRecordingStore()
  const navigate = useNavigate()

  const triggerStart = useCallback(() => {
    if (store.status === 'idle' && store.selectedSource) {
      navigate('/recording')
      window.dispatchEvent(new CustomEvent('opentwo:start-recording'))
    }
  }, [store.status, store.selectedSource, navigate])

  const triggerStop = useCallback(() => {
    if (store.status === 'recording' || store.status === 'paused') {
      window.dispatchEvent(new CustomEvent('opentwo:stop-recording'))
    }
  }, [store.status])

  useEffect(() => {
    const unsubStart = window.api.onTrayStartRecording(triggerStart)
    const unsubStop = window.api.onTrayStopRecording(triggerStop)

    return () => {
      unsubStart()
      unsubStop()
    }
  }, [triggerStart, triggerStop])

  return store
}
