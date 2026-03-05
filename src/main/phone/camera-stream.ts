/**
 * Phone camera streaming over USB.
 *
 * This module will handle receiving the camera feed from an Android phone
 * connected via USB using ADB port forwarding. The phone runs a lightweight
 * streaming service that sends MJPEG or H.264 frames over a TCP socket.
 *
 * Implementation will be completed in Phase 6.
 */

export interface CameraStreamOptions {
  serial: string
  localPort: number
  remotePort: number
  resolution: { width: number; height: number }
}

export class PhoneCameraStream {
  private active = false

  async start(_options: CameraStreamOptions): Promise<void> {
    this.active = true
    // Phase 6: implement camera stream reception
  }

  stop(): void {
    this.active = false
  }

  isActive(): boolean {
    return this.active
  }
}
