import { useEffect, useState } from 'react'
import { useSettingsStore } from '../stores/settings'

function Settings(): JSX.Element {
  const { outputDir, setOutputDir } = useSettingsStore()
  const [audioDevices, setAudioDevices] = useState<MediaDeviceInfo[]>([])
  const { selectedMicId, setSelectedMicId } = useSettingsStore()

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setAudioDevices(devices.filter((d) => d.kind === 'audioinput'))
    })
  }, [])

  const handleSelectOutputDir = async () => {
    const dir = await window.api.selectDirectory()
    if (dir) setOutputDir(dir)
  }

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-xl font-semibold text-white mb-1">Settings</h1>
      <p className="text-sm text-white/40 mb-8">Configure recording, audio, and output preferences.</p>

      <div className="space-y-8">
        <section>
          <h2 className="text-sm font-medium text-white/70 mb-4 uppercase tracking-wider">Output</h2>
          <div className="bg-surface-100 rounded-xl p-4 border border-white/5">
            <label className="text-xs text-white/50 mb-2 block">Recording output folder</label>
            <div className="flex items-center gap-3">
              <div className="flex-1 bg-surface-200 rounded-lg px-3 py-2 text-sm text-white/60 truncate">
                {outputDir || 'Default (Videos folder)'}
              </div>
              <button
                onClick={handleSelectOutputDir}
                className="px-4 py-2 rounded-lg bg-surface-300 hover:bg-surface-400 text-sm text-white/70 transition-colors"
              >
                Browse
              </button>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white/70 mb-4 uppercase tracking-wider">Audio</h2>
          <div className="bg-surface-100 rounded-xl p-4 border border-white/5 space-y-4">
            <div>
              <label className="text-xs text-white/50 mb-2 block">Microphone</label>
              <select
                value={selectedMicId}
                onChange={(e) => setSelectedMicId(e.target.value)}
                className="w-full bg-surface-200 rounded-lg px-3 py-2 text-sm text-white/70 border border-white/5 focus:outline-none focus:border-accent-500/50"
              >
                <option value="">System default</option>
                {audioDevices.map((device) => (
                  <option key={device.deviceId} value={device.deviceId}>
                    {device.label || `Microphone ${device.deviceId.slice(0, 8)}`}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white/70 mb-4 uppercase tracking-wider">Phone (USB)</h2>
          <div className="bg-surface-100 rounded-xl p-4 border border-white/5">
            <p className="text-sm text-white/40">
              Phone-as-webcam integration coming soon. Connect your Android phone via USB to use its camera and microphone.
            </p>
          </div>
        </section>

        <section>
          <h2 className="text-sm font-medium text-white/70 mb-4 uppercase tracking-wider">About</h2>
          <div className="bg-surface-100 rounded-xl p-4 border border-white/5">
            <p className="text-sm text-white/60">OpenTwo v0.1.0</p>
            <p className="text-xs text-white/30 mt-1">Open source screen recording tool (MIT License)</p>
            <a
              href="https://github.com/workaferaw/OpenTwo"
              className="text-xs text-accent-400 hover:text-accent-300 mt-2 inline-block"
            >
              github.com/workaferaw/OpenTwo
            </a>
          </div>
        </section>
      </div>
    </div>
  )
}

export default Settings
