interface CursorPoint {
  x: number
  y: number
  t: number
}

interface ClickEvent {
  x: number
  y: number
  t: number
  button: number
}

interface DetectedZoom {
  timestamp: number
  region: { x: number; y: number; width: number; height: number }
  duration: number
  transitionIn: number
  transitionOut: number
  reason: 'linger' | 'click-cluster'
}

const LINGER_THRESHOLD_MS = 800
const LINGER_RADIUS_PX = 50
const ZOOM_REGION_SIZE = 400
const MIN_GAP_BETWEEN_ZOOMS_MS = 500
const CLICK_BURST_WINDOW_MS = 3000
const MIN_CLICKS_FOR_ZOOM = 2
const ZOOM_HOLD_AFTER_LAST_CLICK_MS = 1500

export function detectZoomCandidates(
  cursorData: CursorPoint[],
  screenWidth: number,
  screenHeight: number,
  clickEvents?: ClickEvent[]
): DetectedZoom[] {
  const candidates: DetectedZoom[] = []

  // Click-cluster detection (Cursorful-style): 2+ clicks within 3s window trigger zoom
  if (clickEvents && clickEvents.length >= MIN_CLICKS_FOR_ZOOM) {
    let burstStart = 0
    for (let i = 1; i <= clickEvents.length; i++) {
      const gapToNext = i < clickEvents.length ? clickEvents[i].t - clickEvents[i - 1].t : Infinity
      if (gapToNext > CLICK_BURST_WINDOW_MS || i === clickEvents.length) {
        const burst = clickEvents.slice(burstStart, i)
        if (burst.length >= MIN_CLICKS_FOR_ZOOM) {
          let cx = 0, cy = 0
          for (const c of burst) { cx += c.x; cy += c.y }
          cx /= burst.length
          cy /= burst.length

          const halfW = ZOOM_REGION_SIZE / 2
          const rx = Math.max(0, Math.min(cx - halfW, screenWidth - ZOOM_REGION_SIZE))
          const ry = Math.max(0, Math.min(cy - halfW, screenHeight - ZOOM_REGION_SIZE))

          const startMs = burst[0].t
          const holdDuration = burst[burst.length - 1].t - startMs + ZOOM_HOLD_AFTER_LAST_CLICK_MS

          const last = candidates[candidates.length - 1]
          if (!last || startMs - (last.timestamp + last.duration) > MIN_GAP_BETWEEN_ZOOMS_MS) {
            candidates.push({
              timestamp: startMs,
              region: { x: rx, y: ry, width: ZOOM_REGION_SIZE, height: ZOOM_REGION_SIZE },
              duration: holdDuration + 800,
              transitionIn: 400,
              transitionOut: 500,
              reason: 'click-cluster'
            })
          }
        }
        burstStart = i
      }
    }
  }

  // Linger detection (fallback if no click data)
  if (cursorData.length >= 10) {
    let anchorIdx = 0
    for (let i = 1; i < cursorData.length; i++) {
      const anchor = cursorData[anchorIdx]
      const current = cursorData[i]
      const dist = Math.hypot(current.x - anchor.x, current.y - anchor.y)
      const elapsed = current.t - anchor.t

      if (dist > LINGER_RADIUS_PX) {
        if (elapsed >= LINGER_THRESHOLD_MS) {
          const halfW = ZOOM_REGION_SIZE / 2
          const rx = Math.max(0, Math.min(anchor.x - halfW, screenWidth - ZOOM_REGION_SIZE))
          const ry = Math.max(0, Math.min(anchor.y - halfW, screenHeight - ZOOM_REGION_SIZE))

          const last = candidates[candidates.length - 1]
          if (!last || anchor.t - (last.timestamp + last.duration) > MIN_GAP_BETWEEN_ZOOMS_MS) {
            candidates.push({
              timestamp: anchor.t,
              region: { x: rx, y: ry, width: ZOOM_REGION_SIZE, height: ZOOM_REGION_SIZE },
              duration: Math.min(elapsed, 3000) + 800,
              transitionIn: 400,
              transitionOut: 500,
              reason: 'linger'
            })
          }
        }
        anchorIdx = i
      }
    }
  }

  return candidates.sort((a, b) => a.timestamp - b.timestamp)
}
