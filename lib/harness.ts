import type { Harness } from './types'

/**
 * Per-harness voxel palette, shared by the R3F krabs and DOM carousels.
 * Values mirror the palette in components/scene/SessionKrab.tsx.
 */
export const HARNESS_COLORS: Record<Harness, { body: string; dark: string }> = {
  omp: { body: '#e8865a', dark: '#a8542f' },
  claude: { body: '#cc785c', dark: '#8f4a36' },
  pi: { body: '#3fb3a0', dark: '#2a7a6c' },
  codex: { body: '#6a7bd8', dark: '#4653a0' },
}
