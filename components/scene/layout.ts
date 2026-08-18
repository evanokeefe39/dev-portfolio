import type { Harness, RangeKey, Rollups, SessionEntry } from '@/lib/types'

/**
 * Pure layout derivation for the harness-session scene — no three.js, no React,
 * fully unit-testable. Contracts (plan: tasks/plans/harness-scene-summaries.md):
 *
 * - window = sessions whose `day` is inside [snapshotDate - grainDays + 1, snapshotDate]
 * - 0 sessions       -> empty layout (the scene renders nothing)
 * - <= capacity (16) -> one character per session, newest first
 * - > capacity       -> one character per (repo x harness), top-N by session
 *                       count; overflow = groups beyond the seats
 *
 * Seat assignment is deterministic: item order == seat order (`seatIndex`).
 */

export const SEAT_CAPACITY = 16

/** Character feet height above the floor (standing on the chair seat). */
export const SEAT_Y = 0.44

const GRAIN_DAYS: Record<Exclude<RangeKey, 'all'>, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
}

export interface AgentItem {
  key: string
  harness: Harness
  repo: string
  /** Final body text for the tooltip (summary-or-fallback, or the rollup). */
  tooltip: string
  /** Mono title line: repo (per-session) or `repo · harness` (collapsed). */
  title: string
  /** 0..15 — the seat this character occupies (assignment order). */
  seatIndex: number
  /** Sessions this character represents (1 per-session, group size collapsed). */
  sessionCount: number
}

export type AgentLayout =
  | { mode: 'empty'; items: [] }
  | { mode: 'per-session'; items: AgentItem[] }
  | { mode: 'collapsed'; items: AgentItem[]; overflow: number }

export interface BuildAgentLayoutArgs {
  sessions: SessionEntry[]
  rollups: Rollups
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

function byStartTsDesc(a: SessionEntry, b: SessionEntry): number {
  if (a.startTs > b.startTs) return -1
  if (a.startTs < b.startTs) return 1
  return `${a.harness}:${a.sessionId}`.localeCompare(`${b.harness}:${b.sessionId}`)
}

export function buildAgentLayout(args: BuildAgentLayoutArgs): AgentLayout {
  const { sessions, rollups, range, snapshotDate } = args
  const capacity = args.capacity ?? SEAT_CAPACITY

  const windowSessions = sessions.filter((s) => inWindow(s.day, snapshotDate, range)).sort(byStartTsDesc)

  if (windowSessions.length === 0) {
    return { mode: 'empty', items: [] }
  }

  if (windowSessions.length <= capacity) {
    const items: AgentItem[] = windowSessions.map((s, i) => ({
      key: `${s.harness}:${s.sessionId}`,
      harness: s.harness,
      repo: s.repo,
      tooltip: s.summary ?? s.fallback ?? `${s.harness} · ${s.day}`,
      title: s.repo,
      seatIndex: i,
      sessionCount: 1,
    }))
    return { mode: 'per-session', items }
  }

  // Collapsed: one character per (repo x harness) pair with window activity.
  const groups = new Map<string, { key: string; harness: Harness; repo: string; sessions: SessionEntry[] }>()
  for (const s of windowSessions) {
    const groupKey = `${s.repo}|${s.harness}`
    let group = groups.get(groupKey)
    if (!group) {
      group = { key: groupKey, harness: s.harness, repo: s.repo, sessions: [] }
      groups.set(groupKey, group)
    }
    group.sessions.push(s)
  }

  const ordered = [...groups.values()].sort(
    (a, b) => b.sessions.length - a.sessions.length || a.key.localeCompare(b.key),
  )
  const top = ordered.slice(0, capacity)
  const overflow = Math.max(0, ordered.length - capacity)

  const items: AgentItem[] = top.map((g, i) => ({
    key: g.key,
    harness: g.harness,
    repo: g.repo,
    tooltip: rollups[range]?.[g.key] ?? 'Summary pending',
    title: `${g.repo} · ${g.harness}`,
    seatIndex: i,
    sessionCount: g.sessions.length,
  }))

  return { mode: 'collapsed', items, overflow }
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
