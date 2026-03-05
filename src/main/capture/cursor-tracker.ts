import { screen } from 'electron'

export interface CursorPoint {
  x: number
  y: number
  t: number
}

export interface DisplayInfo {
  scaleFactor: number
  width: number
  height: number
}

export interface CursorTrackResult {
  points: CursorPoint[]
  displayInfo: DisplayInfo
}

export class CursorTracker {
  private points: CursorPoint[] = []
  private interval: ReturnType<typeof setInterval> | null = null
  private startTime = 0
  private fps: number
  private displayInfo: DisplayInfo = { scaleFactor: 1, width: 1920, height: 1080 }

  constructor(fps = 30) {
    this.fps = fps
  }

  start(): void {
    this.points = []
    this.startTime = Date.now()

    // Capture display info at recording start
    const primaryDisplay = screen.getPrimaryDisplay()
    this.displayInfo = {
      scaleFactor: primaryDisplay.scaleFactor,
      width: primaryDisplay.size.width,
      height: primaryDisplay.size.height
    }

    this.interval = setInterval(() => {
      const point = screen.getCursorScreenPoint()
      this.points.push({
        x: point.x,
        y: point.y,
        t: Date.now() - this.startTime
      })
    }, 1000 / this.fps)
  }

  stop(): CursorTrackResult {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    return { points: this.points, displayInfo: this.displayInfo }
  }

  pause(): void {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
  }

  resume(): void {
    if (!this.interval) {
      this.interval = setInterval(() => {
        const point = screen.getCursorScreenPoint()
        this.points.push({
          x: point.x,
          y: point.y,
          t: Date.now() - this.startTime
        })
      }, 1000 / this.fps)
    }
  }

  getPoints(): CursorPoint[] {
    return this.points
  }

  getDisplayInfo(): DisplayInfo {
    return this.displayInfo
  }
}

