import type { Harness, RangeKey, SessionEntry } from '@/lib/types'
import { HARNESSES } from '@/lib/types'

/**
 * Pure layout derivation for the deterministic session-krab scene — no
 * three.js, no React, fully unit-testable. Contracts (frontend-pivot-spec):
 *
 * - window = sessions whose `day` is inside [snapshotDate - grainDays + 1, snapshotDate]
 * - 0 window sessions -> empty layout (the scene renders nothing)
 * - at 7d: one krab per session, top-N by (assistantMessages desc,
 *   startTs desc); overflow = sessions beyond the seats
 * - at 30d/90d/1y/all: one krab per repo, top-N by assistantMessages
 *   (repo magnitude = total assistant messages); overflow = repos beyond
 *   the seats
 *
 * Seat assignment is deterministic: item order == seat order (`seatIndex`).
 */

export const SEAT_CAPACITY = 16

/** Krab feet height above the floor (standing on the chair seat). */
export const SEAT_Y = 0.44

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
  /** Deterministic stats body — session (day, msgs, LOC, PRs, branch,
   *  summary) or repo aggregate (sessions, days, msgs, LOC, PRs, harnesses). */
  tooltipBody: string
  /** 0..15 — the seat this krab occupies (assignment order). */
  seatIndex: number
  /** Krab scale — sessionScale(assistantMessages), ~0.55..1.1. */
  scale: number
}

export type KrabLayout =
  | { mode: 'empty'; items: [] }
  | { mode: 'sessions'; items: KrabItem[]; overflow: number }
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
 *  no sorting (callers order per mode). */
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
 * Deterministic tooltip body for a session: `day · N assistant msgs ·
 * +added/−removed LOC` (or "no commit activity that day"), then a PRs line,
 * a branch line, and the harvested summary text when present.
 */
export function tooltipBody(session: SessionEntry): string {
  const loc =
    session.locDelta === null
      ? 'no commit activity that day'
      : `+${session.locDelta.added}/−${session.locDelta.removed} LOC`
  const lines = [`${session.day} · ${session.assistantMessages} assistant msgs · ${loc}`]
  if (session.prRefs.length > 0) lines.push(`PRs #${session.prRefs.join(' #')}`)
  if (session.branch !== null) lines.push(`branch ${session.branch}`)
  if (session.summary !== null) lines.push(session.summary)
  return lines.join('\n')
}

/** Deterministic per-session order: biggest first, then newest, then key. */
function byMagnitudeDesc(a: SessionEntry, b: SessionEntry): number {
  if (a.assistantMessages !== b.assistantMessages) return b.assistantMessages - a.assistantMessages
  if (a.startTs > b.startTs) return -1
  if (a.startTs < b.startTs) return 1
  return `${a.harness}:${a.sessionId}`.localeCompare(`${b.harness}:${b.sessionId}`)
}

export interface RepoHarnessCount {
  harness: Harness
  sessions: number
}

export interface RepoAggregate {
  repo: string
  /** Distinct days with activity inside the window. */
  daysActive: number
  sessions: number
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

/** Collapse a window's sessions into one aggregate per repo, biggest first. */
export function aggregateReposByRepo(sessions: SessionEntry[]): RepoAggregate[] {
  const byRepo = new Map<
    string,
    {
      sessions: number
      assistantMessages: number
      locAdded: number
      locRemoved: number
      prRefs: number
      days: Set<string>
      harnesses: Map<Harness, number>
    }
  >()

  for (const s of sessions) {
    let acc = byRepo.get(s.repo)
    if (!acc) {
      acc = {
        sessions: 0,
        assistantMessages: 0,
        locAdded: 0,
        locRemoved: 0,
        prRefs: 0,
        days: new Set(),
        harnesses: new Map(),
      }
      byRepo.set(s.repo, acc)
    }
    acc.sessions += 1
    acc.assistantMessages += s.assistantMessages
    if (s.locDelta !== null) {
      acc.locAdded += s.locDelta.added
      acc.locRemoved += s.locDelta.removed
    }
    acc.prRefs += s.prRefs.length
    acc.days.add(s.day)
    acc.harnesses.set(s.harness, (acc.harnesses.get(s.harness) ?? 0) + 1)
  }

  const aggregates: RepoAggregate[] = []
  for (const [repo, acc] of byRepo) {
    const harnesses: RepoHarnessCount[] = [...acc.harnesses.entries()]
      .map(([harness, sessions]) => ({ harness, sessions }))
      .sort(byHarnessSessionsDesc)
    aggregates.push({
      repo,
      daysActive: acc.days.size,
      sessions: acc.sessions,
      assistantMessages: acc.assistantMessages,
      locAdded: acc.locAdded,
      locRemoved: acc.locRemoved,
      prRefs: acc.prRefs,
      harnesses,
      harness: harnesses[0].harness,
    })
  }

  aggregates.sort(byRepoMagnitudeDesc)
  return aggregates
}

/**
 * Deterministic repo-aggregate tooltip body — `sessions · days · msgs`,
 * `+LOC/−LOC` (plus PR refs when present), then the top-3 harnesses.
 */
export function repoTooltipBody(r: RepoAggregate): string {
  const locLine = `+${r.locAdded}/−${r.locRemoved} LOC${r.prRefs > 0 ? ` · ${r.prRefs} PR refs` : ''}`
  const harnessLine = r.harnesses
    .slice(0, 3)
    .map((h) => `${h.harness} ${h.sessions}`)
    .join(' · ')
  return [
    `${r.sessions} sessions · ${r.daysActive} days · ${r.assistantMessages} assistant msgs`,
    locLine,
    harnessLine,
  ].join('\n')
}

export function buildKrabLayout(args: BuildKrabLayoutArgs): KrabLayout {
  const { sessions, range, snapshotDate } = args
  const capacity = args.capacity ?? SEAT_CAPACITY

  const windowSessions = filterWindow(sessions, range, snapshotDate)

  if (windowSessions.length === 0) {
    return { mode: 'empty', items: [] }
  }

  // 7d keeps the per-session view: one krab per session, top-N by magnitude.
  if (range === '7d') {
    const top = windowSessions.sort(byMagnitudeDesc).slice(0, capacity)
    const overflow = Math.max(0, windowSessions.length - capacity)
    const items: KrabItem[] = top.map((s, i) => ({
      key: `${s.harness}:${s.sessionId}`,
      harness: s.harness,
      repo: s.repo,
      tooltipTitle: `${s.repo} · ${s.harness}`,
      tooltipBody: tooltipBody(s),
      seatIndex: i,
      scale: sessionScale(s.assistantMessages),
    }))
    return { mode: 'sessions', items, overflow }
  }

  // Coarser grains: one krab per repo, biggest repos fill the seats first.
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
