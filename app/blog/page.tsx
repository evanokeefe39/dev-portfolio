import Link from 'next/link'
import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import { getPosts } from '@/lib/posts'
import { formatISODate } from '@/lib/format'

export const metadata: Metadata = { title: 'Blog — evano' }

export default async function BlogIndexPage() {
  const posts = await getPosts()
  return (
    <main className="page-backdrop min-h-screen">
      <Nav />
      <section className="mx-auto mt-28 w-full max-w-2xl px-4">
        <h1 className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">Blog</h1>
        <ul className="mt-6 space-y-3">
          {posts.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className="glass block p-5 transition-colors hover:border-white/25"
              >
                <span className="font-mono text-xs text-white/45">{formatISODate(post.date)}</span>
                <span className="mt-1.5 block text-white/90">{post.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </main>
  )
}
