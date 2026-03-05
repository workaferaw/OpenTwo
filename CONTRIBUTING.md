# Contributing to OpenTwo

Thanks for your interest in contributing to OpenTwo! Here's how to get started.

## Development Setup

1. **Clone the repo**
   ```bash
   git clone https://github.com/workaferaw/OpenTwo.git
   cd OpenTwo
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Start development**
   ```bash
   npm run dev
   ```
   This launches the Electron app with hot module replacement.

## Project Structure

- `src/main/` — Electron main process (Node.js). Handles screen capture, file I/O, FFmpeg, ADB.
- `src/preload/` — Context bridge between main and renderer.
- `src/renderer/` — React frontend. All UI, state management, and user interaction.

## Code Style

- TypeScript throughout
- React functional components with hooks
- Zustand for state management
- Tailwind CSS for styling (dark theme)

## Making Changes

1. Create a feature branch from `main`
2. Make your changes
3. Test locally with `npm run dev`
4. Build to verify no issues: `npm run build`
5. Open a pull request with a clear description

## Reporting Issues

Open an issue on GitHub with:
- What you expected to happen
- What actually happened
- Steps to reproduce
- Your OS and OpenTwo version

## Feature Requests

Open an issue with the `enhancement` label describing the feature and why it would be useful.
