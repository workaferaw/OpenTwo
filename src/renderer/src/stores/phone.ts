import { create } from 'zustand'

interface PhoneState {
  connected: boolean
  deviceName: string | null
  cameraActive: boolean
  micActive: boolean

  setConnected: (connected: boolean) => void
  setDeviceName: (name: string | null) => void
  setCameraActive: (active: boolean) => void
  setMicActive: (active: boolean) => void
  reset: () => void
}

export const usePhoneStore = create<PhoneState>((set) => ({
  connected: false,
  deviceName: null,
  cameraActive: false,
  micActive: false,

  setConnected: (connected) => set({ connected }),
  setDeviceName: (name) => set({ deviceName: name }),
  setCameraActive: (active) => set({ cameraActive: active }),
  setMicActive: (active) => set({ micActive: active }),
  reset: () =>
    set({
      connected: false,
      deviceName: null,
      cameraActive: false,
      micActive: false
    })
}))
