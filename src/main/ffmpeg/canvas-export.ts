/**
 * Canvas-based export pipeline (main process side).
 * Receives a rendered WebM blob from the renderer and remuxes to MP4 with audio.
 */
import { path as ffmpegPath } from '@ffmpeg-installer/ffmpeg'
import { execFileSync } from 'child_process'
import { join } from 'path'
import { tmpdir } from 'os'
import { writeFileSync, unlinkSync, existsSync, mkdirSync, rmdirSync } from 'fs'
import { ipcMain, BrowserWindow } from 'electron'

interface CanvasExportState {
    outputPath: string
    audioSourcePath: string
    tempDir: string
}

let exportState: CanvasExportState | null = null

export function registerCanvasExportHandlers(): void {
    ipcMain.handle(
        'canvas-export:start',
        async (
            _event,
            options: {
                outputPath: string
                audioSourcePath: string
                width: number
                height: number
                fps: number
                totalFrames: number
            }
        ) => {
            const tempDir = join(tmpdir(), `opentwo-export-${Date.now()}`)
            mkdirSync(tempDir, { recursive: true })

            exportState = {
                outputPath: options.outputPath,
                audioSourcePath: options.audioSourcePath,
                tempDir
            }

            console.log(`[Canvas Export] Ready for WebM blob. Output: ${options.outputPath}`)
            return { success: true }
        }
    )

    // Receive the final rendered WebM blob and remux to MP4
    ipcMain.handle(
        'canvas-export:save-blob',
        async (_event, webmBuffer: ArrayBuffer) => {
            if (!exportState) return { success: false, error: 'Export not started' }

            const state = exportState
            const webmPath = join(state.tempDir, 'rendered.webm')
            writeFileSync(webmPath, Buffer.from(webmBuffer))
            console.log(
                `[Canvas Export] WebM saved (${Math.round(Buffer.from(webmBuffer).length / 1024)}KB). Remuxing to MP4...`
            )

            try {
                // Remux to MP4 with audio from original recording
                execFileSync(
                    ffmpegPath,
                    [
                        '-y',
                        '-i', webmPath,          // rendered video (no audio)
                        '-i', state.audioSourcePath,  // original recording (audio source)
                        '-c:v', 'libx264',
                        '-pix_fmt', 'yuv420p',
                        '-preset', 'fast',
                        '-crf', '20',
                        '-c:a', 'aac',
                        '-b:a', '192k',
                        '-map', '0:v:0',         // video from rendered WebM
                        '-map', '1:a:0?',        // audio from original (optional)
                        '-shortest',
                        '-movflags', '+faststart',
                        state.outputPath
                    ],
                    { timeout: 300000 }
                )

                console.log('[Canvas Export] Done! Output:', state.outputPath)
                return { success: true, path: state.outputPath }
            } catch (err) {
                console.error('[Canvas Export] FFmpeg error:', err)
                return { success: false, error: String(err) }
            } finally {
                // Cleanup
                try {
                    if (existsSync(webmPath)) unlinkSync(webmPath)
                    rmdirSync(state.tempDir)
                } catch (_e) { /* ignore */ }
                exportState = null
            }
        }
    )

    // Keep the old handlers for compatibility but they're no longer used for frame-by-frame
    ipcMain.handle('canvas-export:frame', async () => {
        return { success: true }
    })

    ipcMain.handle('canvas-export:finish', async () => {
        return { success: true }
    })
}
