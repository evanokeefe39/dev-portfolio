'use client'

import Link from 'next/link'
import useEmblaCarousel from 'embla-carousel-react'
import AutoScroll from 'embla-carousel-auto-scroll'
import type { PostMeta } from '@/lib/types'
import { formatISODate } from '@/lib/format'

/** Bottom-edge blog carousel: auto-scrolls (Embla + autoscroll plugin),
 *  pauses on hover, and links each card to its MDX post. */
export default function BlogCarousel({ posts }: { posts: PostMeta[] }) {
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

  if (posts.length === 0) {
    return (
      <section className="absolute inset-x-4 bottom-4 z-10">
        <div className="glass px-5 py-4 text-sm text-white/50">no blog posts yet</div>
      </section>
    )
  }

  return (
    <section className="absolute inset-x-4 bottom-4 z-10">
      <div className="glass p-4">
        <div className="mb-3 flex items-center justify-between px-1">
          <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-white/50">
            Blog
          </span>
        </div>
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-3">
            {posts.map((post) => (
              <Link
                key={post.slug}
                href={`/blog/${post.slug}`}
                className="glass flex min-w-0 flex-[0_0_240px] flex-col justify-between p-4 transition-colors hover:border-white/25 md:flex-[0_0_300px]"
              >
                <span className="font-mono text-[11px] text-white/45">
                  {formatISODate(post.date)}
                </span>
                <span className="mt-3 line-clamp-2 text-sm text-white/85">{post.title}</span>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
