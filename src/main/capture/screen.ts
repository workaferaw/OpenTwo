import { desktopCapturer } from 'electron'

export interface ScreenSource {
  id: string
  name: string
  thumbnailDataUrl: string
}

export async function getScreenSources(): Promise<ScreenSource[]> {
  const sources = await desktopCapturer.getSources({
    types: ['window', 'screen'],
    thumbnailSize: { width: 320, height: 180 }
  })

  return sources.map((source) => ({
    id: source.id,
    name: source.name,
    thumbnailDataUrl: source.thumbnail.toDataURL()
  }))
}
