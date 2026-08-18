import type { Harness, RangeKey, SessionEntry } from '@/lib/types'
import { HARNESSES } from '@/lib/types'

/**
 * Pure layout derivation for the deterministic session-krab scene — no
 * three.js, no React, fully unit-testable. Contracts (scene-focus plan):
 *
 * - window = sessions whose `day` is inside [snapshotDate - grainDays + 1, snapshotDate]
 * - 0 window sessions -> empty layout (the scene renders nothing)
 * - at every range (7d/30d/90d/1y/all): one krab per repo, top-N by
 *   assistantMessages (repo magnitude = total assistant messages);
 *   overflow = repos beyond the seats
 *
 * Seat assignment is deterministic: item order == seat order (`seatIndex`).
 */

export const SEAT_CAPACITY = 16

/** Krab feet height above the floor (standing on the chair seat). */
export const SEAT_Y = 0.44

/** Couch 1 seat top, facing +x (into the room) → krab rotation.y = -Math.PI/2. */
export const COUCH_SPOTLIGHT_SEAT: [number, number, number] = [-4.2, 0.54, 5.25]

const GRAIN_DAYS: Record<Exclude<RangeKey, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

export interface KrabItem {
  key: string
  harness: Harness
  repo: string
  /** Mono title line for the tooltip pill (`${repo} · ${harness}`). */
  tooltipTitle: string
  /** Deterministic stats body — repo aggregate (sessions, days, msgs, LOC, PRs).
   *  Two newline-separated lines; no harness counts (harness = chip/color). */
  tooltipBody: string
  /** 0..15 — the seat this krab occupies (assignment order). */
  seatIndex: number
  /** Krab scale — sessionScale(assistantMessages), ~0.55..1.1. */
  scale: number
}

export type KrabLayout =
  | { mode: 'empty'; items: [] }
  | { mode: 'repos'; items: KrabItem[]; overflow: number }

export interface BuildKrabLayoutArgs {
  sessions: SessionEntry[]
  range: RangeKey
  snapshotDate: string
  /** Defaults to SEAT_CAPACITY (16). Overridable for smaller scenes/tests. */
  capacity?: number
}

