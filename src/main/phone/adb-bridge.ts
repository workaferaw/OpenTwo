import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export interface AdbDevice {
  serial: string
  model: string
  status: 'device' | 'offline' | 'unauthorized'
}

export async function isAdbAvailable(): Promise<boolean> {
  try {
    await execAsync('adb version')
    return true
  } catch {
    return false
  }
}

export async function getConnectedDevices(): Promise<AdbDevice[]> {
  try {
    const { stdout } = await execAsync('adb devices -l')
    const lines = stdout.trim().split('\n').slice(1)

    return lines
      .filter((line) => line.trim().length > 0)
      .map((line) => {
        const parts = line.trim().split(/\s+/)
        const serial = parts[0]
        const status = parts[1] as AdbDevice['status']
        const modelMatch = line.match(/model:(\S+)/)
        const model = modelMatch ? modelMatch[1] : 'Unknown Device'

        return { serial, model, status }
      })
  } catch {
    return []
  }
}

export async function forwardPort(serial: string, localPort: number, remotePort: number): Promise<boolean> {
  try {
    await execAsync(`adb -s ${serial} forward tcp:${localPort} tcp:${remotePort}`)
    return true
  } catch {
    return false
  }
}

export async function removeForward(serial: string, localPort: number): Promise<void> {
  try {
    await execAsync(`adb -s ${serial} forward --remove tcp:${localPort}`)
  } catch {
    // ignore cleanup errors
  }
}
