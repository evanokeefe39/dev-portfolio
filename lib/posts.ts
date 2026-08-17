import type { ComponentType } from 'react'
import type { PostMeta } from './types'

/**
 * Server-only blog content access.
 *
 * Posts are registered statically (ts-no-dynamic-import): each MDX module is
 * imported with a literal specifier so @next/mdx's loader bundles it and the
 * type checker sees the frontmatter exports. Adding a post = dropping the
 * .mdx file into content/blog/ AND adding one registry entry below.
 */
import WelcomePost, { frontmatter as welcomeFrontmatter } from '@/content/blog/welcome.mdx'
import WarehousePost, {
  frontmatter as warehouseFrontmatter,
} from '@/content/blog/warehouse-v1.mdx'

export interface MDXPost extends PostMeta {
  default: ComponentType<Record<string, unknown>>
}

interface PostEntry {
  slug: string
  title: string
  date: string
  component: ComponentType<Record<string, unknown>>
}

const POSTS: PostEntry[] = [
  {
    slug: 'welcome',
    title: welcomeFrontmatter.title,
    date: welcomeFrontmatter.date,
    component: WelcomePost,
  },
  {
    slug: 'warehouse-v1',
    title: warehouseFrontmatter.title,
    date: warehouseFrontmatter.date,
    component: WarehousePost,
  },
]

export function getPostSlugs(): string[] {
  return POSTS.map((p) => p.slug)
}

export function getPost(slug: string): MDXPost | null {
  const entry = POSTS.find((p) => p.slug === slug)
  if (!entry) return null
  return { slug: entry.slug, title: entry.title, date: entry.date, default: entry.component }
}

export function getPosts(): PostMeta[] {
  return POSTS.map(({ slug, title, date }) => ({ slug, title, date })).sort((a, b) =>
    a.date < b.date ? 1 : a.date > b.date ? -1 : 0,
  )
}
