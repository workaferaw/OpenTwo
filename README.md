# OpenTwo

Open-source screen recording tool with zoom animations, blur regions, and phone-as-webcam — built for tutorial creators, demo presenters, and content creators.

> **Why "OpenTwo"?** If you count fingers from the thumb (1), the index finger is **two** — the finger you use to point at things. Instead of "cursor" or "pointer," we went with a creative twist.

## Features

### Available Now
- **Screen Recording** — capture any screen or window with system audio and microphone
- **Cursor Tracking** — records mouse position at 30fps alongside the video for post-processing
- **Source Picker** — visual grid to select which screen or window to record
- **Recording Controls** — start, pause, resume, stop with a clean overlay UI
- **Dark Theme** — modern dark UI inspired by professional creative tools
- **System Tray** — quick access to controls from the tray icon
- **Audio Device Selection** — pick your preferred microphone from settings

### Coming Soon
- **Zoom Animations** — auto-follow cursor with smooth zoom transitions, or manually place zoom keyframes in the editor
- **Blur Regions** — draw rectangles to blur sensitive areas (passwords, notifications, personal info)
- **Video Editor** — timeline with trim, split, zoom keyframe editing, and blur tools
- **Export to MP4** — FFmpeg-powered export in 720p, 1080p, or 4K with all effects baked in
- **Phone as Webcam** — connect your Android phone via USB to use its camera and mic (no apps needed)
- **Webcam Overlay** — picture-in-picture from phone or local webcam, draggable and resizable
- **Aspect Ratio Presets** — 16:9, 9:16, 4:3, 1:1 with custom backgrounds

## Tech Stack

| Layer | Technology |
|---|---|
| Desktop | Electron |
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Video Processing | FFmpeg |
| State Management | Zustand |
| Packaging | electron-builder |

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v20 or later
- npm v9 or later

### Installation

```bash
git clone https://github.com/workaferaw/OpenTwo.git
cd OpenTwo
npm install
```

### Development

```bash
npm run dev
```

### Build

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux
```

## Project Structure

```
src/
  main/           → Electron main process
    capture/      → Screen, audio, and cursor capture
    phone/        → ADB bridge for phone webcam/mic
    ffmpeg/       → Video processing and export
    project/      → Project file management
    ipc/          → IPC handlers
  preload/        → Context bridge (main ↔ renderer)
  renderer/       → React application
    pages/        → Home, Recording, Editor, Settings
    components/   → UI components
    stores/       → Zustand state stores
    hooks/        → Custom React hooks
```

## Roadmap

- [x] Phase 1: Project scaffolding and app shell
- [x] Phase 2: Core screen recording with cursor tracking
- [ ] Phase 3: Zoom animations
- [ ] Phase 4: Blur regions
- [ ] Phase 5: Editor and export
- [ ] Phase 6: Phone as webcam and mic
- [ ] Phase 7: Polish and release

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

## License

[MIT](LICENSE) — use it, fork it, build on it.
