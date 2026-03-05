import { useState, useEffect } from 'react'

interface MediaDevicesState {
  audioInputs: MediaDeviceInfo[]
  audioOutputs: MediaDeviceInfo[]
  videoInputs: MediaDeviceInfo[]
  loading: boolean
}

export function useMediaDevices(): MediaDevicesState {
  const [state, setState] = useState<MediaDevicesState>({
    audioInputs: [],
    audioOutputs: [],
    videoInputs: [],
    loading: true
  })

  useEffect(() => {
    const loadDevices = async () => {
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        setState({
          audioInputs: devices.filter((d) => d.kind === 'audioinput'),
          audioOutputs: devices.filter((d) => d.kind === 'audiooutput'),
          videoInputs: devices.filter((d) => d.kind === 'videoinput'),
          loading: false
        })
      } catch {
        setState((prev) => ({ ...prev, loading: false }))
      }
    }

    loadDevices()

    navigator.mediaDevices.addEventListener('devicechange', loadDevices)
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices)
  }, [])

  return state
}
