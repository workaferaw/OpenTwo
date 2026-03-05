/**
 * Phone microphone audio streaming over USB.
 *
 * Routes audio from the phone's microphone through ADB port forwarding
 * so it can be used as an audio input in OpenTwo.
 *
 * Implementation will be completed in Phase 6.
 */

export interface AudioStreamOptions {
  serial: string
  localPort: number
  remotePort: number
  sampleRate: number
}

export class PhoneAudioStream {
  private active = false

  async start(_options: AudioStreamOptions): Promise<void> {
    this.active = true
    // Phase 6: implement audio stream reception
  }

  stop(): void {
    this.active = false
  }

  isActive(): boolean {
    return this.active
  }
}
