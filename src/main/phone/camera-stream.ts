import { spawn, ChildProcess } from 'child_process'
import { forwardPort, removeForward } from './adb-bridge'

export interface CameraStreamOptions {
  serial: string
  localPort: number
  remotePort: number
  resolution: { width: number; height: number }
}

export class PhoneCameraStream {
  private process: ChildProcess | null = null
  private active = false
  private serial = ''
  private localPort = 0

  async start(options: CameraStreamOptions): Promise<boolean> {
    this.serial = options.serial
    this.localPort = options.localPort

    const forwarded = await forwardPort(options.serial, options.localPort, options.remotePort)
    if (!forwarded) return false

    try {
      this.process = spawn('adb', [
        '-s',
        options.serial,
        'exec-out',
        `screenrecord --output-format=h264 --size ${options.resolution.width}x${options.resolution.height} -`
      ])

      this.process.on('error', () => {
        this.active = false
      })

      this.process.on('exit', () => {
        this.active = false
      })

      this.active = true
      return true
    } catch {
      return false
    }
  }

  getOutputStream(): NodeJS.ReadableStream | null {
    return this.process?.stdout ?? null
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill()
      this.process = null
    }
    this.active = false
    if (this.serial && this.localPort) {
      await removeForward(this.serial, this.localPort)
    }
  }

  isActive(): boolean {
    return this.active
  }
}
