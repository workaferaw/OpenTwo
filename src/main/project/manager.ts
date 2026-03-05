import { readFile, writeFile, mkdir } from 'fs/promises'
import { existsSync } from 'fs'
import { join } from 'path'

export interface ProjectMetadata {
  name: string
  createdAt: string
  duration: number
  resolution: { width: number; height: number }
  files: {
    recording: string
    cursorData: string
    micAudio?: string
  }
  zoomKeyframes: unknown[]
  blurRegions: unknown[]
  trimPoints: { start: number; end: number }
}

export async function createProject(dir: string, name: string): Promise<string> {
  const projectDir = join(dir, `${name}.opentwo`)
  if (!existsSync(projectDir)) {
    await mkdir(projectDir, { recursive: true })
  }

  const metadata: ProjectMetadata = {
    name,
    createdAt: new Date().toISOString(),
    duration: 0,
    resolution: { width: 1920, height: 1080 },
    files: {
      recording: 'recording.webm',
      cursorData: 'cursor.json'
    },
    zoomKeyframes: [],
    blurRegions: [],
    trimPoints: { start: 0, end: 0 }
  }

  await writeFile(join(projectDir, 'project.json'), JSON.stringify(metadata, null, 2))
  return projectDir
}

export async function loadProject(projectDir: string): Promise<ProjectMetadata> {
  const raw = await readFile(join(projectDir, 'project.json'), 'utf-8')
  return JSON.parse(raw)
}

export async function saveProject(projectDir: string, metadata: ProjectMetadata): Promise<void> {
  await writeFile(join(projectDir, 'project.json'), JSON.stringify(metadata, null, 2))
}
