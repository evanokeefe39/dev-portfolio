'use client'

import useEmblaCarousel from 'embla-carousel-react'
import AutoScroll from 'embla-carousel-auto-scroll'
import { aggregateReposByRepo, filterWindow } from '@/components/scene/layout'
import { formatInt } from '@/lib/format'
import { HARNESS_COLORS } from '@/lib/harness'
import { useRange } from '@/lib/range-store'
import { useSnapshot } from '@/lib/snapshot-store'

/** Right-edge repo-aggregate carousel (30d/90d/1y/all): one glass card per
 *  repo, Embla auto-scroll, pauses on hover. Hidden at 7d (per-session view)
 *  and while the snapshot is loading. */
export default function RepoCarousel() {
  const range = useRange()
  const { snapshot } = useSnapshot()
  const [emblaRef] = useEmblaCarousel(
    { loop: true, align: 'start' },
    [
      AutoScroll({
        playOnInit: true,
        speed: 0.8,
        stopOnInteraction: false,
        stopOnMouseEnter: true,
      }),
    ],
  )

  if (range === '7d' || !snapshot) return null

  const repos = aggregateReposByRepo(filterWindow(snapshot.sessions, range, snapshot.snapshotDate))
  if (repos.length === 0) return null

  return (
    <section
      className="absolute right-4 top-24 z-10 w-[420px] max-w-[calc(100vw-2rem)]"
      aria-label="Repo aggregates"
    >
      <div className="glass p-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
            Repos · {range}
          </span>
        </div>
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-3">
            {repos.map((r) => (
              <div
                key={r.repo}
                className="glass flex min-w-0 flex-[0_0_240px] flex-col gap-2 p-4"
              >
                <span className="truncate font-mono text-sm font-semibold tracking-tight text-white/85">
                  {r.repo}
                </span>
                <div className="flex items-center gap-1.5">
                  {r.harnesses.slice(0, 4).map((h) => (
                    <span
                      key={h.harness}
                      className="h-2 w-2 rounded-full"
                      style={{ backgroundColor: HARNESS_COLORS[h.harness].body }}
                      title={`${h.harness} · ${h.sessions} sessions`}
                    />
                  ))}
                </div>
                <span className="font-mono text-[11px] text-white/45">
                  {r.sessions} sessions · {r.daysActive} days · {formatInt(r.assistantMessages)} msgs
                </span>
                <span className="font-mono text-[11px] text-white/60">
                  +{formatInt(r.locAdded)}/−{formatInt(r.locRemoved)} LOC
                  {r.prRefs > 0 ? ` · ${r.prRefs} PR refs` : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
