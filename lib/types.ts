/**
 * Snapshot schema — single source of truth for the frontend.
 * Mirrors public/data/current.json, produced by the data_pipeline package.
 */

export type RangeKey = '7d' | '30d' | '90d' | '1y' | 'all'

export const RANGE_KEYS: RangeKey[] = ['7d', '30d', '90d', '1y', 'all']

export interface TokenBurn {
  total: number
  changePct: number | null
  sparkline: number[]
}

export interface ModelUsage {
  model: string
  tokens: number
}

export interface CostBreakdown {
  input: number
  output: number
  cacheWrite: number
  cacheRead: number
}

export interface Cost {
  total: number
  breakdown: CostBreakdown
}

export interface Sessions {
  total: number
  active: number
}

export interface PrsReferenced {
  count: number
  activeRepos: number
  sparkline: number[]
}

export interface LocDelta {
  net: number
  added: number
  removed: number
  sparkline: [number, number][]
}

export interface RangeStats {
  tokenBurn: TokenBurn
  tokensByModel: ModelUsage[]
  cost: Cost
  sessions: Sessions
  prsReferenced: PrsReferenced
  locDelta: LocDelta
}

export interface ActivityItem {
  repo: string
  message: string
  prRefs: number[]
  branch: string | null
  linesAdded: number
  linesRemoved: number
  ts: string
}

export interface Snapshot {
  snapshotDate: string
  generatedAt: string
  ranges: Record<RangeKey, RangeStats>
  recentActivity: ActivityItem[]
}

/** Blog post metadata handed from server components to the client carousel. */
export interface PostMeta {
  slug: string
  title: string
  date: string
}
