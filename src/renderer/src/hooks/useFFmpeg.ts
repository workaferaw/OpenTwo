/**
 * Hook for FFmpeg operations in the renderer.
 * Export and transcoding operations are handled by the main process;
 * this hook provides the IPC interface.
 *
 * Will be expanded in Phase 5 (Editor & Export).
 */

export function useFFmpeg() {
  const exportVideo = async (_inputPath: string, _outputPath: string) => {
    // Phase 5: IPC call to main process FFmpeg export
  }

  return { exportVideo }
}
