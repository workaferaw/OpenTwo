import { useState, useCallback, useEffect } from 'react'

export function useFFmpeg() {
  const [exporting, setExporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const unsub = window.api.onExportProgress((percent) => {
      setProgress(Math.round(percent))
    })
    return unsub
  }, [])

  const exportVideo = useCallback(
    async (options: {
      inputPath: string
      outputPath: string
      format: 'mp4' | 'webm'
      resolution: '720p' | '1080p' | '4k'
      fps: number
      blurRegions?: Array<{
        x: number
        y: number
        width: number
        height: number
        startTime: number
        endTime: number
      }>
    }) => {
      setExporting(true)
      setProgress(0)
      setError(null)

      const result = await window.api.exportVideo(options as unknown as Record<string, unknown>)

      setExporting(false)
      if (!result.success) {
        setError(result.error || 'Export failed')
      }
      return result
    },
    []
  )

  return { exportVideo, exporting, progress, error }
}
