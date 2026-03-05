import { useState, useEffect } from 'react'
import { useSettingsStore } from '../../stores/settings'

function AudioDevices(): JSX.Element {
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([])
  const { selectedMicId, setSelectedMicId, recordSystemAudio, setRecordSystemAudio } =
    useSettingsStore()

  useEffect(() => {
    const loadDevices = async () => {
      const allDevices = await navigator.mediaDevices.enumerateDevices()
      setDevices(allDevices.filter((d) => d.kind === 'audioinput'))
    }
    loadDevices()

    navigator.mediaDevices.addEventListener('devicechange', loadDevices)
    return () => navigator.mediaDevices.removeEventListener('devicechange', loadDevices)
  }, [])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs text-white/50">System Audio</label>
        <button
          onClick={() => setRecordSystemAudio(!recordSystemAudio)}
          className={`relative w-9 h-5 rounded-full transition-colors ${
            recordSystemAudio ? 'bg-accent-600' : 'bg-surface-400'
          }`}
        >
          <div
            className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition-transform ${
              recordSystemAudio ? 'left-[18px]' : 'left-0.5'
            }`}
          />
        </button>
      </div>

      <div>
        <label className="text-xs text-white/50 mb-1.5 block">Microphone</label>
        <select
          value={selectedMicId}
          onChange={(e) => setSelectedMicId(e.target.value)}
          className="w-full bg-surface-200 rounded-lg px-3 py-2 text-sm text-white/70 border border-white/5 focus:outline-none focus:border-accent-500/50"
        >
          <option value="">System default</option>
          {devices.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Mic ${device.deviceId.slice(0, 8)}`}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}

export default AudioDevices
