'use client'

import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import type { RangeKey, RangeStats, Snapshot } from '@/lib/types'
import { RANGE_KEYS } from '@/lib/types'
import { emptySnapshot, loadSnapshot } from '@/lib/data'
import { barPercent, formatInt, formatPct, formatSignedInt, formatTokens } from '@/lib/format'
import Sparkline from '@/components/Sparkline'

const CYCLE_MS = 4000

const FACES = ['Token burn', 'Tokens by model', 'PRs referenced', 'LOC delta'] as const

/**
 * Glass stat card, top-left below the nav. Four faces cycle on a 4s interval
 * with a 300ms vertical fade-slide. Hover pauses, click advances, dots show
 * position, and the range toggle (7d/30d/90d/1y/all) filters every face.
 */
export default function StatCard() {
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [range, setRange] = useState<RangeKey>('7d')
  const [face, setFace] = useState(0)
  const [paused, setPaused] = useState(false)

  useEffect(() => {
    let alive = true
    loadSnapshot()
      .then((snap) => {
        if (!alive) return
        setSnapshot(snap)
        setLoaded(true)
      })
      .catch(() => {
        if (alive) setLoaded(true)
      })
    return () => {
      alive = false
    }
  }, [])

  // Auto-cycle; re-armed on every face change so manual clicks reset the timer.
  useEffect(() => {
    if (paused) return
    const timer = setInterval(() => setFace((f) => (f + 1) % FACES.length), CYCLE_MS)
    return () => clearInterval(timer)
  }, [paused, face])

  const stats: RangeStats = (snapshot ?? emptySnapshot()).ranges[range]

  return (
    <section
      className="glass absolute left-4 top-24 z-10 w-[360px] p-5"
      aria-label="Snapshot stats"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
          {FACES[face]}
        </h2>
        <div className="flex items-center gap-2.5">
          {/* Position dots */}
          <div className="flex items-center gap-1.5">
            {FACES.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Show ${FACES[i]} face`}
                onClick={() => setFace(i)}
                className={`h-1.5 w-1.5 rounded-full transition-colors ${
                  i === face ? 'bg-cyan-300' : 'bg-white/25 hover:bg-white/50'
                }`}
              />
            ))}
          </div>
          {/* Persistent range toggle */}
          <div className="flex items-center gap-0.5 rounded-full border border-white/10 bg-white/5 p-0.5">
            {RANGE_KEYS.map((key) => (
              <button
                key={key}
                type="button"
                onClick={() => setRange(key)}
                className={`rounded-full px-2 py-0.5 font-mono text-[11px] transition-colors ${
                  key === range ? 'bg-cyan-400/20 text-cyan-300' : 'text-white/45 hover:text-white'
                }`}
              >
                {key}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="relative mt-4 min-h-[138px] overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={face}
            initial={{ y: 26, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -26, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            {face === 0 && <TokenBurnFace stats={stats} />}
            {face === 1 && <TokensByModelFace stats={stats} />}
            {face === 2 && <PrsFace stats={stats} />}
            {face === 3 && <LocFace stats={stats} />}
          </motion.div>
        </AnimatePresence>
      </div>

      {loaded && !snapshot && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-dashed border-white/15 px-3 py-2 text-xs text-white/50">
          <span aria-hidden className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-300/80" />
          no data yet
        </div>
      )}
    </section>
  )
}

function TokenBurnFace({ stats }: { stats: RangeStats }) {
  const { total, changePct, sparkline } = stats.tokenBurn
  const pct = formatPct(changePct)
  const up = (changePct ?? 0) >= 0
  return (
    <div>
      <Sparkline id="spark-burn" values={sparkline} />
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-[26px] font-semibold leading-none tabular-nums text-white">
          {formatTokens(total)}
        </span>
        <span className="text-xs text-white/50">tokens</span>
      </div>
      <div className="mt-2 text-xs">
        {pct ? (
          <span className={up ? 'text-emerald-400' : 'text-rose-400'}>{pct} vs prior period</span>
        ) : (
          <span className="text-white/40">change vs prior period unavailable</span>
        )}
      </div>
    </div>
  )
}

function TokensByModelFace({ stats }: { stats: RangeStats }) {
  const models = [...stats.tokensByModel].sort((a, b) => b.tokens - a.tokens).slice(0, 6)
  const max = models[0]?.tokens ?? 0
  if (models.length === 0) {
    return <div className="py-6 text-center text-xs text-white/40">no model usage recorded</div>
  }
  return (
    <ul className="space-y-2.5">
      {models.map((m) => (
        <li key={m.model}>
          <div className="flex items-baseline justify-between gap-3">
            <span className="truncate font-mono text-xs text-white/75">{m.model}</span>
            <span className="shrink-0 font-mono text-[11px] tabular-nums text-white/55">
              {formatTokens(m.tokens)}
            </span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/5">
            <div
              className="h-full rounded-full bg-gradient-to-r from-cyan-400/70 to-blue-500/70"
              style={{ width: `${barPercent(m.tokens, max)}%` }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}

function PrsFace({ stats }: { stats: RangeStats }) {
  const { count, activeRepos, sparkline } = stats.prsReferenced
  return (
    <div>
      <Sparkline id="spark-prs" values={sparkline} stroke="#a78bfa" />
      <div className="mt-2.5 flex items-baseline gap-2">
        <span className="text-[26px] font-semibold leading-none tabular-nums text-white">
          {formatInt(count)}
        </span>
        <span className="text-xs text-white/50">{formatInt(activeRepos)} active repos</span>
      </div>
      <div className="mt-2 text-xs text-white/40">#NNN refs found in commit messages</div>
    </div>
  )
}

function LocFace({ stats }: { stats: RangeStats }) {
  const { net, added, removed } = stats.locDelta
  return (
    <div>
      <div className="flex items-baseline gap-2">
        <span
          className={`text-[26px] font-semibold leading-none tabular-nums ${
            net >= 0 ? 'text-emerald-400' : 'text-rose-400'
          }`}
        >
          {formatSignedInt(net)}
        </span>
        <span className="text-xs text-white/50">net lines</span>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div className="rounded-lg bg-white/5 px-3 py-2">
          <div className="text-[11px] text-white/45">added</div>
          <div className="mt-0.5 font-mono text-sm tabular-nums text-emerald-400">
            +{formatInt(added)}
          </div>
        </div>
        <div className="rounded-lg bg-white/5 px-3 py-2">
          <div className="text-[11px] text-white/45">removed</div>
          <div className="mt-0.5 font-mono text-sm tabular-nums text-rose-400">
            −{formatInt(removed)}
          </div>
        </div>
      </div>
    </div>
  )
}
