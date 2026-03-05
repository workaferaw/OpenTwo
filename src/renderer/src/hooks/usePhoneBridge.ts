import { usePhoneStore } from '../stores/phone'

/**
 * Hook for phone USB bridge operations.
 * Manages ADB connection, camera streaming, and mic routing.
 *
 * Will be expanded in Phase 6 (Phone as Webcam and Mic).
 */

export function usePhoneBridge() {
  const store = usePhoneStore()

  const checkConnection = async () => {
    // Phase 6: Check ADB device connection
  }

  return {
    ...store,
    checkConnection
  }
}
