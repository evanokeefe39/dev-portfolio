import type { NextConfig } from 'next'
import createMDX from '@next/mdx'
import remarkFrontmatter from 'remark-frontmatter'
import remarkMdxFrontmatter from 'remark-mdx-frontmatter'

const withMDX = createMDX({
  options: {
    remarkPlugins: [remarkFrontmatter, remarkMdxFrontmatter],
  },
})

const nextConfig: NextConfig = {
  output: 'export',
  // MDX files under content/blog are imported by pages; keep them out of
  // page routing by limiting pageExtensions to ts/tsx/mdx only when needed.
  pageExtensions: ['ts', 'tsx', 'mdx'],
  images: { unoptimized: true },
}

export default withMDX(nextConfig)
