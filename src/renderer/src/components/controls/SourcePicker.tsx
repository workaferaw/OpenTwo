import { useState, useEffect } from 'react'
import { useRecordingStore, DesktopSource } from '../../stores/recording'

interface SourcePickerProps {
  onSourceSelected: () => void
}

function SourcePicker({ onSourceSelected }: SourcePickerProps): JSX.Element {
  const [sources, setSources] = useState<DesktopSource[]>([])
  const [loading, setLoading] = useState(true)
  const { setSelectedSource } = useRecordingStore()

  useEffect(() => {
    loadSources()
  }, [])

  const loadSources = async () => {
    setLoading(true)
    try {
      const desktopSources = await window.api.getDesktopSources()
      setSources(desktopSources)
    } catch (err) {
      console.error('Failed to load sources:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelect = (source: DesktopSource) => {
    setSelectedSource(source)
    onSourceSelected()
  }

  return (
    <div className="flex flex-col h-full p-6">
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-white mb-1">Select a Source</h2>
        <p className="text-sm text-white/40">Choose a screen or window to record.</p>
      </div>

      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="w-6 h-6 border-2 border-accent-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 overflow-y-auto pb-4">
          {sources.map((source) => (
            <button
              key={source.id}
              onClick={() => handleSelect(source)}
              className="group relative rounded-xl overflow-hidden border border-white/10 hover:border-accent-500/50 transition-all hover:scale-[1.02]"
            >
              <div className="aspect-video bg-surface-200">
                {source.thumbnail && (
                  <img
                    src={source.thumbnail}
                    alt={source.name}
                    className="w-full h-full object-cover"
                  />
                )}
              </div>
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <div className="p-2 bg-surface-100">
                <p className="text-xs text-white/60 truncate">{source.name}</p>
              </div>
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-end pt-4 border-t border-white/5">
        <button
          onClick={loadSources}
          className="px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-sm text-white/60 transition-colors"
        >
          Refresh Sources
        </button>
      </div>
    </div>
  )
}

export default SourcePicker
