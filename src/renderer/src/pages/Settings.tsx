import { useState, useEffect, ReactNode } from 'react'
import { useSettingsStore } from '../stores/settings'
import { usePhoneBridge } from '../hooks/usePhoneBridge'
import { LogoIcon } from '../components/ui/Logo'

interface SettingsProps {
  onBack: () => void
}

function Settings({ onBack }: SettingsProps): ReactNode {
  const {
    outputDir, setOutputDir,
    recordSystemAudio, setRecordSystemAudio,
    selectedMicId, setSelectedMicId,
    videoQuality, setVideoQuality,
    showCursorHighlight, setShowCursorHighlight,
    cursorStyle, setCursorStyle
  } = useSettingsStore()

  const { connected, deviceName, checkConnection } = usePhoneBridge()
  const [mics, setMics] = useState<MediaDeviceInfo[]>([])

  useEffect(() => {
    navigator.mediaDevices.enumerateDevices().then((devices) => {
      setMics(devices.filter((d) => d.kind === 'audioinput'))
    })
  }, [])

  const handleSelectDir = async (): Promise<void> => {
    const dir = await window.api.selectDirectory()
    if (dir) setOutputDir(dir)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-lg mx-auto p-5 pb-16">
        <div className="flex items-center gap-2 mb-5">
          <button onClick={onBack}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white/25 hover:text-white/50 hover:bg-white/[0.06] transition-colors">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </button>
          <h1 className="text-lg font-semibold text-white/90">Settings</h1>
        </div>

        <div className="space-y-5">
          <Section title="Output">
            <div className="flex items-center gap-2">
              <div className="flex-1 text-sm text-white/50 bg-surface-200 rounded-xl px-3 py-2.5 border border-white/[0.06] truncate">
                {outputDir || 'Default (Videos folder)'}
              </div>
              <button
                onClick={handleSelectDir}
                className="px-3.5 py-2.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-xs text-white/50 border border-white/[0.06] transition-colors"
              >
                Browse
              </button>
            </div>
          </Section>

          <Section title="Audio">
            <div className="space-y-3">
              <Row label="System Audio">
                <Toggle checked={recordSystemAudio} onChange={setRecordSystemAudio} />
              </Row>
              <Row label="Microphone">
                <select
                  value={selectedMicId}
                  onChange={(e) => setSelectedMicId(e.target.value)}
                  className="bg-surface-200 text-sm text-white/90 rounded-xl px-3 py-2 border border-white/[0.06] focus:outline-none focus:border-accent-500/30 w-48"
                >
                  <option value="">Default</option>
                  {mics.map((m) => (
                    <option key={m.deviceId} value={m.deviceId}>
                      {m.label || `Mic ${m.deviceId.slice(0, 8)}`}
                    </option>
                  ))}
                </select>
              </Row>
            </div>
          </Section>

          <Section title="Video">
            <Row label="Export Quality">
              <select
                value={videoQuality}
                onChange={(e) => setVideoQuality(e.target.value as 'high' | 'medium' | 'low')}
                className="bg-surface-200 text-sm text-white/90 rounded-xl px-3 py-2 border border-white/[0.06] focus:outline-none focus:border-accent-500/30"
              >
                <option value="high">High (1080p)</option>
                <option value="medium">Medium (720p)</option>
                <option value="low">Low (480p)</option>
              </select>
            </Row>
          </Section>

          <Section title="Cursor">
            <div className="space-y-3">
              <Row label="Highlight Cursor">
                <Toggle checked={showCursorHighlight} onChange={setShowCursorHighlight} />
              </Row>
              {showCursorHighlight && (
                <Row label="Style">
                  <div className="flex gap-1.5">
                    {(['default', 'highlight', 'enlarged'] as const).map((s) => (
                      <button
                        key={s}
                        onClick={() => setCursorStyle(s)}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                          cursorStyle === s
                            ? 'bg-accent-500/15 text-accent-400 border border-accent-500/20'
                            : 'bg-surface-200 text-white/50 border border-white/[0.06] hover:text-white/90'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </Row>
              )}
            </div>
          </Section>

          <Section title="Phone (USB)">
            <div className="space-y-2">
              <Row label="Status">
                <span className={`text-xs flex items-center gap-1.5 ${connected ? 'text-emerald-400' : 'text-white/25'}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-emerald-400' : 'bg-white/25'}`} />
                  {connected ? (deviceName || 'Connected') : 'Not connected'}
                </span>
              </Row>
              <Row label="">
                <button onClick={checkConnection}
                  className="px-3 py-1.5 rounded-lg bg-surface-200 hover:bg-surface-300 text-[10px] text-white/50 border border-white/[0.06] transition-colors">
                  Refresh
                </button>
              </Row>
            </div>
          </Section>

          <Section title="About">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent-500 flex items-center justify-center shrink-0">
                <LogoIcon size={20} className="text-surface" />
              </div>
              <div className="text-xs space-y-1">
                <p className="text-white/90 font-medium">OpenTwo v0.1.0</p>
                <p className="text-white/50">Open source screen recording tool</p>
                <p className="text-white/25">MIT License · github.com/workaferaw/OpenTwo</p>
              </div>
            </div>
          </Section>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }): ReactNode {
  return (
    <div className="rounded-xl bg-surface-100 border border-white/[0.06] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/[0.06]">
        <h3 className="text-[10px] font-medium text-white/50 uppercase tracking-wider">{title}</h3>
      </div>
      <div className="p-4">{children}</div>
    </div>
  )
}

function Row({ label, children }: { label: string; children: ReactNode }): ReactNode {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-white/50">{label}</span>
      {children}
    </div>
  )
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }): ReactNode {
  return (
    <button
      onClick={() => onChange(!checked)}
      className={`w-9 h-5 rounded-full transition-colors duration-150 relative ${
        checked ? 'bg-accent-500' : 'bg-surface-300'
      }`}
    >
      <div
        className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-150 ${
          checked ? 'translate-x-[18px]' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

export default Settings
