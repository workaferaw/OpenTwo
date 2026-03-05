import { useCallback, useEffect } from 'react'
import { usePhoneStore } from '../stores/phone'

export function usePhoneBridge() {
  const store = usePhoneStore()

  const checkConnection = useCallback(async () => {
    const adbAvailable = await window.api.checkAdb()
    if (!adbAvailable) {
      store.setConnected(false)
      store.setDeviceName(null)
      return
    }

    const devices = await window.api.getPhoneDevices()
    const connected = devices.filter((d) => d.status === 'device')

    if (connected.length > 0) {
      store.setConnected(true)
      store.setDeviceName(connected[0].model)
    } else {
      store.setConnected(false)
      store.setDeviceName(null)
    }
  }, [store])

  useEffect(() => {
    checkConnection()
    const interval = setInterval(checkConnection, 5000)
    return () => clearInterval(interval)
  }, [checkConnection])

  return {
    ...store,
    checkConnection
  }
}
