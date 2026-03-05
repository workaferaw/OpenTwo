interface CursorPoint {
  x: number
  y: number
  t: number
}

interface DetectedZoom {
  timestamp: number
  region: { x: number; y: number; width: number; height: number }
  duration: number
  reason: 'linger' | 'click-cluster'
}

const LINGER_THRESHOLD_MS = 800
const LINGER_RADIUS_PX = 50
const ZOOM_REGION_SIZE = 400
const MIN_GAP_BETWEEN_ZOOMS_MS = 2000

export function detectZoomCandidates(
  cursorData: CursorPoint[],
  screenWidth: number,
  screenHeight: number
): DetectedZoom[] {
  const candidates: DetectedZoom[] = []
  if (cursorData.length < 10) return candidates

  let anchorIdx = 0

  for (let i = 1; i < cursorData.length; i++) {
    const anchor = cursorData[anchorIdx]
    const current = cursorData[i]
    const dist = Math.hypot(current.x - anchor.x, current.y - anchor.y)
    const elapsed = current.t - anchor.t

    if (dist > LINGER_RADIUS_PX) {
      if (elapsed >= LINGER_THRESHOLD_MS) {
        const centerX = anchor.x
        const centerY = anchor.y

        const halfW = ZOOM_REGION_SIZE / 2
        const halfH = ZOOM_REGION_SIZE / 2
        const rx = Math.max(0, Math.min(centerX - halfW, screenWidth - ZOOM_REGION_SIZE))
        const ry = Math.max(0, Math.min(centerY - halfH, screenHeight - ZOOM_REGION_SIZE))

        const last = candidates[candidates.length - 1]
        if (!last || anchor.t - (last.timestamp + last.duration) > MIN_GAP_BETWEEN_ZOOMS_MS) {
          candidates.push({
            timestamp: anchor.t,
            region: { x: rx, y: ry, width: ZOOM_REGION_SIZE, height: ZOOM_REGION_SIZE },
            duration: Math.min(elapsed, 3000),
            reason: 'linger'
          })
        }
      }
      anchorIdx = i
    }
  }

  return candidates
}
