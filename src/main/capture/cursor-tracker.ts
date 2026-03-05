import { screen } from 'electron'

export interface CursorPoint {
  x: number
  y: number
  t: number
}

export class CursorTracker {
  private points: CursorPoint[] = []
  private interval: ReturnType<typeof setInterval> | null = null
  private startTime = 0
  private fps: number

  constructor(fps = 30) {
    this.fps = fps
  }

  start(): void {
    this.points = []
    this.startTime = Date.now()

    this.interval = setInterval(() => {
      const point = screen.getCursorScreenPoint()
      this.points.push({
        x: point.x,
        y: point.y,
        t: Date.now() - this.startTime
      })
    }, 1000 / this.fps)
  }

  stop(): CursorPoint[] {
    if (this.interval) {
      clearInterval(this.interval)
      this.interval = null
    }
    return this.points
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
}
