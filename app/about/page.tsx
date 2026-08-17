import type { Metadata } from 'next'
import Nav from '@/components/Nav'

export const metadata: Metadata = { title: 'About — evano' }

export default function AboutPage() {
  return (
    <main className="page-backdrop min-h-screen">
      <Nav />
      <section className="glass mx-auto mt-28 w-full max-w-xl px-6 py-8 md:px-8">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">About</h1>
        <p className="mt-4 leading-relaxed text-white/80">
          I&apos;m a data / analytics engineer. This site is my worklog: it replays session
          telemetry — token burn, model usage, PRs referenced, and LOC deltas — as glass
          overlays, fed by committed JSON snapshots generated locally.
        </p>
        <p className="mt-4 leading-relaxed text-white/80">
          The frontend is a static Next.js export; the data pipeline is a standalone Python
          package that snapshots local session logs and git history into public/data.
        </p>
      </section>
    </main>
  )
}
