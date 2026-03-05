import { uIOhook, UiohookMouseEvent } from 'uiohook-napi'
import { screen } from 'electron'

interface ClickEvent {
    x: number
    y: number
    t: number
    button: number
}

let capturing = false
let clicks: ClickEvent[] = []
let startTime = 0
let scaleFactor = 1

function onMouseDown(e: UiohookMouseEvent): void {
    if (!capturing) return
    // uiohook reports raw logical pixels — multiply by scaleFactor
    // to match cursor tracking which uses screen.getCursorScreenPoint() * scaleFactor
    clicks.push({
        x: e.x * scaleFactor,
        y: e.y * scaleFactor,
        t: Date.now() - startTime,
        button: e.button === 1 ? 0 : e.button === 2 ? 2 : 1 // 1=left→0, 2=right→2, 3=middle→1
    })
}

export function startGlobalClickCapture(recordingStartTime: number): void {
    if (capturing) return
    capturing = true
    clicks = []
    startTime = recordingStartTime

    // Capture scale factor for coordinate normalization
    const primary = screen.getPrimaryDisplay()
    scaleFactor = primary.scaleFactor

    uIOhook.on('mousedown', onMouseDown)
    uIOhook.start()
}

export function stopGlobalClickCapture(): ClickEvent[] {
    if (!capturing) return []
    capturing = false

    uIOhook.off('mousedown', onMouseDown)
    uIOhook.stop()

    return clicks
}

export function getGlobalClicks(): ClickEvent[] {
    return clicks
}