/** `dateStr` minus `n` days in 'YYYY-MM-DD' (UTC-safe, no local-tz skew). */
function subDays(dateStr: string, n: number): string {
  const d = new Date(`${dateStr}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return ''
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

/** True when `day` falls inside the grain window ending at `snapshotDate`. */
function inWindow(day: string, snapshotDate: string, range: RangeKey): boolean {
  if (day === '') return false
  if (range === 'all') return true
  const start = subDays(snapshotDate, GRAIN_DAYS[range] - 1)
  if (start === '') return false
  // 'YYYY-MM-DD' sorts lexicographically, so string comparison is a date range check.
  return day >= start && day <= snapshotDate
}

/** Sessions inside the grain window ending at `snapshotDate` — filter only,
 *  no sorting (per-repo retained lists are sorted in `aggregateReposByRepo`). */
export function filterWindow(
  sessions: SessionEntry[],
  range: RangeKey,
  snapshotDate: string,
): SessionEntry[] {
  return sessions.filter((s) => inWindow(s.day, snapshotDate, range))
}

/**
 * Session magnitude -> krab scale. Monotonic non-decreasing in `msgs`:
 * ~0.55 at 0 messages, capping at 1.1 once `msgs` >= 9999.
 */
export function sessionScale(msgs: number): number {
  return 0.55 + 0.55 * Math.min(Math.log10(1 + Math.max(0, msgs)) / 4, 1)
}

/**
 * Structured per-session summary for the focus panel. Fields stay separate so
 * the panel can color the LOC clause by sign and conditionally render the
 * branch icon + name (branch is null in the >7d lazy slices, present in 7d).
 */
export interface SessionRowParts {
  day: string
  msgs: number
  loc: { added: number; removed: number } | null
  prRefs: number[]
  branch: string | null
  title: string | null
}

/** `title ?? summary` — same fallback semantics as the retired sessionRow. */
export function sessionRowParts(s: SessionEntry): SessionRowParts {
  return {
    day: s.day,
    msgs: s.assistantMessages,
    loc: s.locDelta !== null ? { added: s.locDelta.added, removed: s.locDelta.removed } : null,
    prRefs: s.prRefs,
    branch: s.branch,
    title: s.title ?? s.summary,
  }
}

export interface RepoHarnessCount {
  harness: Harness
  sessions: number
}

export interface RepoAggregate {
  repo: string
  /** Distinct days with activity inside the window. */
  daysActive: number
  /** The window sessions for this repo, newest-first (startTs desc,
   *  tie-break `${harness}:${sessionId}`). Session count = `sessions.length`. */
  sessions: SessionEntry[]
  assistantMessages: number
  locAdded: number
  locRemoved: number
  /** Total `#NNN` PR references across the window's sessions. */
  prRefs: number
  /** Per-harness session counts, most sessions first (ties by HARNESSES order). */
  harnesses: RepoHarnessCount[]
  /** Dominant harness = `harnesses[0]`. */
  harness: Harness
}

/** Deterministic harness order: most sessions first, ties by HARNESSES order. */
function byHarnessSessionsDesc(a: RepoHarnessCount, b: RepoHarnessCount): number {
  if (a.sessions !== b.sessions) return b.sessions - a.sessions
  return HARNESSES.indexOf(a.harness) - HARNESSES.indexOf(b.harness)
}

/** Deterministic repo order: biggest first (assistantMessages), ties by name. */
function byRepoMagnitudeDesc(a: RepoAggregate, b: RepoAggregate): number {
  if (a.assistantMessages !== b.assistantMessages) return b.assistantMessages - a.assistantMessages
  return a.repo.localeCompare(b.repo)
}

/** Deterministic order for a repo's retained sessions: newest first
 *  (startTs desc), ties by `${harness}:${sessionId}`. */
function byNewestFirst(a: SessionEntry, b: SessionEntry): number {
  if (a.startTs > b.startTs) return -1
  if (a.startTs < b.startTs) return 1
  return `${a.harness}:${a.sessionId}`.localeCompare(`${b.harness}:${b.sessionId}`)
}

/** Collapse a window's sessions into one aggregate per repo, biggest first. */
export function aggregateReposByRepo(sessions: SessionEntry[]): RepoAggregate[] {
  const byRepo = new Map<
    string,
    {
      assistantMessages: number
      locAdded: number
      locRemoved: number
      prRefs: number
      days: Set<string>
      harnesses: Map<Harness, number>
      sessionList: SessionEntry[]
    }
  >()

  for (const s of sessions) {
    let acc = byRepo.get(s.repo)
    if (!acc) {
      acc = {
        assistantMessages: 0,
        locAdded: 0,
        locRemoved: 0,
        prRefs: 0,
        days: new Set(),
        harnesses: new Map(),
        sessionList: [],
      }
      byRepo.set(s.repo, acc)
    }
    acc.assistantMessages += s.assistantMessages
    if (s.locDelta !== null) {
      acc.locAdded += s.locDelta.added
      acc.locRemoved += s.locDelta.removed
    }
    acc.prRefs += s.prRefs.length
    acc.days.add(s.day)
    acc.harnesses.set(s.harness, (acc.harnesses.get(s.harness) ?? 0) + 1)
    acc.sessionList.push(s)
  }

  const aggregates: RepoAggregate[] = []
  for (const [repo, acc] of byRepo) {
    const harnesses: RepoHarnessCount[] = [...acc.harnesses.entries()]
      .map(([harness, sessions]) => ({ harness, sessions }))
      .sort(byHarnessSessionsDesc)
    aggregates.push({
      repo,
      daysActive: acc.days.size,
      assistantMessages: acc.assistantMessages,
      locAdded: acc.locAdded,
      locRemoved: acc.locRemoved,
      prRefs: acc.prRefs,
      harnesses,
      harness: harnesses[0].harness,
      sessions: acc.sessionList.sort(byNewestFirst),
    })
  }

  aggregates.sort(byRepoMagnitudeDesc)
  return aggregates
}

/**
 * Deterministic repo-aggregate tooltip body — two lines, pinned by tests and
 * parsed by SessionKrab:
 *   line 1: `${sessions.length} sessions · days · msgs`
 *   line 2: `+added −removed LOC` (+ ` · N PR refs` when the repo has PR refs)
 * No harness-count line — the harness shows as the chip/color in the
 * component instead.
 */
export function repoTooltipBody(r: RepoAggregate): string {
  const locLine = `+${r.locAdded} −${r.locRemoved} LOC${r.prRefs > 0 ? ` · ${r.prRefs} PR refs` : ''}`
  return [
    `${r.sessions.length} sessions · ${r.daysActive} days · ${r.assistantMessages} assistant msgs`,
    locLine,
  ].join('\n')
}

export function buildKrabLayout(args: BuildKrabLayoutArgs): KrabLayout {
  const { sessions, range, snapshotDate } = args
  const capacity = args.capacity ?? SEAT_CAPACITY

  const windowSessions = filterWindow(sessions, range, snapshotDate)

  if (windowSessions.length === 0) {
    return { mode: 'empty', items: [] }
  }

  // Every range aggregates by repo: one krab per repo, biggest repos fill the
  // seats first; overflow repos render on the couch spotlight when selected.
  const repos = aggregateReposByRepo(windowSessions)
  const top = repos.slice(0, capacity)
  const overflow = Math.max(0, repos.length - capacity)
  const items: KrabItem[] = top.map((r, i) => ({
    key: r.repo,
    harness: r.harness,
    repo: r.repo,
    tooltipTitle: `${r.repo} · ${r.harness}`,
    tooltipBody: repoTooltipBody(r),
    seatIndex: i,
    scale: sessionScale(r.assistantMessages),
  }))
  return { mode: 'repos', items, overflow }
}

export type FocusTarget =
  | { kind: 'desk'; item: KrabItem }
  | { kind: 'couch'; repo: RepoAggregate }
  | null

/**
 * Resolve a selected repo to its scene anchor: desk when the repo has a krab
 * on the desk row (top-N items), couch when it is aggregated but overflowed,
 * null when nothing is selected or the repo is unknown.
 */
export function resolveFocus(
  items: KrabItem[],
  repos: RepoAggregate[],
  selectedRepo: string | null,
): FocusTarget {
  if (selectedRepo === null) return null
  const item = items.find((i) => i.repo === selectedRepo)
  if (item !== undefined) return { kind: 'desk', item }
  const repo = repos.find((r) => r.repo === selectedRepo)
  if (repo !== undefined) return { kind: 'couch', repo }
  return null
}

/**
 * The 16 chair seats at the hot desks — exactly the slots the furniture uses
 * (environments/warehouse/Furniture.tsx `DeskChairs`): two desks at (1.0, -1.5)
 * and (1.0, 2.5); per desk, side = wi < 4 ? -1 : 1, col = wi % 4,
 * dx = desk.cx - 1.5 + col * 1.0, dz = desk.cz + side * 0.85.
 */
export const SEAT_POSITIONS: [number, number, number][] = (() => {
  const desks = [
    { cx: 1.0, cz: -1.5 },
    { cx: 1.0, cz: 2.5 },
  ]
  const seats: [number, number, number][] = []
  for (const desk of desks) {
    for (let wi = 0; wi < 8; wi++) {
      const side = wi < 4 ? -1 : 1
      const col = wi % 4
      seats.push([desk.cx - 1.5 + col * 1.0, SEAT_Y, desk.cz + side * 0.85])
    }
  }
  return seats
})()
