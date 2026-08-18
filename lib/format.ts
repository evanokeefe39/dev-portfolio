/** Pure formatting helpers — no React, no I/O; unit-tested in tests/data.test.ts. */

function trim(v: number): string {
  const s = v >= 100 ? v.toFixed(0) : v.toFixed(1)
  return s.replace(/\.0$/, '')
}

/** 1200000 -> "1.2M", 84000 -> "84K", 999 -> "999" */
export function formatTokens(n: number): string {
  if (!Number.isFinite(n)) return '0'
  const abs = Math.abs(n)
  if (abs >= 1e9) return `${trim(n / 1e9)}B`
  if (abs >= 1e6) return `${trim(n / 1e6)}M`
  if (abs >= 1e3) return `${trim(n / 1e3)}K`
  return `${Math.round(n)}`
}

/** 2847 -> "2,847" */
export function formatInt(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return Math.round(n).toLocaleString('en-US')
}

/** Signed integer with explicit plus: 2847 -> "+2,847", -12 -> "-12" */
export function formatSignedInt(n: number): string {
  if (!Number.isFinite(n)) return '0'
  return n > 0 ? `+${formatInt(n)}` : formatInt(n)
}

/** 18 -> "+18.0%", -5.5 -> "-5.5%", null -> null */
export function formatPct(changePct: number | null | undefined): string | null {
  if (changePct === null || changePct === undefined || !Number.isFinite(changePct)) return null
  const sign = changePct > 0 ? '+' : ''
  return `${sign}${changePct.toFixed(1)}%`
}

/** "2026-08-17" -> "Aug 17, 2026" (parsed as parts — timezone-safe). */
export function formatISODate(date: string): string {
  if (!date) return ''
  const parts = date.slice(0, 10).split('-')
  if (parts.length !== 3) return date
  const [y, m, d] = parts
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  const month = MONTHS[Number(m) - 1] ?? m
  return `${month} ${Number(d)}, ${y}`
}

/** Bar width as % of the max bucket; 0 for non-positive values, min 6% so bars read. */
export function barPercent(value: number, max: number): number {
  if (!Number.isFinite(value) || value <= 0 || !Number.isFinite(max) || max <= 0) return 0
  return Math.max(6, Math.min(100, (value / max) * 100))
}

/**
 * Normalize a series to SVG polyline points spanning [0, width] x [0, height].
 * Flat series (min === max) render as a centered horizontal line.
 */
export function sparklinePoints(values: number[], width: number, height: number): string {
  if (values.length === 0) return ''
  const min = Math.min(...values)
  const max = Math.max(...values)
  const span = max - min
  const step = width / Math.max(values.length - 1, 1)
  return values
    .map((v, i) => {
      const x = i * step
      const y = span === 0 ? height / 2 : height - ((v - min) / span) * (height - 2) - 1
      return `${x.toFixed(2)},${y.toFixed(2)}`
    })
    .join(' ')
}
