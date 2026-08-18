import Link from 'next/link'
import type { Metadata } from 'next'
import Nav from '@/components/Nav'
import { notFound } from 'next/navigation'
import { formatISODate } from '@/lib/format'
import { getPost, getPostSlugs } from '@/lib/posts'

export const dynamicParams = false

export function generateStaticParams() {
  return getPostSlugs().map((slug) => ({ slug }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const post = await getPost(slug)
  return { title: post ? `${post.title} — evano` : 'Post — evano' }
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const post = await getPost(slug)
  if (!post) notFound()

  const { default: Content } = post

  return (
    <main className="page-backdrop min-h-screen">
      <Nav />
      <article className="glass mx-auto mt-28 w-full max-w-2xl px-6 py-8 md:px-10">
        <p className="font-mono text-xs text-white/45">{formatISODate(post.date)}</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">{post.title}</h1>
        <div className="prose prose-invert mt-6 max-w-none prose-headings:font-semibold prose-a:text-cyan-300 prose-code:text-cyan-200 prose-pre:border prose-pre:border-white/10 prose-pre:bg-white/5">
          <Content />
        </div>
        <p className="mt-10">
          <Link href="/blog" className="text-sm text-white/50 transition-colors hover:text-white">
            ← All posts
          </Link>
        </p>
      </article>
    </main>
  )
}
