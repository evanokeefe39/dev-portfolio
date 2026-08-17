import type {
  ActivityItem,
  LocDelta,
  ModelUsage,
  PrsReferenced,
  RangeKey,
  RangeStats,
  Sessions,
  Snapshot,
  TokenBurn,
} from './types'
import { RANGE_KEYS } from './types'

/**
 * Snapshot loading + normalization for the client stat card.
 *
 * Contract (portfolio-plan + assignment):
 * - absent (HTTP 404) or top-level-malformed data -> `null` -> the card renders
 *   zeros with a "no data yet" state, never crashes
 * - partially-populated data -> missing fields normalize to zeros so the rest
 *   of the card still renders
 */

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function finiteNumber(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null
}

function numberArray(v: unknown): number[] {
  if (!Array.isArray(v)) return []
  return v.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
}

function pairArray(v: unknown): [number, number][] {
  if (!Array.isArray(v)) return []
  return v.filter(
    (p): p is [number, number] =>
      Array.isArray(p) &&
      p.length === 2 &&
      typeof p[0] === 'number' &&
      Number.isFinite(p[0]) &&
      typeof p[1] === 'number' &&
      Number.isFinite(p[1]),
  )
}

function normalizeTokenBurn(raw: unknown): TokenBurn {
  const r = isRecord(raw) ? raw : {}
  return {
    total: finiteNumber(r.total) ?? 0,
    changePct: r.changePct === null ? null : (finiteNumber(r.changePct) ?? null),
    sparkline: numberArray(r.sparkline),
  }
}

function normalizeModels(raw: unknown): ModelUsage[] {
  if (!Array.isArray(raw)) return []
  const models: ModelUsage[] = []
  for (const m of raw) {
    if (!isRecord(m)) continue
    const tokens = finiteNumber(m.tokens)
    if (typeof m.model !== 'string' || m.model === '' || tokens === null) continue
    models.push({ model: m.model, tokens })
  }
  return models.sort((a, b) => b.tokens - a.tokens)
}

function normalizeCost(raw: unknown): RangeStats['cost'] {
  const r = isRecord(raw) ? raw : {}
  const b = isRecord(r.breakdown) ? r.breakdown : {}
  return {
    total: finiteNumber(r.total) ?? 0,
    breakdown: {
      input: finiteNumber(b.input) ?? 0,
      output: finiteNumber(b.output) ?? 0,
      cacheWrite: finiteNumber(b.cacheWrite) ?? 0,
      cacheRead: finiteNumber(b.cacheRead) ?? 0,
    },
  }
}

function normalizeSessions(raw: unknown): Sessions {
  const r = isRecord(raw) ? raw : {}
  return { total: finiteNumber(r.total) ?? 0, active: finiteNumber(r.active) ?? 0 }
}

function normalizePrs(raw: unknown): PrsReferenced {
  const r = isRecord(raw) ? raw : {}
  return {
    count: finiteNumber(r.count) ?? 0,
    activeRepos: finiteNumber(r.activeRepos) ?? 0,
    sparkline: numberArray(r.sparkline),
  }
}

function normalizeLoc(raw: unknown): LocDelta {
  const r = isRecord(raw) ? raw : {}
  return {
    net: finiteNumber(r.net) ?? 0,
    added: finiteNumber(r.added) ?? 0,
    removed: finiteNumber(r.removed) ?? 0,
    sparkline: pairArray(r.sparkline),
  }
}

function normalizeRange(raw: unknown): RangeStats {
  const r = isRecord(raw) ? raw : {}
  return {
    tokenBurn: normalizeTokenBurn(r.tokenBurn),
    tokensByModel: normalizeModels(r.tokensByModel),
    cost: normalizeCost(r.cost),
    sessions: normalizeSessions(r.sessions),
    prsReferenced: normalizePrs(r.prsReferenced),
    locDelta: normalizeLoc(r.locDelta),
  }
}

function normalizeActivity(raw: unknown): ActivityItem[] {
  if (!Array.isArray(raw)) return []
  const items: ActivityItem[] = []
  for (const a of raw) {
    if (!isRecord(a)) continue
    if (typeof a.repo !== 'string' || typeof a.message !== 'string' || typeof a.ts !== 'string') {
      continue
    }
    items.push({
      repo: a.repo,
      message: a.message,
      prRefs: Array.isArray(a.prRefs)
        ? a.prRefs.filter((n): n is number => typeof n === 'number' && Number.isFinite(n))
        : [],
      branch: typeof a.branch === 'string' ? a.branch : null,
      linesAdded: finiteNumber(a.linesAdded) ?? 0,
      linesRemoved: finiteNumber(a.linesRemoved) ?? 0,
      ts: a.ts,
    })
  }
  return items
}

/**
 * Validate + normalize a parsed snapshot. Returns `null` when the payload is
 * not a snapshot-shaped object (top-level missing `ranges`), so callers show
 * the empty state. All five ranges are always present after normalization.
 */
export function normalizeSnapshot(raw: unknown): Snapshot | null {
  if (!isRecord(raw)) return null
  if (!isRecord(raw.ranges)) return null

  const ranges = {} as Record<RangeKey, RangeStats>
  for (const key of RANGE_KEYS) {
    ranges[key] = normalizeRange(raw.ranges[key])
  }

  return {
    snapshotDate: typeof raw.snapshotDate === 'string' ? raw.snapshotDate : '',
    generatedAt: typeof raw.generatedAt === 'string' ? raw.generatedAt : '',
    ranges,
    recentActivity: normalizeActivity(raw.recentActivity),
  }
}

function emptyRange(): RangeStats {
  return {
    tokenBurn: { total: 0, changePct: null, sparkline: [] },
    tokensByModel: [],
    cost: { total: 0, breakdown: { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 } },
    sessions: { total: 0, active: 0 },
    prsReferenced: { count: 0, activeRepos: 0, sparkline: [] },
    locDelta: { net: 0, added: 0, removed: 0, sparkline: [] },
  }
}

/** Zeroed snapshot used for the "no data yet" state. */
export function emptySnapshot(): Snapshot {
  const ranges = {} as Record<RangeKey, RangeStats>
  for (const key of RANGE_KEYS) {
    ranges[key] = emptyRange()
  }
  return { snapshotDate: '', generatedAt: '', ranges, recentActivity: [] }
}

/**
 * Fetch /data/current.json at runtime (client side). Any failure — 404, bad
 * JSON, network error — resolves to `null`; callers render the empty state.
 */
export async function loadSnapshot(): Promise<Snapshot | null> {
  try {
    const res = await fetch('/data/current.json', { cache: 'no-store' })
    if (!res.ok) return null
    const raw: unknown = await res.json()
    return normalizeSnapshot(raw)
  } catch {
    return null
  }
}
